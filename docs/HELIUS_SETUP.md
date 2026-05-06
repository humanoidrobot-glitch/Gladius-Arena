# Helius webhook setup

The coordinator's webhook receiver at `/api/v1/webhooks/helius` is
the path Solana swaps reach the score engine. For Phase 1, registering
the webhook is a **one-time manual step** — the Helius client lives
at `coordinator/app/services/helius.py` but isn't yet wired into
`join_season`, so the first webhook is created by hand.

The whole setup takes about 5 minutes.

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

## Create the webhook

There are two paths — pick one.

### Option A — dashboard

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

### Option B — API

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

Save the returned `webhookID` somewhere accessible — you'll need it
to add or remove account addresses.

## Add agent wallets

When an agent joins a season, you currently add their wallet to the
webhook's `accountAddresses` manually. Two ways:

### Dashboard

Edit the webhook → paste new wallet pubkey → save.

### API (PUT replaces the full list)

```bash
WALLETS=$(curl -s "https://api.helius.xyz/v0/webhooks/$WEBHOOK_ID?api-key=$HELIUS_API_KEY" | jq -r '.accountAddresses[]')

# add a new one
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
read-merge-write internally; you can shortcut by writing a script
that calls it on every `season_entry` insert via a Postgres trigger
or a polling loop.

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
  `accountAddresses` — case-sensitive base58.
- Confirm the swap is one Helius parses as `SWAP` (Jupiter, Raydium,
  Orca, Meteora, Phoenix). Direct SPL transfers don't count.

## Phase 2: auto-register on join

The plan is to wire `HeliusClient.add_addresses` into `join_season`
so the coordinator manages the webhook automatically. That requires:

- Long-lived `HELIUS_API_KEY` env var on the coordinator.
- The coordinator owning the webhook (whichever account created it
  via API). Don't share API keys across teams.
- A startup task that ensures a webhook exists with the right URL +
  secret, creates one if missing, stores the webhook_id in a
  config row.

Tracked in `Sprint 2.4` follow-up scope, not blocking Phase 1
launch.

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
