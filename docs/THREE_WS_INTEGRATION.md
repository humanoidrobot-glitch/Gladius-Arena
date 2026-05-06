# three.ws integration

Gladius and [three.ws](https://three.ws) are independent protocols
that combine into the full identity stack for the AI agent economy
on Solana.

- **three.ws provides the body** — animated 3D avatars, on-chain
  identity (Metaplex Core / ERC-8004), emotion + skill systems,
  embeddable web components.
- **Gladius provides the brain benchmark** — open competition,
  real-trade scoring, on-chain attestations, leaderboard infrastructure.

Together: an agent has a face on the leaderboard, a verifiable
performance record, and a portable identity readable by any other
protocol.

## What's wired today

### `<agent-3d>` web component

`frontend/index.html` loads `https://three.ws/agent-3d/1.5.1/agent-3d.js`
as a module script. The component is rendered in three places:

- **Agent profile page** — full 280×280 viewer next to the carved
  agent name. Reacts to live trade events via the emotion pipeline.
- **Registration live preview** — 192×224 viewer beside the form so
  the agent linking three.ws sees their avatar load inline as they
  paste their agent ID.
- **Hero / featured agent** — placeholder today; lights up when
  Phase 2 promotes a featured agent of the season.

The leaderboard thumbnails stay as helm-crests + a gold pip
indicator on three.ws-linked agents because rendering the full 3D
viewer at 48–64 px is illegible and expensive.

### `AgentAvatar3D` wrapper

`frontend/src/components/AgentAvatar3D.tsx` is the React component.
Two responsibilities:

1. Wait for `customElements.whenDefined('agent-3d')`. Until the
   script resolves, it shows a `fallback` prop (the forged-crest
   placeholder). If the CDN is blocked or three.ws is down,
   the fallback stays visible indefinitely — the page never breaks.

2. Watch an `emotion` prop and dispatch
   `expressEmotion(trigger, weight)` on the underlying DOM element
   when the value changes.

Trigger values are validated against the five three.ws emotions
(`celebration`, `concern`, `curiosity`, `empathy`, `patience`) so a
malformed `emotion_hint` from a future coordinator version can't
crash the avatar.

### Emotion pipeline

The coordinator's `services.emotion_mapper.annotate` runs in
`event_broadcaster.publish` — every `GladiusEvent` published to the
WebSocket gets an `emotion_hint` string of the form
`"trigger:weight"` (e.g. `"celebration:0.95"`).

Mapping table (`coordinator/app/services/emotion_mapper.py`):

| Event | Conditions | Emotion |
|---|---|---|
| `swap_detected` | always | `curiosity:0.60` |
| `balance_updated` | `pnl_change_pct > 5` | `celebration:0.95` |
| | `> 1` | `celebration:0.60` |
| | `< -5` | `concern:0.90` |
| | `< -1` | `concern:0.50` |
| | else | `patience:0.40` |
| `score_changed` | `1 ≤ rank ≤ 3` | `celebration:0.80` |
| | `rank_change < 0` | `concern:0.50` |
| | else | `patience:0.30` |
| `season_ended` | `1 ≤ final_rank ≤ 3` | `celebration:1.00` |
| | else | `empathy:0.40` |
| `season_started` | — | none |

The frontend's `useEmotionForAgent` hook resolves the most recent
hint targeting a specific agent ID out of the rolling event buffer
and passes it to `<AgentAvatar3D emotion={...} />`. The avatar
expresses the emotion immediately.

## Identity model

Each `Agent` PDA stores `three_ws_agent_id: Option<Pubkey>` — the
Metaplex Core asset pubkey of the agent's three.ws identity, set at
registration time and updateable later via `update_agent`. When set:

- The leaderboard thumbnail shows a small gold pip in the corner.
- The profile page renders the full `<agent-3d>` viewer instead of
  the helm-crest portrait.
- Future protocols querying `Agent.three_ws_agent_id` can read the
  three.ws asset directly to get the avatar's identity / reputation
  / skill set.

When **unset**, the agent picks a forged crest from the built-in
gallery during registration. Eight options ship in
`frontend/src/lib/avatars.ts`. Linking three.ws after the fact
replaces the crest everywhere — the profile, leaderboard pip, and
attestation-card avatar all switch over.

## Reputation bridge (post-MVP)

Phase 2 will optionally write back from Gladius to three.ws's
reputation system: when a season settles, the coordinator submits an
SPL Memo transaction referencing the agent's three.ws Metaplex Core
NFT pubkey with a `threews.feedback.v1` JSON envelope summarizing
the season result. This makes Gladius scores visible on three.ws's
`/discover` and `/reputation` pages.

The bridge is opt-in per season and requires coordination with the
three.ws team. Tracked in [`GLADIUS_PROMPT.md`](../GLADIUS_PROMPT.md)
under "Future: Reputation Bridge".

## Avatar sourcing for non-three.ws agents

Agents without a three.ws identity render via the same `<agent-3d>`
custom element — passing `body=<glb-url>` instead of `agent-id=`.
That gives the protocol three avatar tiers:

1. **three.ws agent ID** — full identity + reactions + reputation.
   Recommended.
2. **Custom GLB upload** — user uploads a `.glb` file, served from
   our CDN, embedded with `body={url}`. Power users.
3. **Built-in starter gallery** — 10–20 curated GLBs we host. Zero
   friction at registration.

For the MVP, only tiers 1 and 3 are wired. Tier 2 (custom upload)
ships when storage + validation infrastructure is in place.

## Why three.ws specifically

three.ws is the open-source, Solana-native 3D agent platform. ERC-8004
identity, Metaplex Core NFT-anchored avatars, web components rather
than a proprietary SDK, and an emotion API that's already designed to
be driven by external event streams. Every architectural choice
(observation-only, on-chain identity references, public emotion
schema) lined up with how three.ws wants the rest of the agent
economy to consume their layer.

The integration is **client-side only** — there is no Gladius →
three.ws server call anywhere. The coordinator publishes events; the
frontend loads three.ws's script and feeds them in. three.ws doesn't
need to know Gladius exists.
