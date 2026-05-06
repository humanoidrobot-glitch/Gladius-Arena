import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { Gladius } from "../../target/types/gladius";

chai.use(chaiAsPromised);
const { expect } = chai;

const GLADIUS_CONFIG_SEED = Buffer.from("gladius_config");
const AGENT_SEED = Buffer.from("agent");
const SEASON_SEED = Buffer.from("season");
const SEASON_ENTRY_SEED = Buffer.from("entry");

const ONE_USDC = new BN(1_000_000);

function seasonIdSeed(id: BN): Buffer {
  return id.toArrayLike(Buffer, "le", 8);
}

async function airdrop(connection: anchor.web3.Connection, to: PublicKey, sol = 5) {
  const sig = await connection.requestAirdrop(to, sol * LAMPORTS_PER_SOL);
  const latest = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
}

// Sequential lifecycle: each `it()` depends on prior state. First failure cascades.
describe("gladius — full season lifecycle", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Gladius as Program<Gladius>;
  const connection = provider.connection;

  const admin = (provider.wallet as anchor.Wallet).payer;
  const treasury = Keypair.generate();
  const agentOwner = Keypair.generate();
  const otherUser = Keypair.generate();

  const seasonId = new BN(0);

  let configPda: PublicKey;
  let agentPda: PublicKey;
  let seasonPda: PublicKey;
  let entryPda: PublicKey;

  before(async () => {
    [configPda] = PublicKey.findProgramAddressSync([GLADIUS_CONFIG_SEED], program.programId);
    [agentPda] = PublicKey.findProgramAddressSync(
      [AGENT_SEED, agentOwner.publicKey.toBuffer()],
      program.programId,
    );
    [seasonPda] = PublicKey.findProgramAddressSync(
      [SEASON_SEED, seasonIdSeed(seasonId)],
      program.programId,
    );
    [entryPda] = PublicKey.findProgramAddressSync(
      [SEASON_ENTRY_SEED, seasonIdSeed(seasonId), agentPda.toBuffer()],
      program.programId,
    );

    await Promise.all([
      airdrop(connection, agentOwner.publicKey),
      airdrop(connection, otherUser.publicKey),
    ]);
  });

  it("initialize: bootstraps GladiusConfig", async () => {
    await program.methods
      .initialize(new BN(0), treasury.publicKey)
      .accountsStrict({
        authority: admin.publicKey,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const config = await program.account.gladiusConfig.fetch(configPda);
    expect(config.authority.toBase58()).to.equal(admin.publicKey.toBase58());
    expect(config.treasury.toBase58()).to.equal(treasury.publicKey.toBase58());
    expect(config.seasonCount.toString()).to.equal("0");
    expect(config.agentCount.toString()).to.equal("0");
    expect(config.registrationFee.toString()).to.equal("0");
  });

  it("initialize: re-initialization fails (singleton PDA)", async () => {
    await expect(
      program.methods
        .initialize(new BN(0), treasury.publicKey)
        .accountsStrict({
          authority: admin.publicKey,
          config: configPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc(),
    ).to.be.rejectedWith(/already in use/i);
  });

  it("register_agent: creates Agent PDA with sequential id", async () => {
    await program.methods
      .registerAgent("Test Agent", "ipfs://test-metadata", null)
      .accountsStrict({
        authority: agentOwner.publicKey,
        config: configPda,
        agent: agentPda,
        treasury: treasury.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentOwner])
      .rpc();

    const agent = await program.account.agent.fetch(agentPda);
    expect(agent.authority.toBase58()).to.equal(agentOwner.publicKey.toBase58());
    expect(agent.agentId.toString()).to.equal("0");
    expect(agent.name).to.equal("Test Agent");
    expect(agent.metadataUri).to.equal("ipfs://test-metadata");
    expect(agent.threeWsAgentId).to.be.null;
    expect(agent.totalSeasons).to.equal(0);

    const config = await program.account.gladiusConfig.fetch(configPda);
    expect(config.agentCount.toString()).to.equal("1");
  });

  it("create_season: admin creates a Season in Pending status", async () => {
    const endTime = new BN(Math.floor(Date.now() / 1000) + 60 * 60);

    const seasonConfig = {
      name: "Smoke Test Season",
      description: "Devnet integration test",
      tradingUniverse: [
        new PublicKey("So11111111111111111111111111111111111111112"),
        new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8GUnpuAvLN4N3wYE"),
      ],
      maxAgents: 5,
      scoringMethod: { riskAdjusted: {} },
    };

    await program.methods
      .createSeason(seasonConfig, endTime)
      .accountsStrict({
        authority: admin.publicKey,
        gladiusConfig: configPda,
        season: seasonPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const season = await program.account.season.fetch(seasonPda);
    expect(season.seasonId.toString()).to.equal("0");
    expect(season.status).to.deep.equal({ pending: {} });
    expect(season.startTime).to.be.null;
    expect(season.endTime.toString()).to.equal(endTime.toString());
    expect(season.agentCount).to.equal(0);

    const config = await program.account.gladiusConfig.fetch(configPda);
    expect(config.seasonCount.toString()).to.equal("1");
  });

  it("create_season: non-admin caller is rejected", async () => {
    const endTime = new BN(Math.floor(Date.now() / 1000) + 3600);
    const config = {
      name: "Should Fail",
      description: "",
      tradingUniverse: [],
      maxAgents: 1,
      scoringMethod: { pnl: {} },
    };
    const [unrelatedSeasonPda] = PublicKey.findProgramAddressSync(
      [SEASON_SEED, seasonIdSeed(new BN(1))],
      program.programId,
    );

    await expect(
      program.methods
        .createSeason(config, endTime)
        .accountsStrict({
          authority: otherUser.publicKey,
          gladiusConfig: configPda,
          season: unrelatedSeasonPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([otherUser])
        .rpc(),
    ).to.be.rejectedWith(/Unauthorized|ConstraintHasOne/i);
  });

  it("join_season: agent joins a Pending season", async () => {
    await program.methods
      .joinSeason()
      .accountsStrict({
        authority: agentOwner.publicKey,
        agent: agentPda,
        season: seasonPda,
        entry: entryPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentOwner])
      .rpc();

    const entry = await program.account.seasonEntry.fetch(entryPda);
    expect(entry.agent.toBase58()).to.equal(agentPda.toBase58());
    expect(entry.season.toBase58()).to.equal(seasonPda.toBase58());
    expect(entry.wallet.toBase58()).to.equal(agentOwner.publicKey.toBase58());
    expect(entry.score).to.be.null;

    const season = await program.account.season.fetch(seasonPda);
    expect(season.agentCount).to.equal(1);

    const agent = await program.account.agent.fetch(agentPda);
    expect(agent.totalSeasons).to.equal(1);
  });

  it("start_season: Pending → Active, sets start_time", async () => {
    await program.methods
      .startSeason()
      .accountsStrict({ authority: admin.publicKey, season: seasonPda })
      .rpc();

    const season = await program.account.season.fetch(seasonPda);
    expect(season.status).to.deep.equal({ active: {} });
    expect(season.startTime).to.not.be.null;
  });

  it("settle_season: Active → Settled", async () => {
    await program.methods
      .settleSeason()
      .accountsStrict({ authority: admin.publicKey, season: seasonPda })
      .rpc();

    const season = await program.account.season.fetch(seasonPda);
    expect(season.status).to.deep.equal({ settled: {} });
  });

  it("submit_final_score: writes FinalScore into entry", async () => {
    const score = {
      startingBalanceUsdc: ONE_USDC.muln(1000),
      balanceUsdc: ONE_USDC.muln(1500),
      pnlBps: 5000,
      sharpe: 1500,
      maxDrawdownBps: 800,
      tradeCount: 42,
      rank: 1,
    };

    await program.methods
      .submitFinalScore(score)
      .accountsStrict({
        authority: admin.publicKey,
        gladiusConfig: configPda,
        season: seasonPda,
        agent: agentPda,
        entry: entryPda,
      })
      .rpc();

    const entry = await program.account.seasonEntry.fetch(entryPda);
    expect(entry.score).to.not.be.null;
    expect(entry.score!.balanceUsdc.toString()).to.equal(ONE_USDC.muln(1500).toString());
    expect(entry.score!.pnlBps).to.equal(5000);
    expect(entry.score!.rank).to.equal(1);
  });

  it("submit_final_score: re-submission fails (already submitted)", async () => {
    const score = {
      startingBalanceUsdc: new BN(0),
      balanceUsdc: new BN(0),
      pnlBps: 0,
      sharpe: 0,
      maxDrawdownBps: 0,
      tradeCount: 0,
      rank: 0,
    };
    await expect(
      program.methods
        .submitFinalScore(score)
        .accountsStrict({
          authority: admin.publicKey,
          gladiusConfig: configPda,
          season: seasonPda,
          agent: agentPda,
          entry: entryPda,
        })
        .rpc(),
    ).to.be.rejectedWith(/ScoreAlreadySubmitted/i);
  });

  it("mint_attestation: emits AttestationMinted event", async () => {
    type MintedEvent = { seasonId: BN; agent: PublicKey };

    const eventPromise = new Promise<MintedEvent>((resolve, reject) => {
      const listener = program.addEventListener(
        "attestationMinted",
        (event: MintedEvent) => {
          program.removeEventListener(listener).catch(() => {});
          resolve(event);
        },
      );
      setTimeout(() => {
        program.removeEventListener(listener).catch(() => {});
        reject(new Error("AttestationMinted event timeout"));
      }, 3000);
    });

    await program.methods
      .mintAttestation()
      .accountsStrict({
        authority: admin.publicKey,
        gladiusConfig: configPda,
        season: seasonPda,
        agent: agentPda,
        entry: entryPda,
      })
      .rpc();

    const received = await eventPromise;
    expect(received.seasonId.toString()).to.equal("0");
    expect(received.agent.toBase58()).to.equal(agentPda.toBase58());
  });
});
