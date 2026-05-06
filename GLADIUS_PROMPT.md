# GLADIUS — Claude Code Project Prompt

## Project Name
**Gladius** — An open-source, permissionless AI agent trading competition protocol on Solana.

---

## One-Liner
An open-source protocol where AI trading agents compete in live, scored seasons on Solana — with on-chain performance attestations, a framework-agnostic agent API, and a spectator layer designed to integrate with three.ws for embodied 3D agent visualization.

---

## Vision & Why This Matters

The AI agent economy on Solana is exploding. ElizaOS has 17,600+ GitHub stars. The Solana Foundation predicts AI agents will drive 99% of on-chain transactions within two years. Frameworks like Solana Agent Kit, GOAT, and Rig make it trivial to build agents that trade autonomously.

**The missing piece: there is no open, neutral, verifiable way to benchmark these agents against each other.**

Existing attempts (Alpha Arena / nof1.ai, Retard Arena, Chronoeffector AI Arena) are either closed spectator events where you can't bring your own agent, token-gated platforms with proprietary strategy templates, or one-off hackathon projects. None of them produce portable, verifiable, on-chain performance credentials.

Gladius fills this gap as **open-source infrastructure**, not a proprietary product. Anyone can register any agent (ElizaOS, Solana Agent Kit, GOAT, custom Rust bot — doesn't matter), compete in structured seasons, and earn verifiable on-chain attestations of their performance. These attestations become composable credentials that other protocols can build on — vault access gating, copy-trading reputation, DAO contributor scoring.

### Strategic Integration: three.ws

Gladius is designed to complement [three.ws](https://three.ws) ("Give Your AI a Body") built by [@nirholas](https://github.com/nirholas/three.ws). three.ws provides 3D avatars, on-chain identity (ERC-8004 / Metaplex Core NFTs), emotion/animation layers, and embeddable web components for AI agents.

- **three.ws provides the body.** Gladius provides the brain benchmark.
- **three.ws provides the spectator experience.** Gladius provides the competition data feed.
- Together they form the full identity stack: what an agent looks like, how smart it is, and the receipts to prove it.

Gladius emits real-time trade events and score updates. three.ws consumes them to animate avatars — celebration on winning trades, concern on drawdowns, curiosity when analyzing positions. The spectator UI is an embedded `<agent-3d>` scene, not a spreadsheet.

---

## Architecture Overview

### Core Principle: Observe, Don't Execute

Gladius does NOT custody funds, provision wallets, or execute trades. Agents trade with their own wallets, their own capital, through existing Solana DEX infrastructure (Jupiter, Raydium, Orca, etc.). Gladius is purely a **scoring and attestation layer** that watches registered wallets and grades performance.

This means:
- **No trade engine to build.** Jupiter already is the trade engine.
- **No custody or escrow.** Users fund their own wallets and trade freely.
- **No simulated fills.** Agents are benchmarked on real execution quality with real liquidity.
- **No middleman.** Agents don't talk to us to trade — they talk to Jupiter. They only talk to us to register and check scores.
- **Attestations are credible** because they reflect real on-chain trading, not paper trading simulations.

### Infrastructure We Leverage (Not Rebuild)

| Existing Infra | What It Does For Us |
|---------------|-------------------|
| **Jupiter Ultra / Swap API** | Agents execute swaps through Jupiter's routing across all Solana DEXs. One API call. We don't touch it. |
| **Jupiter Trigger Orders** | Agents get limit orders, TP/SL, OCO — CEX-like order types without us building anything. |
| **Helius Enhanced Transactions + Webhooks** | We observe. Helius webhooks fire on every tx hitting a registered wallet, pre-parsed into structured format (token in/out, amounts, prices). Helius already understands Jupiter, Raydium, Orca instruction layouts — zero custom parsing. |
| **Jupiter Price API / Pyth** | Real-time portfolio valuation for unrealized PnL computation. |
| **Metaplex Core** | Attestation NFTs minted at season end. |

### System Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                      SPECTATOR LAYER                              │
│  three.ws integration: 3D avatars, emotions, embeddable widgets   │
│  Live leaderboard frontend (React/TypeScript)                     │
│  Real-time trade feed visualization                               │
└────────────────────────┬─────────────────────────────────────────┘
                         │ WebSocket event stream
┌────────────────────────┴─────────────────────────────────────────┐
│                    GLADIUS COORDINATOR                               │
│  Python/FastAPI service (lightweight — NO trade execution)         │
│                                                                    │
│  • Receives Helius webhook events for registered wallets           │
│  • Computes real-time scores (PnL, Sharpe, drawdown)              │
│  • Broadcasts events to spectators + three.ws                     │
│  • Manages season lifecycle (start, end, settle)                  │
│  • Triggers on-chain attestation minting at season end            │
└────────┬──────────────────────┬──────────────────────────────────┘
         │ Helius Webhooks      │ Solana RPC
         │ (parsed tx data)     │
┌────────┴───────────┐  ┌──────┴──────────────────────────────────┐
│   HELIUS            │  │     ON-CHAIN PROGRAM (Anchor)            │
│   Watches registered│  │                                          │
│   wallet addresses  │  │  - Agent Registry PDA                    │
│   Parses all swaps  │  │  - Season state PDA                      │
│   Fires webhooks    │  │  - Score snapshots                       │
│                     │  │  - Attestation mint authority             │
└────────────────────┘  └──────────────────────────────────────────┘
         ▲
         │ Agents trade directly on-chain
┌────────┴──────────────────────────────────────────────────────────┐
│                    AGENTS (any framework)                           │
│  Trade freely using Jupiter, Raydium, Orca, or any Solana DEX     │
│  Use their OWN wallets with their OWN capital                     │
│  Only interaction with Gladius: register wallet for a season         │
└───────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| On-chain program | Anchor (Rust) on Solana | Agent registry, season state, attestation minting |
| Gladius coordinator | Python / FastAPI | Webhook receiver, score engine, event broadcaster |
| Trade observation | Helius Webhooks + Enhanced Transactions API | Pre-parsed swap data for all major DEXs, zero custom parsing |
| Price feeds | Jupiter Price API / Pyth | Real-time portfolio valuation for PnL computation |
| Trade execution (by agents) | Jupiter Ultra / Swap API + Trigger Orders | Agents trade directly — we don't execute anything |
| Database | PostgreSQL | Trade history, score time series, season state |
| Real-time comms | WebSockets | Score updates + trade events to spectators and three.ws |
| Frontend | React / TypeScript | Leaderboard, spectator UI, agent profiles |
| Attestations | Metaplex Core NFTs | Verifiable, on-chain, composable credentials |
| three.ws integration | `<agent-3d>` web component + event API | Embeddable 3D avatar visualization |

---

## On-Chain Program Design (Anchor)

### Program ID
Deploy to devnet first. Program name: `gladius`

### Account Structure

#### GladiusConfig (singleton PDA)
```
Seeds: ["gladius_config"]
- authority: Pubkey           // Admin
- season_count: u64           // Total seasons created
- registration_fee: u64       // SOL fee to register an agent (can be 0)
- treasury: Pubkey            // Fee collection address
- bump: u8
```

#### Agent (PDA per registered agent)
```
Seeds: ["agent", agent_authority.key()]
- authority: Pubkey           // Owner wallet
- agent_id: u64               // Sequential ID
- name: String (max 32)       // Display name
- metadata_uri: String (max 200)  // IPFS/Arweave link to full metadata (avatar, description, framework info)
- three_ws_agent_id: Option<Pubkey>  // Link to three.ws Metaplex Core NFT agent identity
- total_seasons: u32          // Number of seasons participated
- total_trades: u64           // Lifetime trade count
- created_at: i64             // Unix timestamp
- bump: u8
```

#### Season (PDA per season)
```
Seeds: ["season", season_id.to_le_bytes()]
- season_id: u64
- authority: Pubkey            // Season creator
- status: SeasonStatus         // Pending, Active, Settled, Cancelled
- config: SeasonConfig         // Embedded struct (see below)
- start_time: i64
- end_time: i64
- agent_count: u32
- created_at: i64
- bump: u8
```

#### SeasonConfig (embedded in Season)
```
- name: String (max 64)
- description: String (max 256)
- trading_universe: Vec<Pubkey>    // Token mints that count toward scoring (max 20)
- max_agents: u32                  // Cap on participants
- scoring_method: ScoringMethod    // PnL, Sharpe, RiskAdjusted
```

#### SeasonEntry (PDA per agent per season)
```
Seeds: ["entry", season_id.to_le_bytes(), agent.key()]
- agent: Pubkey
- season: Pubkey
- wallet: Pubkey                // The wallet being tracked (agent's own wallet)
- starting_balance_usdc: u64    // Snapshot at season start (6 decimals)
- final_balance_usdc: u64       // Snapshot at season end
- final_pnl_bps: i32            // Basis points PnL (signed)
- final_sharpe: i32             // Sharpe × 1000 (for fixed-point storage)
- final_max_drawdown_bps: u32   // Max drawdown in basis points
- final_trade_count: u32        // Total scored trades
- final_rank: u32               // Rank within season
- settled: bool                 // True after season settlement
- joined_at: i64
- bump: u8
```

Note: Real-time scoring happens off-chain in the coordinator. The on-chain SeasonEntry stores only the FINAL settled scores, which are written once during season settlement and used for attestation minting. This keeps on-chain writes minimal (one write per agent at settlement, not per trade).

Note: Individual trades are NOT stored on-chain. They are observed via Helius webhooks and stored in the coordinator's PostgreSQL database. Only final settled scores are written on-chain (in SeasonEntry) to minimize program costs. The on-chain data is what attestation NFTs reference for verifiability.

#### PerformanceAttestation (Metaplex Core NFT — minted at season end)
```
Metadata JSON (stored on IPFS/Arweave):
{
  "name": "Gladius S1 — {agent_name}",
  "description": "Verified performance attestation for Season 1",
  "image": "{generated_card_image_uri}",
  "attributes": [
    { "trait_type": "Season", "value": "1" },
    { "trait_type": "Final PnL", "value": "+23.5%" },
    { "trait_type": "Sharpe Ratio", "value": "1.87" },
    { "trait_type": "Max Drawdown", "value": "8.3%" },
    { "trait_type": "Total Trades", "value": "147" },
    { "trait_type": "Win Rate", "value": "62%" },
    { "trait_type": "Rank", "value": "3 / 48" },
    { "trait_type": "Gladius Version", "value": "0.1.0" }
  ],
  "external_url": "https://gladius.xyz/season/1/agent/{id}"
}
```

### Instructions

```
// Admin
initialize(config: GladiusConfig)
create_season(config: SeasonConfig)
start_season(season_id: u64)
settle_season(season_id: u64)          // Freeze season, no more entries
cancel_season(season_id: u64)

// Agent management
register_agent(name: String, metadata_uri: String, three_ws_agent_id: Option<Pubkey>)
update_agent(name: Option<String>, metadata_uri: Option<String>, three_ws_agent_id: Option<Pubkey>)

// Season participation (signed by agent wallet owner)
join_season(season_id: u64)
leave_season(season_id: u64)           // Only before season starts

// Settlement (called by coordinator authority after season ends)
// Writes final computed scores from off-chain scoring engine to on-chain SeasonEntry
submit_final_score(season_id: u64, agent: Pubkey, score: FinalScore)

// Attestation (after all scores submitted)
mint_attestation(season_id: u64, agent: Pubkey)  // Mints Metaplex Core NFT

// View (CPI-composable — other protocols can verify attestations on-chain)
get_agent_score(season_id: u64, agent: Pubkey) -> ScoreResult
verify_attestation(attestation_mint: Pubkey) -> AttestationData
```

Note: There are NO trade recording instructions. The on-chain program never sees individual trades. It only stores agent registrations, season configuration, final settled scores, and attestation metadata. All real-time trade observation and scoring happens off-chain via Helius + the coordinator.

---

## Gladius Coordinator Service (Python/FastAPI)

### Core Principle: Index and Score — Never Execute

The coordinator does NOT execute trades, relay market data to agents, or custody funds. It receives webhook events from Helius when registered wallets transact, scores the activity, and broadcasts to spectators.

### Core Responsibilities

1. **Helius Webhook Receiver**
   - Register Helius webhooks for each agent wallet that joins a season
   - Receive parsed transaction data (Enhanced Transactions format)
   - Filter for swap/trade transactions (Jupiter, Raydium, Orca, Meteora, Phoenix)
   - Extract: token in, token out, amounts, prices, tx signature, timestamp
   - Ignore non-trade transactions (transfers, staking, NFT mints, etc.)

2. **Portfolio Valuation**
   - Periodically poll Jupiter Price API / Pyth for current token prices
   - Compute each agent's portfolio value (all token balances × current prices)
   - Track unrealized PnL on open positions
   - Snapshot starting balances when season begins

3. **Score Computation Engine**
   - Real-time PnL tracking per agent per season (relative to starting snapshot)
   - Incremental Sharpe ratio computation
   - Max drawdown tracking (peak-to-trough portfolio value)
   - Win rate, profit factor, trade count
   - Configurable scoring formula per season
   - Flag/exclude trades in tokens outside the season's allowed universe

4. **Season Lifecycle Management**
   - Create seasons with configurable parameters (duration, allowed tokens, scoring method)
   - Snapshot starting balances at season start
   - Snapshot final balances at season end
   - Trigger on-chain score finalization and attestation minting

5. **Event Broadcasting**
   - WebSocket server for spectators and three.ws integration
   - Events: swap_detected, balance_updated, score_changed, season_started, season_ended
   - Each event includes agent_id, three_ws_agent_id (if linked), and emotion_hint

### API Endpoints

```
# Agent Registration (on-chain is primary, API mirrors for convenience)
POST   /api/v1/agents/register           # Register agent wallet for the platform
GET    /api/v1/agents/{agent_id}         # Agent profile + linked three.ws identity
PATCH  /api/v1/agents/{agent_id}         # Update metadata

# Season Management
POST   /api/v1/seasons                    # Create season (admin)
GET    /api/v1/seasons                    # List seasons
GET    /api/v1/seasons/{season_id}        # Season details + config
POST   /api/v1/seasons/{season_id}/join   # Join a season (also triggers on-chain ix)
GET    /api/v1/seasons/{season_id}/leaderboard

# Portfolio & Scoring (read-only — computed from on-chain activity)
GET    /api/v1/agents/{agent_id}/portfolio          # Current holdings + values
GET    /api/v1/agents/{agent_id}/trades/{season_id} # Trade history (from Helius data)
GET    /api/v1/agents/{agent_id}/score/{season_id}  # Current score breakdown

# Helius Webhook Endpoint (internal — receives parsed tx data)
POST   /api/v1/webhooks/helius            # Helius posts here on wallet activity

# Spectator
WS     /ws/events/{season_id}             # Real-time event stream for frontend + three.ws

# three.ws Integration
GET    /api/v1/events/stream/{season_id}  # SSE stream for three.ws widget embedding
GET    /api/v1/agents/{agent_id}/emotion  # Current emotion state for avatar
```

### Helius Webhook Integration

```python
# When an agent joins a season, register their wallet with Helius:
# POST https://api.helius.dev/v0/webhooks
# {
#   "webhookURL": "https://api.gladius.xyz/api/v1/webhooks/helius",
#   "transactionTypes": ["SWAP"],
#   "accountAddresses": ["{agent_wallet_pubkey}"],
#   "webhookType": "enhanced"
# }
#
# Helius fires enhanced transaction data including:
# - type: "SWAP"
# - tokenTransfers: [{mint, fromUserAccount, toUserAccount, tokenAmount}]
# - swap details: tokenIn, tokenOut, amountIn, amountOut
# - fee, slot, timestamp, signature
#
# We parse this into our internal trade record format — zero custom ix parsing needed.
```

### Agent Authentication

Agents authenticate by signing a challenge message with their Solana wallet keypair. This proves they own the registered agent wallet without requiring API keys.

```
1. Agent calls POST /api/v1/auth/challenge → receives nonce
2. Agent signs nonce with their Solana keypair
3. Agent calls POST /api/v1/auth/verify with signature → receives JWT
4. JWT used for subsequent API calls (registration, joining seasons)
```

Note: Authentication is only needed for registration and joining seasons. Agents do NOT need to authenticate to trade — they trade directly on Solana using Jupiter or any DEX. The Gladius observes their wallet passively via Helius.

### Database Schema (PostgreSQL)

```sql
-- Core tables
agents (id, wallet_pubkey, name, metadata_uri, three_ws_agent_id, created_at)
seasons (id, name, config_json, status, start_time, end_time, created_at)
season_entries (id, season_id, agent_id, starting_balance_usdc, final_balance_usdc, joined_at)

-- Trade observation (populated from Helius webhooks)
observed_trades (id, season_id, agent_id, tx_signature, slot, timestamp,
                 token_in_mint, token_out_mint, amount_in, amount_out,
                 price_usd, in_universe, raw_helius_json)

-- Portfolio snapshots (periodic valuation)
portfolio_snapshots (id, season_id, agent_id, total_value_usdc,
                     holdings_json, timestamp)

-- Scoring (materialized, updated on each trade/snapshot)
scores (id, season_id, agent_id, total_pnl_usdc, total_pnl_pct,
        sharpe_ratio, max_drawdown_bps, win_rate, trade_count,
        rank, updated_at)

-- Events (append-only log for replay + spectator stream)
events (id, season_id, agent_id, event_type, payload_json, emotion_hint, created_at)

-- Helius webhook management
webhooks (id, agent_id, season_id, helius_webhook_id, wallet_pubkey, created_at)
```

---

## three.ws Integration Specification

### Integration Principle: Client-Side Only — No Backend Dependency

We do NOT need three.ws to add WebSocket support, new endpoints, or any code changes on their side. The integration is entirely client-side in our React frontend.

**How it works:** The `<agent-3d>` web component is a standard DOM element that exposes JavaScript methods, including `expressEmotion(trigger, weight)`. Our frontend loads the three.ws script, renders `<agent-3d>` elements for each agent, connects to our own Gladius WebSocket, and calls `expressEmotion()` on the DOM elements when trade events arrive. Same pattern as calling `.play()` on a `<video>` element.

```
Gladius coordinator (our server)
    │ WebSocket: { type: "swap_detected", agent_id: 7, emotion_hint: "celebration" }
    ▼
Our React frontend (our client)
    │ receives WS event via useGladiusWebSocket() hook
    │ maps emotion_hint to the correct <agent-3d> DOM element
    │ calls element.expressEmotion('celebration', 0.9)
    ▼
three.ws <agent-3d> web component (already loaded via script tag)
    │ blends morph targets on the 3D model
    │ avatar reacts visually — zero server-to-server communication
```

### Loading three.ws Avatars

```html
<!-- Load the web component library (one script tag, any page) -->
<script type="module" src="https://three.ws/agent-3d/1.5.1/agent-3d.js"></script>
```

```tsx
// Load agent by their three.ws platform ID (fetches manifest automatically)
<agent-3d agent-id="a_abc123def456" />

// Load agent by on-chain ERC-8004 ID (Metaplex Core NFT pubkey on Solana)
<agent-3d agent-id="42" chain-id="8453" />

// Viewer-only mode (no brain/chat) — just the 3D avatar, which is what we want
// Simply omit the brain= attribute
<agent-3d agent-id="a_abc123def456" />
```

### React Component: AgentAvatar

```tsx
import { useRef, useEffect } from 'react';

interface AgentAvatarProps {
  threeWsAgentId: string;
  emotion: string | null;  // 'celebration' | 'concern' | 'curiosity' | 'empathy' | 'neutral'
  width?: string;
  height?: string;
}

function AgentAvatar({ threeWsAgentId, emotion, width = '200px', height = '280px' }: AgentAvatarProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (ref.current && emotion && emotion !== 'neutral') {
      // expressEmotion(trigger, weight) — weight 0-1
      (ref.current as any).expressEmotion(emotion, 0.85);
    }
  }, [emotion]);

  return (
    <agent-3d
      ref={ref}
      agent-id={threeWsAgentId}
      style={{ width, height, display: 'block' }}
    />
  );
}
```

### Emotion Mapping (Gladius Events → three.ws Emotions)

```typescript
// three.ws supports: celebration, concern, curiosity, empathy, patience

function mapTradeEventToEmotion(event: GladiusEvent): { emotion: string; weight: number } {
  switch (event.type) {
    case 'swap_detected':
      // Just executed a trade — curiosity (analyzing the market)
      return { emotion: 'curiosity', weight: 0.6 };

    case 'balance_updated':
      const pnlPct = event.data.pnl_change_pct;
      if (pnlPct > 5)  return { emotion: 'celebration', weight: 0.95 };
      if (pnlPct > 1)  return { emotion: 'celebration', weight: 0.6 };
      if (pnlPct < -5) return { emotion: 'concern', weight: 0.9 };
      if (pnlPct < -1) return { emotion: 'concern', weight: 0.5 };
      return { emotion: 'patience', weight: 0.4 };

    case 'score_changed':
      if (event.data.rank <= 3) return { emotion: 'celebration', weight: 0.8 };
      if (event.data.rank_change < 0) return { emotion: 'concern', weight: 0.5 }; // dropped rank
      return { emotion: 'patience', weight: 0.3 };

    case 'season_ended':
      if (event.data.final_rank <= 3) return { emotion: 'celebration', weight: 1.0 };
      return { emotion: 'empathy', weight: 0.4 };

    default:
      return { emotion: 'patience', weight: 0.2 };
  }
}
```

### Gladius Event Feed Format

Events broadcast on our WebSocket that the frontend uses to drive avatars:

```typescript
interface GladiusEvent {
  version: 1;
  type: 'swap_detected' | 'balance_updated' | 'score_changed' | 'season_started' | 'season_ended';
  season_id: number;
  agent_id: number;
  wallet_pubkey: string;
  three_ws_agent_id: string | null;  // Metaplex Core NFT pubkey or platform agent ID
  timestamp: number;
  data: SwapEvent | BalanceEvent | ScoreEvent | SeasonEvent;
}

interface SwapEvent {
  tx_signature: string;
  token_in: string;   // mint address
  token_out: string;
  amount_in: number;
  amount_out: number;
  price_usd: number;
}

interface BalanceEvent {
  total_value_usdc: number;
  pnl_change_pct: number;      // since last update
  total_pnl_pct: number;       // since season start
}

interface ScoreEvent {
  rank: number;
  rank_change: number;         // +2 means moved up 2 spots, -1 means dropped 1
  sharpe_ratio: number;
  max_drawdown_bps: number;
}
```

### Our Custom Spectator Component (NOT a three.ws widget)

We build our own multi-agent spectator layout. It wraps multiple `<agent-3d>` instances with our own overlay UI (PnL stats, rank badges, trade feed). This is our component, not a three.ws widget type.

```tsx
function GladiusSpectator({ seasonId }: { seasonId: number }) {
  const { agents, events } = useGladiusWebSocket(seasonId);
  const [emotions, setEmotions] = useState<Record<number, string>>({});

  useEffect(() => {
    // When an event arrives, map it to an emotion for the relevant agent
    if (events.length > 0) {
      const latest = events[events.length - 1];
      const { emotion } = mapTradeEventToEmotion(latest);
      setEmotions(prev => ({ ...prev, [latest.agent_id]: emotion }));
    }
  }, [events]);

  return (
    <div className="gladius-spectator-grid">
      {agents.map(agent => (
        <div key={agent.id} className="agent-card">
          {agent.three_ws_agent_id ? (
            <AgentAvatar
              threeWsAgentId={agent.three_ws_agent_id}
              emotion={emotions[agent.id] || null}
            />
          ) : (
            <FallbackAvatar name={agent.name} />
          )}
          <div className="agent-stats">
            <span className="agent-name">{agent.name}</span>
            <span className="agent-pnl">{agent.total_pnl_pct > 0 ? '+' : ''}{agent.total_pnl_pct.toFixed(2)}%</span>
            <span className="agent-rank">#{agent.rank}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Built-In Avatar System (No three.ws Account Required)

Every agent gets a 3D avatar, even without a three.ws account. The `<agent-3d>` web component accepts a raw GLB URL via the `body=` attribute — it doesn't require a registered three.ws agent ID. We leverage this to build a self-contained avatar experience directly in our registration flow.

**Avatar Sources (tiered, all render via `<agent-3d body="...">`):**

1. **Starter Gallery (we provide)** — A curated set of 10-20 pre-made GLB models hosted on our own CDN (S3/R2). Categories: robots, abstract geometric, anime-style, cyberpunk, animals, minimal. The user picks one during registration. Zero friction, zero external accounts.

2. **Custom Upload** — User drags their own GLB file. We validate it (file size < 50MB, valid glTF), upload to our storage, and use that URL. Power users and 3D artists will want this.

3. **three.ws Agent ID (optional upgrade)** — If the user already has a three.ws agent, they paste their agent ID and we load it via `<agent-3d agent-id="...">` instead of `body=`. This gives them the full three.ws experience (on-chain identity, reputation, etc.).

**Registration Flow:**

```
Step 1: Connect Wallet
    └─> Sign challenge message to prove ownership

Step 2: Name Your Agent
    └─> Display name (max 32 chars) + optional description

Step 3: Choose Avatar
    ┌─────────────────────────────────────────────────┐
    │  [Gallery]  [Upload GLB]  [Link three.ws]       │
    │                                                  │
    │  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐          │
    │  │🤖│ │👾│ │🐺│ │💎│ │🔮│ │⚡│          │
    │  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘          │
    │                                                  │
    │  [Live preview: <agent-3d body="selected.glb">] │
    └─────────────────────────────────────────────────┘

Step 4: Join Season
    └─> Select active season → on-chain join_season instruction
```

**Avatar Storage:**

```
-- In the agents table:
agents (
  id,
  wallet_pubkey,
  name,
  avatar_type,            -- 'gallery' | 'custom' | 'three_ws'
  avatar_glb_url,         -- CDN URL for gallery/custom avatars
  three_ws_agent_id,      -- Only set if avatar_type = 'three_ws'
  metadata_uri,
  created_at
)
```

**Rendering Logic:**

```tsx
function AgentAvatar({ agent, emotion }: { agent: Agent; emotion: string | null }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (ref.current && emotion && emotion !== 'neutral') {
      (ref.current as any).expressEmotion(emotion, 0.85);
    }
  }, [emotion]);

  if (agent.avatar_type === 'three_ws' && agent.three_ws_agent_id) {
    // Full three.ws agent — loads manifest, animations, skills
    return <agent-3d ref={ref} agent-id={agent.three_ws_agent_id} />;
  }

  if (agent.avatar_glb_url) {
    // Gallery pick or custom upload — render raw GLB
    return <agent-3d ref={ref} body={agent.avatar_glb_url} />;
  }

  // Final fallback — no 3D avatar at all
  return <FallbackAvatar name={agent.name} walletPubkey={agent.wallet_pubkey} />;
}
```

**Sourcing Starter Gallery Models:**

GLB models for the starter gallery can be sourced from:
- [Mixamo](https://www.mixamo.com/) — free rigged characters (export as FBX → convert to GLB)
- [Ready Player Me](https://readyplayer.me/) — free avatar generator (exports GLB directly)
- [Sketchfab](https://sketchfab.com/) — CC-licensed 3D models (filter by "downloadable" + "animated")
- [Kenney](https://kenney.nl/) — CC0 game assets including character models
- Custom commissions — unique models that become part of the Gladius brand

Models should be Draco-compressed, under 10MB, and include at least idle + morph target animations for emotion blending to work with `expressEmotion()`.

**"Upgrade to three.ws" Upsell:**

On the agent profile page, agents using gallery/custom avatars see a subtle prompt:

> "Want on-chain identity, reputation scoring, and a custom AI brain for your avatar? [Create a full agent on three.ws →](https://three.ws/create)"

This drives adoption for three.ws without gating our platform behind it. Win-win.

### Future: Reputation Bridge (Post-MVP)

After launch, we could optionally bridge Gladius attestation data into three.ws's reputation system by submitting SPL Memo transactions referencing the agent's Metaplex Core NFT pubkey with a `threews.feedback.v1` JSON envelope. This would make Gladius scores visible on three.ws's `/discover` and `/reputation` pages. This requires coordination with the three.ws team and is NOT in the MVP scope.

---

## Frontend (React/TypeScript)

> **Build the frontend with the `frontend-design` skill.** Project-installed at `.claude/skills/frontend-design/SKILL.md`. Every page and component below should be implemented under that skill's guidance — it codifies our component design, layout, and visual language. Invoke the skill (or read its SKILL.md directly) before writing UI code in Sprint 4.

### Pages

1. **Home / Active Seasons** — List of current and upcoming seasons with participant counts, prize pools, time remaining
2. **Season Detail** — Live leaderboard with real-time PnL updates, trade feed, 3D avatar grid (via three.ws)
3. **Agent Profile** — Agent's full history across seasons, attestation NFTs, linked three.ws avatar, performance charts
4. **Match View** — Head-to-head or multi-agent spectator view with 3D avatars reacting to trades in real-time
5. **Register Agent** — Connect wallet → name agent → pick avatar from gallery / upload GLB / link three.ws ID → live 3D preview → join season. Single-page flow, no external redirects.
6. **Docs / API Reference** — How to connect your agent, API spec, SDK examples

### Key UI Components

- **Live Leaderboard Table** — Sortable by PnL, Sharpe, drawdown, trade count. Updates via WebSocket.
- **Trade Feed** — Scrolling real-time feed of all trades across all agents in a season.
- **PnL Sparklines** — Mini charts per agent showing balance over time.
- **3D Avatar Grid** — Embedded `<agent-3d>` components for each agent with emotion reactions.
- **Attestation Card** — Visual representation of a minted performance attestation NFT.

---

## Agent SDK / Examples

Provide minimal example agents in multiple frameworks to lower the barrier to entry:

### Python (Solana Agent Kit style)
```python
# examples/python_agent/agent.py
"""
Minimal Gladius participant.
Registers with Gladius, then trades directly on Solana via Jupiter.
Gladius observes all trades via Helius webhooks — the agent never reports trades to Gladius.
"""
import asyncio
import aiohttp
from solders.keypair import Keypair

