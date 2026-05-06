# Contributing to Gladius

Thanks for considering a contribution. Gladius is open-source MIT —
all contributions are welcome.

## What we welcome

- **Bug reports.** [Open an issue](../../issues/new) with a clear
  reproduction. The more specific, the better.
- **Strategy improvements.** The example agents under `examples/`
  ship with placeholder momentum strategies. PRs that demonstrate
  alternate approaches (mean-reversion, RSI, sentiment-driven, ML)
  are great learning material.
- **Score engine refinements.** The risk-adjusted formula in
  `coordinator/app/services/scoring.py` is intentionally simple. If
  you have a better scoring function, propose it as a new
  `ScoringMethod` variant — keep the existing one for backwards
  compatibility.
- **Three.ws emotion mappings.** Open `services/emotion_mapper.py`
  and propose better trigger/weight tuples for any of the event
  types. The avatars come alive when these are good.
- **Docs improvements.** If something in `docs/` is unclear or
  wrong, fix it — small docs PRs are welcome.

## Development workflow

The project uses a per-feature commit pattern enforced through
`CLAUDE.md`:

1. Build the feature.
2. Test it (`anchor test` for on-chain, `pytest` for coordinator,
   `npm run build` for frontend).
3. Run [`/simplify`](../../tree/main/.claude) — code review pass
   that catches reuse, quality, and efficiency issues.
4. Commit with a [conventional commit](https://www.conventionalcommits.org/)
   message (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`).

Each numbered step in `GLADIUS_PROMPT.md` § Development Order is its
own commit. No batching.

## Local setup

### Toolchain

- Python 3.12+
- Node 20+ (Node 22 LTS recommended)
- Rust + Solana CLI + Anchor — easiest via WSL Ubuntu using
  [`scripts/setup-wsl-toolchain.sh`](../scripts/setup-wsl-toolchain.sh)

### First-time

```bash
git clone https://github.com/humanoidrobot-glitch/Gladius-Arena
cd Gladius-Arena

# Coordinator
cd coordinator
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest                              # 95 tests, should all pass
cd ..

# Frontend
cd frontend
npm install
npm run build
cd ..

# On-chain (requires WSL Ubuntu + Solana toolchain)
anchor build
anchor test                          # 11 tests against local validator
```

## Testing rules

From `CLAUDE.md`:

- **Every on-chain instruction must have a passing Anchor test.**
- **Every API endpoint must have a passing pytest.**
- **Score computation must have property-based tests (hypothesis).**
  See `tests/test_scoring.py::test_accumulator_invariants`.
- **E2E test:** full season lifecycle is covered by
  `tests/program/gladius.ts`.

PRs that break tests don't merge. PRs that add features without
tests get review feedback before approval.

## Style

- **Rust:** Anchor conventions, `msg!()` for logging, checked math
  everywhere.
- **Python:** type hints on all public functions, async/await for
  I/O, pydantic for models, `ruff` clean.
- **TypeScript:** strict mode, no `any`, prefer interfaces over
  types where they're equivalent.
- **Default to no comments.** Add a comment only when the WHY is
  non-obvious (a hidden constraint, a workaround for a specific bug,
  an invariant that's not visible from identifiers).

## Commit messages

Follow [conventional commits](https://www.conventionalcommits.org/).
Subject line ≤72 chars, lowercase, no period. Body explains the
WHY, not the WHAT — git already knows the diff.

```text
feat: clamp Sharpe multiplier asymmetrically

Negative Sharpe was killing rank for agents who finished green but
took a volatile path. The new clamp floors at 0.5x instead of
collapsing the score, while keeping the 2.0x ceiling so a single
lucky tick can't dominate.
```

## Architecture rules (from CLAUDE.md)

These are non-negotiable:

- The on-chain program stores: agent registry, season config, final
  settled scores, attestation authority. **Nothing else.**
- The coordinator service observes trades via Helius webhooks. **It
  NEVER executes trades.**
- Individual trades live in PostgreSQL (from Helius data),
  **NOT on-chain.**
- Only final settled scores are written on-chain (one write per
  agent per season at settlement).
- Never trust agent-submitted data — always use Helius parsed tx
  data and Jupiter/Pyth prices.
- All WebSocket messages must include a schema version field for
  forward compatibility.

PRs that violate these get closed.

## Security

If you find a vulnerability, **do not open a public issue.** Email
the maintainer (see git log) or open a private security advisory on
GitHub. We'll respond within 72 hours.

## License

All contributions are licensed under MIT to match the project. By
opening a PR you agree to license your contribution under those
terms.
