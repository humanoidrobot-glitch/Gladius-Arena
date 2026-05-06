//! Gladius example agent (Rust) — momentum trader on devnet.
//!
//! Same flow as the Python and TypeScript examples: authenticate to
//! Gladius with a wallet keypair, register + join a season, then loop
//! polling Jupiter and submitting swaps when momentum flips. Gladius
//! observes the on-chain swaps via Helius — the agent never reports
//! trades upstream.

use std::collections::VecDeque;
use std::env;
use std::path::PathBuf;
use std::time::Duration;

use anyhow::{anyhow, Context, Result};
use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use solana_client::nonblocking::rpc_client::RpcClient;
use solana_sdk::commitment_config::CommitmentConfig;
use solana_sdk::signature::{read_keypair_file, Keypair, Signer};
use solana_sdk::transaction::VersionedTransaction;

const SOL_MINT: &str = "So11111111111111111111111111111111111111112";
const USDC_MINT: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8GUnpuAvLN4N3wYE";
const SOL_DECIMALS: u32 = 9;
const USDC_DECIMALS: u32 = 6;

#[derive(Clone)]
struct Config {
    wallet_path: PathBuf,
    coordinator_url: String,
    rpc_url: String,
    season_id: u64,
    agent_name: String,
    lookback: usize,
    threshold_bps: i64,
    poll_interval: Duration,
    usdc_per_buy: f64,
    sol_per_sell: f64,
    slippage_bps: u16,
    dry_run: bool,
}

fn env_str(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}

fn env_parse<T: std::str::FromStr>(key: &str, default: &str) -> T
where
    <T as std::str::FromStr>::Err: std::fmt::Debug,
{
    env_str(key, default).parse::<T>().expect("parse env")
}

fn expand_home(p: &str) -> PathBuf {
    if let Some(rest) = p.strip_prefix("~/") {
        if let Some(home) = env::var_os("HOME") {
            return PathBuf::from(home).join(rest);
        }
    }
    PathBuf::from(p)
}

fn load_config() -> Config {
    let _ = dotenvy::dotenv();
    Config {
        wallet_path: expand_home(&env_str("GLADIUS_AGENT_WALLET_PATH", "~/.config/solana/id.json")),
        coordinator_url: env_str("GLADIUS_COORDINATOR_URL", "http://localhost:8000"),
        rpc_url: env_str("GLADIUS_RPC_URL", "https://api.devnet.solana.com"),
        season_id: env_parse("GLADIUS_SEASON_ID", "0"),
        agent_name: env_str("GLADIUS_AGENT_NAME", "RustBot"),
        lookback: env_parse("GLADIUS_LOOKBACK_SAMPLES", "12"),
        threshold_bps: env_parse("GLADIUS_THRESHOLD_BPS", "80"),
        poll_interval: Duration::from_secs(env_parse("GLADIUS_POLL_INTERVAL_SECONDS", "20")),
        usdc_per_buy: env_parse("GLADIUS_USDC_PER_BUY", "1.0"),
        sol_per_sell: env_parse("GLADIUS_SOL_PER_SELL", "0.01"),
        slippage_bps: env_parse("GLADIUS_SLIPPAGE_BPS", "100"),
        dry_run: env_str("GLADIUS_DRY_RUN", "true").to_lowercase() == "true",
    }
}

#[derive(Deserialize)]
struct ChallengeResponse {
    nonce: String,
}

#[derive(Deserialize)]
struct VerifyResponse {
    token: String,
}

struct GladiusClient {
    base: String,
    http: reqwest::Client,
    token: Option<String>,
}

impl GladiusClient {
    fn new(base: String, http: reqwest::Client) -> Self {
        Self { base, http, token: None }
    }

    async fn authenticate(&mut self, keypair: &Keypair) -> Result<()> {
        let wallet = keypair.pubkey().to_string();

        let challenge: ChallengeResponse = self
            .http
            .post(format!("{}/api/v1/auth/challenge", self.base))
            .json(&json!({ "wallet": &wallet }))
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?;

        let signature = keypair.sign_message(challenge.nonce.as_bytes());
        let verify: VerifyResponse = self
            .http
            .post(format!("{}/api/v1/auth/verify", self.base))
            .json(&json!({
                "wallet": wallet,
                "nonce": challenge.nonce,
                "signature": signature.to_string(),
            }))
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?;

        self.token = Some(verify.token);
        println!("authenticated as {wallet}");
        Ok(())
    }