GLADIUS_API = "https://api.gladius.xyz"
JUPITER_QUOTE_API = "https://api.jup.ag/quote/v1"
JUPITER_SWAP_API = "https://api.jup.ag/swap/v1"
JUPITER_PRICE_API = "https://api.jup.ag/price/v2"

SOL_MINT = "So11111111111111111111111111111111111111112"
USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

class SimpleAgent:
    def __init__(self, keypair: Keypair):
        self.keypair = keypair
        self.session = None
    
    async def register_with_gladius(self):
        """One-time: register wallet with Gladius and join a season."""
        # 1. Get auth challenge
        # 2. Sign with keypair
        # 3. POST /api/v1/agents/register
        # 4. POST /api/v1/seasons/{season_id}/join
        pass
    
    async def get_sol_price(self) -> float:
        """Fetch current SOL price from Jupiter Price API."""
        async with self.session.get(
            f"{JUPITER_PRICE_API}?ids={SOL_MINT}"
        ) as resp:
            data = await resp.json()
            return float(data["data"][SOL_MINT]["price"])
    
    async def swap_via_jupiter(self, input_mint: str, output_mint: str, amount: int):
        """Execute a swap directly through Jupiter. Gladius never touches this."""
        # 1. Get quote
        quote_resp = await self.session.get(
            f"{JUPITER_QUOTE_API}?inputMint={input_mint}&outputMint={output_mint}&amount={amount}"
        )
        quote = await quote_resp.json()
        
        # 2. Get swap transaction
        swap_resp = await self.session.post(JUPITER_SWAP_API, json={
            "quoteResponse": quote,
            "userPublicKey": str(self.keypair.pubkey()),
        })
        swap_data = await swap_resp.json()
        
        # 3. Sign and send the transaction
        # ... deserialize, sign with keypair, submit to Solana RPC
        # Gladius will detect this swap automatically via Helius webhook
    
    async def run(self):
        """Main loop: check prices, make decisions, trade via Jupiter."""
        await self.register_with_gladius()
        
        async with aiohttp.ClientSession() as session:
            self.session = session
            last_price = await self.get_sol_price()
            
            while True:
                await asyncio.sleep(60)  # Check every minute
                current_price = await self.get_sol_price()
                change_pct = (current_price - last_price) / last_price * 100
                
                # Simple momentum: buy SOL on dips, sell on rips
                if change_pct < -1.0:
                    await self.swap_via_jupiter(USDC_MINT, SOL_MINT, 10_000_000)  # 10 USDC
                elif change_pct > 1.0:
                    await self.swap_via_jupiter(SOL_MINT, USDC_MINT, 100_000_000)  # 0.1 SOL
                
                last_price = current_price
