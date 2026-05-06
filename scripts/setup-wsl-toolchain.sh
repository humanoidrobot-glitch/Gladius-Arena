#!/usr/bin/env bash
# One-shot installer for Solana CLI + Anchor 0.31.1 inside WSL Ubuntu.
# Idempotent — safe to re-run.
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

log() { printf '\n=== %s ===\n' "$*"; }

log "system packages"
apt-get update -qq
apt-get install -y -qq \
  build-essential pkg-config libssl-dev libudev-dev libclang-dev \
  curl git ca-certificates

log "rust toolchain"
if [ ! -d "$HOME/.cargo" ]; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --default-toolchain stable --profile minimal
fi
# shellcheck disable=SC1091
source "$HOME/.cargo/env"

log "solana CLI"
if ! command -v solana >/dev/null 2>&1; then
  sh -c "$(curl -sSfL https://release.anza.xyz/v2.1.0/install)"
fi
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
if ! grep -q 'solana/install/active_release' "$HOME/.bashrc" 2>/dev/null; then
  echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' \
    >> "$HOME/.bashrc"
fi

log "anchor 0.31.1 via avm"
if ! command -v avm >/dev/null 2>&1; then
  cargo install --locked --git https://github.com/coral-xyz/anchor avm
fi
avm install 0.31.1
avm use 0.31.1

log "devnet wallet"
solana config set --url devnet >/dev/null
mkdir -p "$HOME/.config/solana"
if [ ! -f "$HOME/.config/solana/id.json" ]; then
  solana-keygen new --no-bip39-passphrase --silent \
    --outfile "$HOME/.config/solana/id.json"
fi

WALLET=$(solana-keygen pubkey "$HOME/.config/solana/id.json")
echo "wallet: $WALLET"

log "airdrop (devnet faucet — may rate-limit)"
solana airdrop 2 || echo "airdrop deferred — retry with 'solana airdrop 2' later"

log "versions"
rustc --version
solana --version
anchor --version

log "DONE"
