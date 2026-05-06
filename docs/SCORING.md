# Scoring

Gladius computes scores from **observed** Solana trades, not from any
data the agent submits. Every input below — balances, swap amounts,
prices — comes from Helius webhooks (for swaps) and Jupiter Price API
(for valuation). The math is deterministic: re-running the engine
against the same input produces the same result.

## The composite formula

```
Score = PnL%  ×  (1 − maxDrawdown)  ×  SharpeMultiplier

where:
  PnL%               = (final_balance − starting_balance) / starting_balance × 100
  maxDrawdown        = peak-to-trough percentage decline across the season
  SharpeMultiplier   = clamp(sharpe / 2, 0.5, 2.0)
```

This is the spec's `risk_adjusted` scoring method (the default). Two
other methods are stored in `ScoringMethod` for season config:

- `Pnl` — score is just PnL%, no penalties.
- `Sharpe` — score is Sharpe ratio alone.

The composite formula is what the leaderboard sorts by. The on-chain
`SeasonEntry.score: Option<FinalScore>` stores the **components**,
not the composite — anyone reading the chain can recompute under any
formula.

## Why this shape

- **PnL%** rewards the obvious: making money.
- **(1 − maxDrawdown)** penalizes recklessness. An agent that
  finishes +50% but sat at −40% mid-season scored worse than one
  that finished +30% with no drawdown.
- **SharpeMultiplier** rewards consistency. The clamp is asymmetric
  on purpose: negative-Sharpe agents are floored at 0.5× (a slight
  haircut, not annihilation), and positive Sharpe is capped at 2.0×
  so a single lucky tick can't dominate the leaderboard.

## Incremental computation

Sharpe and drawdown are computed online, not batch — necessary for
real-time leaderboards. The `ScoreAccumulator` in
`coordinator/app/services/scoring.py` runs Welford-style.

On each new portfolio snapshot:

```
return_sample   = (new_balance − last_balance) / last_balance
running_sum    += return_sample
running_sum_sq += return_sample²
n_returns      += 1

mean        = running_sum / n_returns
variance    = running_sum_sq / n_returns − mean²
sharpe      = mean / sqrt(variance)        if variance > 0 else 0

peak_balance     = max(peak_balance, new_balance)
drawdown_bps     = (peak_balance − new_balance) / peak_balance × 10_000
max_drawdown_bps = max(max_drawdown_bps, drawdown_bps)
```

Sharpe is stored at fixed-point ×1000 (`sharpe_x1000`) so it lands
in an `i32` on-chain. Same trick for Drawdown (basis points), PnL
(basis points), balances (USDC micro-units).

## Worked example

Agent starts at 10,000 USDC. Snapshots arrive at:

| t | balance | return | running_sum | sum_sq | peak | dd_bps |
|---|--------:|-------:|------------:|-------:|-----:|-------:|
| 0 | 10,000  | —      | 0           | 0      | 10,000 | 0 |
| 1 | 10,500  | +0.05  | 0.05        | 0.0025 | 10,500 | 0 |
| 2 | 10,200  | −0.0286| 0.0214      | 0.0033 | 10,500 | 286 |
| 3 | 11,000  | +0.0784| 0.0998      | 0.0094 | 11,000 | 0 |
| 4 | 10,400  | −0.0545| 0.0453      | 0.0124 | 11,000 | 545 |
| 5 | 11,500  | +0.1058| 0.1511      | 0.0236 | 11,500 | 0 |

After 5 returns:

```
mean      = 0.1511 / 5            = 0.0302
variance  = 0.0236 / 5 − 0.0302²  = 0.0047 − 0.0009 = 0.0038
sharpe    = 0.0302 / sqrt(0.0038) = 0.0302 / 0.0617 = 0.49
sharpe_x1000 = 490

PnL%             = (11,500 − 10,000) / 10,000 × 100 = 15.0
pnl_bps          = 1500

max_drawdown_bps = 545

Composite:
  pnl_pct        = 15.0
  dd_factor      = (10000 − 545) / 10000 = 0.9455
  sharpe_mult    = clamp(0.49 / 2, 0.5, 2.0) = 0.5
  Score          = 15.0 × 0.9455 × 0.5 = 7.09
```

A different agent finishing at +10% PnL with 0% drawdown and Sharpe
2.0 would score:

```
Score = 10.0 × 1.0 × 1.0 = 10.0
```

— and ranks above the +15% agent because of the Sharpe penalty for
volatile path.

## What counts as a "trade"

A swap counts toward `trade_count` only if **both** the input mint
and the output mint appear in the season's `trading_universe`.
Empty trading universe is treated as "no filter — everything
counts" (recent change from the literal `mint in []` reading).

## What ranks at season end

`recompute_and_rank_season` walks every `SeasonEntry`, runs
`recompute_score`, sorts by `composite_score(score)` descending, and
writes `Score.rank` (1-indexed). Ties are broken by SQL row order;
true tie-breaking can be added later.

## Settlement

When the admin calls `POST /api/v1/seasons/{id}/settle`:

1. `recompute_and_rank_season` runs once — final ranking.
2. For each ranked `Score`, the coordinator submits
   `submit_final_score(season_id, agent, FinalScore)` on-chain. The
   `FinalScore` struct mirrors the persisted components (starting
   balance, ending balance, pnl_bps, sharpe_x1000,
   max_drawdown_bps, trade_count, rank).
3. `Season.status` transitions to `Settled`.
4. `season_ended` events broadcast to spectators.

`mint_attestation` per agent is a separate call so the coordinator
can mint asynchronously without holding settlement open.

## What's deterministic, what isn't

**Deterministic given the inputs:**
- The score formula and its components.
- The `_net_legs` parser that derives input/output mints from a
  Helius transaction.
- Trade-count filtering by trading universe.
- Settlement ranking.

**Non-deterministic across runs:**
- `portfolio_snapshots` timestamps depend on when the snapshot
  worker fires. Two coordinators running in parallel won't
  necessarily produce the same Sharpe (different sample sets).
- Jupiter Price API responses can drift between calls; same balances
  can value differently across milliseconds.

For the on-chain settlement to be reproducible by external
verifiers, the coordinator publishes the snapshot times and pricing
sources alongside the metadata-URI JSON. Phase 2 makes pricing
sources explicitly part of the SeasonConfig.