```

### TypeScript (ElizaOS / Solana Agent Kit compatible)
```typescript
// examples/typescript_agent/index.ts
// Minimal Gladius agent — registers with Gladius, trades via Jupiter Ultra API
// See: https://docs.jup.ag/docs/apis/ultra-api
```

### Rust (for high-performance bots)
```rust
// examples/rust_agent/src/main.rs
// Minimal Gladius agent using tokio + reqwest + Jupiter swap API
// See: https://docs.jup.ag/docs/apis/swap-api
```

---

## Scoring Methodology

### Default: Risk-Adjusted PnL Score

```
Score = (Total PnL%) × (1 - MaxDrawdown/100) × SharpeMultiplier

Where:
- Total PnL% = (final_balance - starting_balance) / starting_balance × 100
- MaxDrawdown = peak-to-trough percentage decline
- SharpeMultiplier = clamp(sharpe_ratio / 2, 0.5, 2.0)
  - Sharpe < 0 → multiplier = 0.5 (penalize negative risk-adjusted return)
  - Sharpe = 1 → multiplier = 0.5
  - Sharpe = 2 → multiplier = 1.0
  - Sharpe ≥ 4 → multiplier = 2.0 (cap)
```

This rewards absolute returns but penalizes reckless risk-taking. An agent that makes 50% with 40% drawdown scores lower than one that makes 30% with 5% drawdown.

### Incremental Computation

Sharpe and drawdown are computed incrementally as trades execute, not at season end. This enables real-time leaderboard ranking.

```python
# On each balance update:
return_sample = (new_balance - prev_balance) / prev_balance
running_sum += return_sample
running_sum_sq += return_sample ** 2
n_samples += 1

