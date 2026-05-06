import { useEffect, useState } from "react";

import { GoldButton } from "../GoldButton";
import { StepShell } from "./StepShell";

interface WalletStepProps {
  walletPubkey: string | null;
  onConnect: (pubkey: string) => void;
}

type Phase = "idle" | "connecting" | "connected";

function fakePubkey(): string {
  const alphabet =
    "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 44; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

export function WalletStep({ walletPubkey, onConnect }: WalletStepProps) {
  const [phase, setPhase] = useState<Phase>(walletPubkey ? "connected" : "idle");

  useEffect(() => {
    if (walletPubkey) setPhase("connected");
  }, [walletPubkey]);

  function connect() {
    setPhase("connecting");
    window.setTimeout(() => {
      onConnect(fakePubkey());
    }, 1100);
  }

  return (
    <StepShell
      numeral="I"
      title="Take the Oath"
      state={walletPubkey ? "complete" : "active"}
    >
      <p className="mb-5 max-w-md font-body text-base text-stone-200">
        Sign with the wallet that will trade in the arena. Gladius watches it
        through Helius — your funds and signing keys never leave your custody.
      </p>

      {walletPubkey ? (
        <div className="flex items-center gap-4">
          <div className="readout text-sm text-stone-50">
            {walletPubkey.slice(0, 12)}…{walletPubkey.slice(-8)}
          </div>
          <span className="font-display text-[10px] uppercase tracking-carved text-stone-300">
            wallet bound
          </span>
        </div>
      ) : (
        <GoldButton
          onClick={connect}
          variant="primary"
          disabled={phase === "connecting"}
        >
          {phase === "connecting" ? "Calling the herald…" : "Connect wallet"}
        </GoldButton>
      )}
    </StepShell>
  );
}