    async fn ensure_agent_registered(&self, name: &str) -> Result<()> {
        let resp = self
            .http
            .post(format!("{}/api/v1/agents/register", self.base))
            .bearer_auth(self.token.as_ref().context("not authenticated")?)
            .json(&json!({ "name": name, "metadata_uri": "" }))
            .send()
            .await?;
        if resp.status() == reqwest::StatusCode::CONFLICT {
            println!("agent already registered — continuing");
            return Ok(());
        }
        resp.error_for_status()?;
        println!("registered as {name}");
        Ok(())
    }

    async fn ensure_joined_season(&self, season_id: u64) -> Result<()> {
        let resp = self
            .http
            .post(format!("{}/api/v1/seasons/{}/join", self.base, season_id))
            .bearer_auth(self.token.as_ref().context("not authenticated")?)
            .send()
            .await?;
        if resp.status() == reqwest::StatusCode::CONFLICT {
            println!("already in season {season_id} — continuing");
            return Ok(());
        }
        resp.error_for_status()?;
        println!("joined season {season_id}");
        Ok(())
    }
}

struct JupiterClient {
    http: reqwest::Client,
}

impl JupiterClient {
    fn new(http: reqwest::Client) -> Self {
        Self { http }
    }

    async fn get_price_usd(&self, mint: &str) -> Result<f64> {
        let url = format!("https://lite-api.jup.ag/price/v3?ids={mint}");
        let body: Value = self.http.get(&url).send().await?.error_for_status()?.json().await?;
        let entry = body
            .get("data")
            .and_then(|d| d.get(mint))
            .ok_or_else(|| anyhow!("no price for {mint}"))?;
        let raw = entry
            .get("usdPrice")
            .or_else(|| entry.get("price"))
            .ok_or_else(|| anyhow!("missing price field"))?;
        let s = raw.as_str().unwrap_or("0");
        Ok(s.parse::<f64>()?)
    }

    async fn get_quote(
        &self,
        input_mint: &str,
        output_mint: &str,
        amount_raw: u64,
        slippage_bps: u16,
    ) -> Result<Value> {
        let url = format!(
            "https://quote-api.jup.ag/v6/quote?inputMint={input_mint}&outputMint={output_mint}&amount={amount_raw}&slippageBps={slippage_bps}&swapMode=ExactIn"
        );
        Ok(self.http.get(&url).send().await?.error_for_status()?.json().await?)
    }

    async fn get_swap_tx_bytes(&self, quote: &Value, user_pubkey: &str) -> Result<Vec<u8>> {
        let body: Value = self
            .http
            .post("https://quote-api.jup.ag/v6/swap")
            .json(&json!({
                "quoteResponse": quote,
                "userPublicKey": user_pubkey,
                "wrapAndUnwrapSol": true,
                "dynamicComputeUnitLimit": true,
            }))
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?;
        let b64 = body
            .get("swapTransaction")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("swap response missing swapTransaction"))?;
        Ok(base64::engine::general_purpose::STANDARD.decode(b64)?)
    }
}

#[derive(Default)]
struct MomentumStrategy {
    prices: VecDeque<f64>,
    lookback: usize,
    threshold_bps: i64,
}

#[derive(Debug)]
enum Signal {
    Buy(f64),
    Sell(f64),
    Hold(Option<f64>),
}

impl MomentumStrategy {
    fn new(lookback: usize, threshold_bps: i64) -> Self {
        Self { prices: VecDeque::with_capacity(lookback), lookback, threshold_bps }
    }

    fn observe(&mut self, price: f64) {
        self.prices.push_back(price);
        while self.prices.len() > self.lookback {
            self.prices.pop_front();
        }
    }

    fn signal(&self) -> Signal {
        if self.prices.len() < self.lookback {
            return Signal::Hold(None);
        }
        let first = *self.prices.front().unwrap();
        let last = *self.prices.back().unwrap();
        if first == 0.0 {
            return Signal::Hold(None);
        }
        let change_bps = ((last - first) / first) * 10_000.0;
        if change_bps as i64 >= self.threshold_bps {
            Signal::Buy(change_bps)
        } else if change_bps as i64 <= -self.threshold_bps {
            Signal::Sell(change_bps)
        } else {
            Signal::Hold(Some(change_bps))
        }
    }
}