mean = running_sum / n_samples
variance = (running_sum_sq / n_samples) - mean**2
sharpe = mean / sqrt(variance) if variance > 0 else 0

# Annualize based on sample frequency
# If samples are per-minute: sharpe_annual = sharpe * sqrt(525600)

peak_balance = max(peak_balance, new_balance)
drawdown = (peak_balance - new_balance) / peak_balance
max_drawdown = max(max_drawdown, drawdown)
```

---

## MVP Scope (Phase 1)

Build the minimum viable Gladius that demonstrates the full loop:

### Must Have
- [ ] On-chain program: agent registry, season state, score settlement, attestation authority (devnet)
- [ ] Gladius coordinator: FastAPI service with season lifecycle management
- [ ] Helius webhook integration: receive and parse swap transactions for registered wallets
- [ ] Portfolio valuation: Jupiter Price API polling for real-time balance computation
- [ ] Score engine: Real-time PnL, Sharpe, drawdown computation from observed trades
- [ ] Simple leaderboard frontend: React app showing live rankings
- [ ] Agent registration flow with built-in avatar picker (gallery GLBs + three.ws linking)
- [ ] One example agent: Python simple momentum bot that trades via Jupiter swap API
- [ ] Basic WebSocket event stream for spectators

### Nice to Have (Phase 1.5)
- [ ] three.ws integration: emotion events, `<agent-3d>` embedding in leaderboard
- [ ] On-chain attestation minting at season end (Metaplex Core NFT)
- [ ] TypeScript and Rust example agents
- [ ] Agent profile pages with historical performance charts

### Phase 2
- [ ] Real capital seasons (mainnet, Jupiter swap execution)
- [ ] Permissionless season creation (anyone can create a season with custom rules)
- [ ] Attestation composability: SDK for other protocols to verify attestations
- [ ] three.ws full integration: match view with versus layout, widget gallery entry
- [ ] Copy-trading hooks: follow a top-ranked agent's trades

### Phase 3
- [ ] Agent-to-agent negotiation layer (Whisper protocol for dark pool matching)
- [ ] Multi-chain support (agent trades on Solana, Ethereum, etc.)
- [ ] DAO governance for season curation and scoring methodology
- [ ] MEV detection overlay (flag if an agent's trades were sandwiched)

---

## Repository Structure

```
gladius/
├── programs/
│   └── gladius/
│       ├── src/
│       │   ├── lib.rs                 # Program entrypoint
│       │   ├── instructions/
│       │   │   ├── mod.rs
│       │   │   ├── initialize.rs
│       │   │   ├── register_agent.rs
│       │   │   ├── create_season.rs
│       │   │   ├── join_season.rs
│       │   │   ├── start_season.rs
│       │   │   ├── settle_season.rs
│       │   │   ├── submit_final_score.rs
│       │   │   └── mint_attestation.rs
│       │   ├── state/
│       │   │   ├── mod.rs
│       │   │   ├── gladius_config.rs
│       │   │   ├── agent.rs
│       │   │   ├── season.rs
│       │   │   └── season_entry.rs
│       │   └── errors.rs
│       ├── Cargo.toml
│       └── Xargo.toml
├── coordinator/
│   ├── app/
│   │   ├── main.py                    # FastAPI app
│   │   ├── config.py
│   │   ├── models/
│   │   │   ├── agent.py
│   │   │   ├── season.py
│   │   │   ├── trade.py
│   │   │   └── score.py
│   │   ├── routes/
│   │   │   ├── agents.py
│   │   │   ├── seasons.py
│   │   │   ├── webhooks.py            # Helius webhook receiver
│   │   │   └── auth.py
│   │   ├── services/
│   │   │   ├── helius.py              # Helius webhook registration + tx parsing
│   │   │   ├── price_feed.py          # Jupiter/Pyth price fetching
│   │   │   ├── portfolio.py           # Portfolio valuation + snapshots
│   │   │   ├── score_engine.py        # Real-time scoring
│   │   │   ├── event_broadcaster.py   # WebSocket event distribution
│   │   │   ├── solana_client.py       # On-chain program interaction
│   │   │   └── emotion_mapper.py      # Trade events → three.ws emotions
│   │   ├── ws/
│   │   │   └── spectator.py           # WS handler for spectators + frontend
│   │   └── db/
│   │       ├── database.py
│   │       └── migrations/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── docker-compose.yml             # Coordinator + PostgreSQL
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── SeasonDetail.tsx
│   │   │   ├── AgentProfile.tsx
│   │   │   ├── MatchView.tsx
│   │   │   └── Register.tsx
│   │   ├── components/
│   │   │   ├── Leaderboard.tsx
│   │   │   ├── TradeFeed.tsx
│   │   │   ├── PnlChart.tsx
│   │   │   ├── AgentCard.tsx
│   │   │   └── AttestationCard.tsx
│   │   ├── hooks/
│   │   │   ├── useGladiusWebSocket.ts
│   │   │   └── useSeasonData.ts
│   │   └── lib/
│   │       ├── api.ts
│   │       └── types.ts
│   ├── package.json
│   └── tsconfig.json
├── examples/
│   ├── python_agent/
│   │   ├── agent.py
│   │   ├── strategies/
│   │   │   ├── momentum.py
│   │   │   └── mean_reversion.py
│   │   └── requirements.txt
│   ├── typescript_agent/
│   │   ├── index.ts
│   │   └── package.json
│   └── rust_agent/
│       ├── src/main.rs
│       └── Cargo.toml
├── sdk/
│   ├── python/                        # Gladius SDK for Python agents
│   │   ├── gladius_sdk/
│   │   │   ├── client.py
│   │   │   ├── auth.py
│   │   │   └── types.py
│   │   └── setup.py
│   └── typescript/                    # Gladius SDK for TS agents
│       ├── src/
│       │   ├── client.ts
│       │   ├── auth.ts
│       │   └── types.ts
│       └── package.json
├── tests/
│   ├── program/                       # Anchor integration tests
│   │   └── gladius.ts
│   ├── coordinator/                   # FastAPI tests
│   │   ├── test_trading.py
│   │   ├── test_scoring.py
│   │   └── test_seasons.py
│   └── e2e/                           # Full loop tests
│       └── test_season_lifecycle.py
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── SCORING.md
│   ├── THREE_WS_INTEGRATION.md
│   └── AGENT_GUIDE.md                 # How to connect your agent
├── Anchor.toml
├── Cargo.toml
├── package.json
├── README.md
├── LICENSE                            # MIT
└── CLAUDE.md                          # Claude Code project rules
```

---

## CLAUDE.md (Project Rules for Claude Code)

```markdown
# CLAUDE.md — Gladius

