# Deployment

Three independent components ship at three different speeds:

| Component | Where it runs | Cadence | Hard requirements |
|---|---|---|---|
| On-chain program | Solana devnet/mainnet | Once per release | Anchor + Solana CLI, ~3 SOL on the deployer wallet |
| Coordinator | Anywhere that runs Python + Postgres | Every PR | Python 3.12+, PostgreSQL 16+, public HTTPS for Helius webhooks |
| Frontend | Static hosting (Vercel / Netlify / etc.) | Every PR | Node 20+ for the build |

All three can deploy independently. The coordinator and frontend can
be redeployed without touching on-chain state; the on-chain program
upgrades require a `solana program deploy` against the same program
ID with the original deployer keypair.

## On-chain program

### Initial deploy

Done. The program is live at
`6R9YnVRjEryqxDbE4p6PQvP6PaPuXKhntojAU7RzmSDA` on devnet under the
deployer wallet `8u8ZnyZXDvL99avsn6pfLZ3dFGWFwJBksJz3xJqmvFSr`. The
keypair lives at `~/.config/solana/id.json` on the developer's WSL
machine — do **not** commit it.

For a fresh deploy on a new chain or new program ID, see
`scripts/setup-wsl-toolchain.sh` for the toolchain bootstrap, then:

```bash
anchor build
anchor keys sync                              # only on first build
anchor deploy --provider.cluster devnet
```

### Upgrades

Anchor builds a new `gladius.so` and the upgrade authority (currently
the deployer keypair) submits it via:

```bash
anchor upgrade target/deploy/gladius.so \
  --program-id 6R9YnVRjEryqxDbE4p6PQvP6PaPuXKhntojAU7RzmSDA \
  --provider.cluster devnet
```

A program upgrade costs ~2 SOL and atomically replaces the executable
without disturbing existing PDAs. Existing `Agent`, `Season`,
`SeasonEntry` accounts continue to work as long as the schema is
compatible — the `#[derive(InitSpace)]` discriminator catches schema
breaks at deserialization time, not silently.

For mainnet, transfer the upgrade authority to a multisig the day of
launch:

```bash
solana program set-upgrade-authority <PROGRAM_ID> --new-upgrade-authority <MULTISIG>
```

After that, future upgrades require multisig signatures.

## Coordinator (FastAPI + Postgres)

### Local dev

```bash
cd coordinator
docker compose up --build       # postgres + coordinator
# or
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Runs at `http://localhost:8000`.

### Production targets

Any Python-friendly platform works. The Dockerfile is platform-agnostic.

**Fly.io:**

```bash
cd coordinator
fly launch                       # creates app + Postgres add-on
fly deploy
fly secrets set \
  HELIUS_API_KEY=...  HELIUS_WEBHOOK_SECRET=...  \
  JWT_SECRET=$(openssl rand -base64 48) \
  ADMIN_WALLET=8u8ZnyZX...vFSr
```

**Render.com:**

Connect the repo, point the service at `coordinator/Dockerfile`,
attach a managed Postgres, set the env vars in the dashboard.

**Railway / Heroku-style buildpacks:**

```bash
heroku create gladius-coordinator
heroku addons:create heroku-postgresql
git subtree push --prefix coordinator heroku main
```

### Required env vars

| Var | Purpose |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://...` |
| `JWT_SECRET` | ≥32-byte random string. Generate with `openssl rand -base64 48` |
| `ADMIN_WALLET` | Base58 pubkey allowed to call admin-only endpoints (create_season, settle, etc.) |
| `HELIUS_API_KEY` | From [dashboard.helius.dev](https://dashboard.helius.dev) → API Keys |
| `HELIUS_WEBHOOK_SECRET` | Random ≥32-byte token Helius will echo back as the `Authorization` header |
| `HELIUS_WEBHOOK_URL` | Public URL of the coordinator: `https://api.gladius.xyz/api/v1/webhooks/helius` |
| `RPC_URL` | Solana RPC. Devnet works for testing, premium provider (Helius / Triton) for prod |

### First-time setup tasks

After the coordinator is running but before agents can join:

1. **Run alembic migrations.** `alembic upgrade head` from the
   coordinator container.
2. **Initialize the on-chain config.** Call the program's
   `initialize` instruction (see `tests/program/gladius.ts` for an
   example) once. Sets the global authority + treasury.
3. **Register the Helius webhook.** See
   [`HELIUS_SETUP.md`](./HELIUS_SETUP.md) — for Phase 1 this is a
   manual one-time setup.
4. **Create the first season.** `POST /api/v1/seasons` with admin
   auth. Run `start_season` on-chain and via your admin script.

## Frontend

Static React app — any host that serves `dist/` works.

### Local dev

```bash
cd frontend
npm install
npm run dev
```

Runs at `http://localhost:5173`. Vite proxies `/api` and `/ws` to
`localhost:8000` for local end-to-end testing against the coordinator.

### Production build

```bash
npm run build           # → dist/
```

`dist/` is a static SPA. Configure your host to fall back to
`index.html` for SPA routing.

### Vercel

```bash
vercel --prod
```

`vercel.json` is not currently committed; the default Vite preset
works, just set the project root to `frontend/`.

Set env vars at build time:

| Var | Purpose |
|---|---|
| `VITE_API_BASE` | e.g. `https://api.gladius.xyz` (the coordinator) |

Vite-time env handling: read `import.meta.env.VITE_API_BASE` in your
fetch helper. Today the frontend uses Vite's dev proxy and relative
paths, so production needs an explicit `VITE_API_BASE` to know where
the coordinator lives.

### Netlify

Connect the repo, set base directory to `frontend/`, build command to
`npm run build`, publish directory to `frontend/dist`. Add a
redirects file for SPA fallback:

```text
# frontend/public/_redirects
/*  /index.html  200
```

## Operational notes

### Coordinator backups

The `agents`, `season_entries`, `observed_trades`,
`portfolio_snapshots`, and `scores` tables are derivable from
on-chain state plus Helius's recorded transaction history — but
re-deriving them takes time. Run nightly Postgres backups and
restore them on disaster.

### Coordinator scaling

The `EventBroadcaster` and `nonce_store` are in-process. Multiple
coordinator replicas behind a load balancer will fan-out events
inconsistently and orphan nonces. Two paths:

1. **Single-replica** — fine for Phase 1 traffic. Use a hot
   secondary that Postgres replicates to and a graceful failover.
2. **Multi-replica** — promote `EventBroadcaster` to Redis pub/sub
   and `nonce_store` to a Redis-backed key-value store with TTL.
   Both are clean swaps; the interface in `app/services/` doesn't
   leak the in-process implementation to callers.

### Frontend caching

Vite emits hashed asset filenames so caching them aggressively
(`max-age=31536000, immutable`) is safe. The `index.html` should
have `Cache-Control: no-cache` so SPA route changes deploy
immediately.

### Monitoring

Phase 1 ships with structured Python logging only. For production:

- Wire `/api/v1/health/ready` into the platform's health-check loop.
- Pipe logs to your aggregator of choice (Datadog / Grafana Cloud /
  Logtail). The coordinator already uses module-scoped loggers.
- Add Sentry or an equivalent error tracker before public launch —
  one line in `app/main.py`'s `create_app`.

The score engine is the hottest code path in real seasons (per-trade
recompute). Watch its p99 latency and tune
`GLADIUS_POLL_INTERVAL_SECONDS` on the example agents accordingly.