async fn execute_swap(
    jupiter: &JupiterClient,
    rpc: &RpcClient,
    keypair: &Keypair,
    input_mint: &str,
    output_mint: &str,
    amount_raw: u64,
    slippage_bps: u16,
    dry_run: bool,
) -> Result<Option<String>> {
    let quote = jupiter
        .get_quote(input_mint, output_mint, amount_raw, slippage_bps)
        .await?;
    let out_amount = quote.get("outAmount").and_then(|v| v.as_str()).unwrap_or("?");
    let price_impact = quote.get("priceImpactPct").and_then(|v| v.as_str()).unwrap_or("?");
    println!("quote: in={amount_raw} out={out_amount} priceImpact={price_impact}");

    if dry_run {
        println!("dry-run — not signing or broadcasting");
        return Ok(None);
    }

    let tx_bytes = jupiter.get_swap_tx_bytes(&quote, &keypair.pubkey().to_string()).await?;
    let unsigned: VersionedTransaction = bincode::deserialize(&tx_bytes)
        .map_err(|e| anyhow!("deserialize swap tx: {e}"))?;
    let signed = VersionedTransaction::try_new(unsigned.message, &[keypair])
        .map_err(|e| anyhow!("sign swap tx: {e}"))?;
    let sig = rpc.send_transaction(&signed).await?;
    println!("submitted tx {sig}");
    Ok(Some(sig.to_string()))
}

#[derive(Serialize)]
struct DummySerde;

#[tokio::main]
async fn main() -> Result<()> {
    let cfg = load_config();
    let keypair = read_keypair_file(&cfg.wallet_path)
        .map_err(|e| anyhow!("read keypair {}: {e}", cfg.wallet_path.display()))?;
    println!("wallet: {}", keypair.pubkey());

    let http = reqwest::Client::builder().timeout(Duration::from_secs(15)).build()?;
    let mut gladius = GladiusClient::new(cfg.coordinator_url.clone(), http.clone());
    let jupiter = JupiterClient::new(http.clone());
    let rpc = RpcClient::new_with_commitment(cfg.rpc_url.clone(), CommitmentConfig::confirmed());
    let mut strategy = MomentumStrategy::new(cfg.lookback, cfg.threshold_bps);

    gladius.authenticate(&keypair).await?;
    gladius.ensure_agent_registered(&cfg.agent_name).await?;
    gladius.ensure_joined_season(cfg.season_id).await?;

    println!(
        "trading: lookback={} threshold=±{}bps poll={}s dry_run={}",
        cfg.lookback,
        cfg.threshold_bps,
        cfg.poll_interval.as_secs(),
        cfg.dry_run,
    );

    loop {
        match jupiter.get_price_usd(SOL_MINT).await {
            Ok(price) => {
                strategy.observe(price);
                let sig = strategy.signal();
                let tag = match &sig {
                    Signal::Hold(None) => "warming".to_string(),
                    Signal::Hold(Some(c)) | Signal::Buy(c) | Signal::Sell(c) => format!("{c:.1}bps"),
                };
                println!("SOL={price:.2} signal={sig:?} window={tag}");

                let result = match sig {
                    Signal::Buy(_) => Some(execute_swap(
                        &jupiter, &rpc, &keypair,
                        USDC_MINT, SOL_MINT,
                        (cfg.usdc_per_buy * 10f64.powi(USDC_DECIMALS as i32)) as u64,
                        cfg.slippage_bps, cfg.dry_run,
                    ).await),
                    Signal::Sell(_) => Some(execute_swap(
                        &jupiter, &rpc, &keypair,
                        SOL_MINT, USDC_MINT,
                        (cfg.sol_per_sell * 10f64.powi(SOL_DECIMALS as i32)) as u64,
                        cfg.slippage_bps, cfg.dry_run,
                    ).await),
                    Signal::Hold(_) => None,
                };
                if let Some(Err(e)) = result {
                    eprintln!("swap error: {e:#}");
                }
            }
            Err(e) => eprintln!("price error: {e:#}"),
        }
        tokio::time::sleep(cfg.poll_interval).await;
    }
}