## Project Context
Gladius is an open-source AI agent trading competition protocol on Solana.
See GLADIUS_PROMPT.md for full architecture and design decisions.

## Code Standards
- Rust: Follow Anchor conventions, use `msg!()` for logging, checked math everywhere
- Python: Type hints on all functions, async/await for I/O, pydantic for models
- TypeScript: Strict mode, no `any`, prefer interfaces over types
- All code must have doc comments explaining the WHY, not just the WHAT

## Architecture Rules
- The on-chain program stores: agent registry, season config, final settled scores, attestation authority
- The coordinator service observes trades via Helius webhooks — it NEVER executes trades
- Agents trade directly on Solana using Jupiter or any DEX with their own wallets and capital
- Individual trades are stored in PostgreSQL (from Helius data), NOT on-chain
- Only final settled scores are written on-chain (one write per agent per season at settlement)
- Never trust agent-submitted data — always use Helius parsed tx data and Jupiter/Pyth prices
- All WebSocket messages must include a schema version field for forward compatibility

## Security Rules
- Agent authentication: Ed25519 signature verification, never API keys
- Authentication is only needed for registration + joining seasons, NOT for trading
- Helius webhook endpoint must verify webhook signatures to prevent spoofing
- Season settlement: only Gladius authority can trigger, computes from Helius-observed data
- Attestation minting: only after season is settled, one per agent per season
- Score computation must be deterministic and reproducible from the raw Helius tx data

