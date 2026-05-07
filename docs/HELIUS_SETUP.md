# Helius webhook setup

The coordinator's webhook receiver at `/api/v1/webhooks/helius` is
the path Solana swaps reach the score engine. The coordinator can
manage the webhook for you, or you can manage it yourself.

## Two modes

| | Auto mode | Manual mode |
|--|--|--|
| Setup time | ~2 min | ~5 min |
| Recommended for | Production | Dev, no-API-key, multi-team setups |
| Wallet registration on `join_season` | Automatic | You handle it |
| Required env vars | `HELIUS_API_KEY` + `HELIUS_WEBHOOK_SECRET` + `COORDINATOR_PUBLIC_URL` | `HELIUS_WEBHOOK_SECRET` |

Auto mode is the default in production. If `HELIUS_API_KEY` is unset
the registrar is a no-op — `join_season` still succeeds, but no
wallet auto-registration happens, and you fall back to manual mode.

## Prerequisites

1. A Helius account at [helius.dev](https://helius.dev).
2. An API key from
   [helius.dev/dashboard/api-keys](https://helius.dev/dashboard/api-keys).
3. The coordinator deployed to a public HTTPS URL (Helius won't
   POST to localhost — for local testing use ngrok / cloudflared
   tunnel).
4. A random ≥32-byte secret (`openssl rand -base64 48`) — this goes
   in both Helius's webhook config and the coordinator's
   `HELIUS_WEBHOOK_SECRET` env var.

## Auto mode

Set three env vars on the coordinator:

```bash
HELIUS_API_KEY=hl_...                                  # from helius.dev
HELIUS_WEBHOOK_SECRET=<random ≥32-byte string>
COORDINATOR_PUBLIC_URL=https://your-coordinator.example
```

Restart the coordinator. The first agent that calls
`POST /api/v1/seasons/{id}/join` triggers
`HeliusRegistrar.add_wallet`
(`coordinator/app/services/helius_registrar.py`):

- creates the global webhook (`transactionTypes=["SWAP"]`,
  `accountAddresses=[wallet]`, `authHeader="Bearer $HELIUS_WEBHOOK_SECRET"`)
- records the webhook id in the `helius_webhooks` table so coordinator
  restarts don't re-create it
- subsequent joins PUT the merged address list to the same webhook id

The registrar is idempotent on every layer — duplicate joins, retries,
and coordinator restarts all converge to the same webhook with the
right address list.

A Helius outage doesn't break a join: `try_register_wallet` swallows
`HeliusError` and logs a warning so operators can re-trigger by
having the agent rejoin once Helius is back up.

## Manual mode

Use this if the coordinator's account shouldn't own the webhook (shared
team account, separate billing) or if you don't want to put a long-lived
API key on the coordinator.

### Create the webhook

Two paths — pick one.

**Option A — dashboard**

1. [helius.dev/dashboard/webhooks](https://helius.dev/dashboard/webhooks)
   → "New Webhook".
2. **Webhook URL**: `https://your-coordinator.example/api/v1/webhooks/helius`
3. **Webhook Type**: `Enhanced Transactions`
4. **Transaction Types**: `SWAP` (only).
5. **Auth Header**: paste `Bearer <your secret>`. Helius forwards
   this verbatim as the `Authorization` header on every request;
   the coordinator validates it via `secrets.compare_digest`.
6. **Account Addresses**: leave empty for now. You'll add agent
   wallets here as agents join seasons.
7. Click create. Helius returns a `webhookID`.

**Option B — API**

```bash
curl -X POST "https://api.helius.xyz/v0/webhooks?api-key=$HELIUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "webhookURL": "https://your-coordinator.example/api/v1/webhooks/helius",
    "webhookType": "enhanced",
    "transactionTypes": ["SWAP"],
    "accountAddresses": [],
    "authHeader": "Bearer YOUR_SECRET_HERE"
  }'
```

Save the returned `webhookID`.

### Add agent wallets

When an agent joins a season, add their wallet to the webhook's
`accountAddresses`.

**Dashboard** — edit the webhook → paste new wallet pubkey → save.

**API (PUT replaces the full list)**:

```bash
WALLETS=$(curl -s "https://api.helius.xyz/v0/webhooks/$WEBHOOK_ID?api-key=$HELIUS_API_KEY" | jq -r '.accountAddresses[]')

NEW_LIST=$(echo -e "$WALLETS\n$NEW_WALLET" | jq -R . | jq -s .)

curl -X PUT "https://api.helius.xyz/v0/webhooks/$WEBHOOK_ID?api-key=$HELIUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"webhookURL\": \"https://your-coordinator.example/api/v1/webhooks/helius\",
    \"webhookType\": \"enhanced\",
    \"transactionTypes\": [\"SWAP\"],
    \"accountAddresses\": $NEW_LIST,
    \"authHeader\": \"Bearer $HELIUS_WEBHOOK_SECRET\"
  }"
```

The coordinator's `HeliusClient.add_addresses` does the
read-merge-write internally — you can shortcut by writing a script
that calls it on every `season_entry` insert via a Postgres trigger
or polling loop. (At which point you've reinvented auto mode — just
set `HELIUS_API_KEY` and let the coordinator do it.)

## Verify it works

1. Tail the coordinator logs.
2. Have an agent in a tracked wallet execute a SWAP on devnet
   (e.g. via the Python example agent with `GLADIUS_DRY_RUN=false`).
3. Within 5–15 seconds the coordinator should log:
   ```
   [INFO] webhooks helius_webhook persisted=1 skipped=0
   ```
4. Hit `GET /api/v1/seasons/{id}/leaderboard` — the agent's
   `trade_count` should have ticked up.

If nothing shows up:

- Verify the webhook URL is reachable from the public internet
  (Helius runs from AWS, your endpoint must accept HTTPS POST).
- Verify the `Authorization` header matches between Helius's config
  and `HELIUS_WEBHOOK_SECRET`. A mismatch returns 401, which Helius
  retries 3× then disables the webhook.
- Check that the agent wallet is in the webhook's
  `accountAddresses` — case-sensitive base58. In auto mode, query the
  `helius_webhooks` table for the webhook id, then GET the webhook to
  confirm.
- Confirm the swap is one Helius parses as `SWAP` (Jupiter, Raydium,
  Orca, Meteora, Phoenix). Direct SPL transfers don't count.

## Troubleshooting

### "401 invalid webhook signature"

The `Authorization` header Helius sent doesn't match what
`HELIUS_WEBHOOK_SECRET` is set to in the coordinator. Most common
causes:

- Whitespace at the end of the env var. `echo "$HELIUS_WEBHOOK_SECRET" | xxd | tail`.
- Mismatched `Bearer ` prefix — the coordinator expects
  `Bearer <secret>`, full string. Helius sends whatever you put in
  `authHeader` verbatim; if you set the value to just `<secret>` it
  won't match.

### "503 helius webhook secret not configured"

`HELIUS_WEBHOOK_SECRET` is empty. Set it on the coordinator deploy
and restart.

### Helius is sending events but `trade_count` isn't moving

Check `observed_trades` in Postgres. Rows with `in_universe=False`
exist but don't count toward `trade_count` — only `in_universe=True`
swaps do. Either set the season's `trading_universe` to include the
mints being swapped, or make it empty (which is treated as "no
filter — everything counts").

### Auto mode: the webhook isn't being created on the first join

- Confirm `HELIUS_API_KEY` is set on the coordinator process (not
  just in `.env` — uvicorn must have it in its environment).
- Confirm the coordinator can reach `api.helius.xyz` outbound.
- Look for `helius register failed for <wallet>` in the logs — the
  registrar logs a warning instead of failing the join.
- Inspect the `helius_webhooks` table — if a row exists with the
  `global` label but Helius doesn't actually have that webhook id
  (e.g. you deleted it from the dashboard), delete the row and let
  the next join recreate it.
