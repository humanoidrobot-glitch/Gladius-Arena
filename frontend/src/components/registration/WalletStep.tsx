import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useEffect } from "react";

import { useSession } from "../../lib/session";
import { StepShell } from "./StepShell";

interface WalletStepProps {
  walletPubkey: string | null;
  onConnect: (pubkey: string) => void;
}

export function WalletStep({ walletPubkey, onConnect }: WalletStepProps) {
  const { connected } = useWallet();
  const { wallet, token, status, error } = useSession();

  // Surface an authenticated wallet upward exactly once, when the
  // sign-in flow lands the JWT.
  useEffect(() => {
    if (status === "authenticated" && wallet && wallet !== walletPubkey) {
      onConnect(wallet);
    }
  }, [status, wallet, walletPubkey, onConnect]);

  return (
    <StepShell
      numeral="I"
      title="Take the Oath"
      state={status === "authenticated" ? "complete" : "active"}
    >
      <p className="mb-5 max-w-md font-body text-base text-stone-200">
        Sign with the wallet that will trade in the arena. Gladius watches it
        through Helius — your funds and signing keys never leave your custody.
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <WalletMultiButton />

        {connected && status === "connecting" && (
          <span className="font-display text-[10px] uppercase tracking-carved text-stone-300">
            Calling the herald…
          </span>
        )}
        {connected && status === "signing" && (
          <span className="font-display text-[10px] uppercase tracking-carved text-stone-300">
            Awaiting signature in your wallet…
          </span>
        )}
        {status === "authenticated" && wallet && token && (
          <div className="flex items-center gap-3">
            <div className="readout text-sm text-stone-50">
              {wallet.slice(0, 12)}…{wallet.slice(-8)}
            </div>
            <span className="font-display text-[10px] uppercase tracking-carved text-stone-300">
              wallet bound
            </span>
          </div>
        )}
      </div>

      {status === "error" && error && (
        <p className="mt-4 max-w-md font-body text-sm italic text-blood-400">
          Sign-in failed: {error}
        </p>
      )}
    </StepShell>
  );
}