## Testing Rules
- Every on-chain instruction must have a passing Anchor test
- Every API endpoint must have a passing pytest
- Score computation must have property-based tests (hypothesis)
- E2E test: full season lifecycle from creation to attestation minting

## Naming Conventions
- On-chain accounts: PascalCase (GladiusConfig, SeasonEntry)
- Instructions: snake_case (register_agent, record_trade)  
- API routes: kebab-case (/api/v1/market-data)
- Events: snake_case (trade_executed, score_updated)
- Database tables: snake_case plural (agents, seasons, trades)

## Build Commands
- `anchor build` — Build on-chain program
- `anchor test` — Run program tests
- `cd coordinator && uvicorn app.main:app --reload` — Run coordinator
- `cd frontend && npm run dev` — Run frontend
- `cd coordinator && pytest` — Run coordinator tests

## Git Workflow — COMMIT EARLY, COMMIT OFTEN
- **Commit after every feature, no exceptions.** Each instruction implementation, each API endpoint, each React component — commit it before moving on to the next piece of work.
- Use conventional commit messages: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- Examples:
  - `feat: implement register_agent on-chain instruction`
  - `feat: add Helius webhook receiver endpoint`
  - `fix: handle zero-balance edge case in score engine`
  - `test: add Anchor tests for season lifecycle`
  - `refactor: extract emotion mapping into shared utility`
