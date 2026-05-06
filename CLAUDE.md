# CLAUDE.md — Gladius

## Project Context
Gladius is an open-source AI agent trading competition protocol on Solana. See `GLADIUS_PROMPT.md` for full architecture and design decisions — that document is the source of truth.

## Architecture (the rule that drives every other rule)
Gladius **observes**, never executes. Agents trade on Solana directly via Jupiter (or any DEX) with their own wallets and capital. Helius webhooks feed parsed swap data to our coordinator, which scores and broadcasts. The on-chain program is a **registry + attestation authority**, not a trade engine.

Concrete consequences:
- The on-chain program stores: agent registry, season config, final settled scores, attestation authority. Nothing else.
- The coordinator service observes trades via Helius webhooks — it NEVER executes trades.
- Individual trades live in PostgreSQL (from Helius data), NOT on-chain.
- Only final settled scores are written on-chain (one write per agent per season at settlement).
- Never trust agent-submitted data — always use Helius parsed tx data and Jupiter/Pyth prices.
- All WebSocket messages must include a schema version field for forward compatibility.

## Code Standards
- Rust: Anchor conventions, `msg!()` for logging, checked math everywhere.
- Python: type hints on all public functions, async/await for I/O, pydantic for models.
- TypeScript: strict mode, no `any`, prefer interfaces over types.
- Default to no comments. Add one only when the WHY is non-obvious.

## Security Rules
- Agent authentication: Ed25519 signature verification, never API keys.
- Authentication is only needed for registration + joining seasons, NOT for trading.
- Helius webhook endpoint must verify webhook signatures to prevent spoofing.
- Season settlement: only Gladius authority can trigger; computes from Helius-observed data.
- Attestation minting: only after season is settled, one per agent per season.
- Score computation must be deterministic and reproducible from raw Helius tx data.

## Testing Rules
- Every on-chain instruction must have a passing Anchor test.
- Every API endpoint must have a passing pytest.
- Score computation must have property-based tests (hypothesis).
- E2E test: full season lifecycle from creation to attestation minting.

## Naming Conventions
- On-chain accounts: PascalCase (`GladiusConfig`, `SeasonEntry`).
- Instructions: snake_case (`register_agent`, `submit_final_score`).
- API routes: kebab-case (`/api/v1/market-data`).
- Events: snake_case (`swap_detected`, `score_changed`).
- Database tables: snake_case plural (`agents`, `seasons`).

## Build Commands
- `anchor build` — Build on-chain program
- `anchor test` — Run program tests
- `cd coordinator && uvicorn app.main:app --reload` — Run coordinator
- `cd coordinator && pytest` — Run coordinator tests
- `cd frontend && npm run dev` — Run frontend

## Workflow — for every feature
1. Build the feature.
2. Test it.
3. Run `/simplify` — review and accept changes.
4. `git commit` with a conventional message.
5. Move to next item.

No batching. No skipping `/simplify`. Each numbered sprint item is its own commit.

## Commit message style (conventional commits)
- `feat:` new feature
- `fix:` bug fix
- `refactor:` code change without behavior change
- `test:` adding or updating tests
- `docs:` documentation only
- `chore:` tooling, dependencies, build config

Examples:
- `feat: implement register_agent on-chain instruction`
- `feat: add Helius webhook receiver endpoint`
- `fix: handle zero-balance edge case in score engine`

If a feature touches multiple files but is one logical unit, that's still one commit.

## Build environment
Solana/Anchor builds are unreliable on bare Windows. Use WSL Ubuntu for `anchor build` / `anchor test` / `solana` CLI work. Coordinator (Python) and frontend (Node) work fine on Windows native or WSL.