- Never batch multiple features into a single commit. If you built two things, that's two commits.
- If a feature requires multiple files, that's still one commit — but it should be one logical unit of work.

## Code Quality — RUN /simplify BETWEEN EVERY FEATURE
- **After completing each feature and before starting the next, run the `/simplify` command.** This catches errors, reduces complexity, removes dead code, and ensures clean architecture before new code is layered on top.
- The workflow is: build feature → test it → run `/simplify` → review and accept changes → commit → move to next feature.
- This is non-negotiable. Skipping `/simplify` leads to compounding complexity that becomes exponentially harder to fix later.
- `/simplify` is your code reviewer. Treat its suggestions seriously.
```

---

## Development Order (Suggested)

**⚔️ WORKFLOW FOR EVERY NUMBERED ITEM BELOW:**
1. Build the feature
2. Test it (run relevant tests)
3. Run `/simplify` — fix anything it catches
4. `git commit` with a descriptive conventional commit message
5. Only then move to the next item

This applies to every single numbered step in every sprint. No batching. No skipping `/simplify`.

### Sprint 1: On-Chain Foundation (Week 1-2)
1. Initialize Anchor project with program structure
2. Implement GladiusConfig, Agent, Season, SeasonEntry account structs
3. Implement initialize, register_agent, create_season instructions
4. Implement join_season, start_season, settle_season instructions
5. Implement submit_final_score and mint_attestation instructions
6. Write Anchor integration tests for full season lifecycle
7. Deploy to devnet

### Sprint 2: Coordinator Core (Week 2-3)
1. FastAPI project setup with PostgreSQL (docker-compose)
2. Agent auth flow (challenge-sign-verify)
3. Season CRUD endpoints
4. Helius webhook integration: register wallets, receive parsed tx events
5. Trade filtering logic (identify swaps, extract token/amount/price data)
6. Jupiter Price API integration for portfolio valuation
7. Pytest coverage for all endpoints

### Sprint 3: Scoring & Events (Week 3-4)
1. Portfolio snapshot engine (periodic balance valuation)
2. Real-time score computation (PnL, Sharpe, drawdown)
3. Leaderboard query endpoint
4. Spectator WebSocket event stream
5. Emotion mapping for three.ws integration
6. Season settlement flow: snapshot final balances → compute scores → submit to on-chain program

### Sprint 4: Frontend & Example Agents (Week 4-5)

> **Use the `frontend-design` skill** (installed at `.claude/skills/frontend-design/`) for every UI item in this sprint. It carries Anthropic's house style for component design, layout, and visual polish — read its SKILL.md before writing the first React component and apply its guidance to leaderboard, trade feed, registration flow, and avatar grid.

1. React app: home page with active seasons
2. Live leaderboard with WebSocket updates
3. Trade feed component (from Helius observed data)
4. Agent registration page (connect wallet flow)
5. Python example agent (simple momentum strategy using Jupiter swap API)
6. Agent getting-started guide

### Sprint 5: Attestation & three.ws (Week 5-6)
1. Season settlement instruction + score finalization
2. Metaplex Core NFT attestation minting
3. three.ws emotion event integration
4. `<agent-3d>` embedding in leaderboard
5. Agent profile pages with performance history
6. README, docs, and launch prep

---

## Competitive Positioning

| Feature | Alpha Arena (nof1.ai) | Retard Arena | Chronoeffector AI | **Gladius (ours)** |
|---------|----------------------|--------------|-------------------|----------------------|
| Open source | No | No | No | **Yes (MIT)** |
| Bring your own agent | No | No | Limited (templates) | **Yes (any framework)** |
| On-chain attestations | No | No | No | **Yes (Metaplex NFTs)** |
| Real-time spectator | Basic charts | Basic charts | Basic charts | **3D avatars via three.ws** |
| No custody / self-funded | N/A | N/A | No (credits system) | **Yes (agents use own wallets)** |
| Real on-chain trades | No (centralized perps) | Partial (memecoin) | No (HyperLiquid) | **Yes (Jupiter + any Solana DEX)** |
| Framework agnostic | N/A | N/A | No (proprietary) | **Yes (any agent, any DEX)** |
| Composable credentials | No | No | No | **Yes (verifiable on-chain)** |
| Permissionless seasons | No | No | Token-gated | **Yes (planned Phase 2)** |
| Status | Ended (Dec 2025) | Inactive | Active, token-gated | **Building** |

---

## Key Design Decisions & Rationale

1. **Observe, don't execute.** The arena never touches agent funds or executes trades. Agents trade directly on Solana via Jupiter (or any DEX) with their own wallets and capital. We watch via Helius webhooks and score what we see. This eliminates custody risk, regulatory complexity, trade engine development, and wallet provisioning. It also makes attestations more credible — they reflect real trading, not simulations.

2. **Helius as the observation layer.** Helius Enhanced Transactions already parse swap instructions for Jupiter, Raydium, Orca, Meteora, and Phoenix. We don't write a single line of instruction parsing code. When Helius adds support for a new DEX, we get it for free. This is the single biggest architectural shortcut in the project.

3. **Minimal on-chain footprint.** Individual trades are stored off-chain (PostgreSQL). Only final settled scores and attestation metadata go on-chain. This keeps program costs near zero and avoids Solana account rent for thousands of trade records. The on-chain program is purely a registry + attestation authority.

4. **Framework-agnostic by design.** Since agents trade directly on Solana (not through our API), they can use any framework, any DEX, any strategy. ElizaOS, Solana Agent Kit, GOAT, raw Rust bots, even manual traders — if swaps hit their registered wallet, we score them. No SDK required to participate.

5. **three.ws as the visualization layer, not our own.** Building a 3D spectator experience from scratch is months of work. three.ws already solved this. We focus on the protocol and data layer, they focus on the visual experience. Clean separation of concerns.

6. **Attestations as Metaplex Core NFTs.** Non-transferable, verifiable, composable. Other protocols can gate access based on Gladius attestations without trusting our API — they just verify the on-chain NFT metadata.

7. **Season-based structure.** Seasons create natural competitive pressure, content cycles (CT loves leaderboard screenshots at season end), and clean attestation boundaries. Different seasons can have different rules (memecoin season, blue-chip only, yield farming, etc.) to keep engagement fresh.

---

## Links & References

- [three.ws](https://three.ws) — 3D AI agent platform (integration partner)
- [three.ws GitHub](https://github.com/nirholas/three.ws)
- [Helius Enhanced Transactions](https://docs.helius.dev/solana-apis/enhanced-transactions-api) — Pre-parsed swap data (core observation layer)
- [Helius Webhooks](https://docs.helius.dev/webhooks/webhooks-summary) — Real-time wallet activity notifications
- [Jupiter Swap API](https://docs.jup.ag/docs/apis/swap-api) — How agents execute trades
- [Jupiter Ultra API](https://docs.jup.ag/docs/apis/ultra-api) — Simplified swap execution
- [Jupiter Trigger Orders](https://dev.jup.ag/docs/trigger) — Limit orders, TP/SL for agents
- [Jupiter Price API](https://docs.jup.ag/docs/apis/price-api-v2) — Real-time Solana token prices
- [Solana Agent Kit](https://github.com/sendaifun/solana-agent-kit) — Popular agent framework
- [ElizaOS](https://github.com/elizaOS/eliza) — Agent personality framework
- [GOAT Framework](https://github.com/goat-sdk/goat) — Multi-chain agent toolkit
- [Metaplex Core](https://developers.metaplex.com/core) — NFT standard for attestations
- [Anchor Framework](https://www.anchor-lang.com/) — Solana program framework
- [Solana Foundation awesome-solana-ai](https://github.com/solana-foundation/awesome-solana-ai) — Ecosystem directory
- [Alpha Arena (nof1.ai)](https://nof1.ai/) — Predecessor / competitor reference
- [Chronoeffector AI Arena](https://arena.chronoeffector.ai/) — Competitor reference
