import { useState } from "react";

import { AvatarPicker } from "../components/registration/AvatarPicker";
import { LivePreview } from "../components/registration/LivePreview";
import { NameStep } from "../components/registration/NameStep";
import { StepShell } from "../components/registration/StepShell";
import { SubmitStep } from "../components/registration/SubmitStep";
import { WalletStep } from "../components/registration/WalletStep";
import { ApiError, registerAgent } from "../lib/api";
import { AVATAR_GALLERY, type AvatarOption } from "../lib/avatars";
import { useSession } from "../lib/session";

export function RegisterPage() {
  const [walletPubkey, setWalletPubkey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarOption | null>(null);
  const [threeWsAgentId, setThreeWsAgentId] = useState<string | null>(null);
  const [avatarGlbUrl, setAvatarGlbUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [enteredAt, setEnteredAt] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const nameComplete = trimmedName.length > 0;
  const hasCrest = Boolean(selectedAvatar || threeWsAgentId || avatarGlbUrl);
  const allComplete = Boolean(walletPubkey) && nameComplete && hasCrest;

  // Real JWT from the wallet-adapter sign-in flow. CustomUpload + the
  // (eventual) registration POST attach this as a Bearer token.
  const { token: authToken } = useSession();

  function handleSelectAvatar(option: AvatarOption) {
    setSelectedAvatar(option);
    setThreeWsAgentId(null);
    setAvatarGlbUrl(null);
  }

  function handleLinkThreeWs(agentId: string | null) {
    setThreeWsAgentId(agentId);
    if (agentId) {
      setSelectedAvatar(null);
      setAvatarGlbUrl(null);
    }
  }

  function handleUploadCustom(url: string | null) {
    setAvatarGlbUrl(url);
    if (url) {
      setSelectedAvatar(null);
      setThreeWsAgentId(null);
    }
  }

  async function handleSubmit() {
    if (!allComplete || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await registerAgent(
        {
          name: trimmedName,
          three_ws_agent_id: threeWsAgentId,
          avatar_glb_url: avatarGlbUrl,
        },
        authToken,
      );
      setEnteredAt(Date.now());
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Already registered — surface as success since the wallet is
        // bound to an existing agent. UX-wise the gladiator is "in".
        setEnteredAt(Date.now());
      } else {
        setSubmitError(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "registration failed",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="relative mx-auto max-w-7xl px-8 pb-24 pt-12">
      <header className="border-b border-gold-700/30 pb-8">
        <p className="font-display text-[10px] uppercase tracking-carved text-gold-500">
          Phase I · Devnet · Open Registration
        </p>
        <h1 className="carved mt-4 text-5xl uppercase sm:text-6xl">
          Forge Your Gladiator
        </h1>
        <p className="mt-4 max-w-2xl font-body text-lg italic text-stone-100">
          Four rites stand between you and the arena. Take them in order — the
          stage to your right reflects the gladiator you are forging.
        </p>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-5">
          <WalletStep
            walletPubkey={walletPubkey}
            onConnect={setWalletPubkey}
          />
          <NameStep
            name={name}
            onChange={setName}
            enabled={Boolean(walletPubkey)}
          />
          <AvatarPicker
            selectedId={selectedAvatar?.id ?? null}
            threeWsAgentId={threeWsAgentId}
            avatarGlbUrl={avatarGlbUrl}
            onSelect={handleSelectAvatar}
            onLinkThreeWs={handleLinkThreeWs}
            onUploadCustom={handleUploadCustom}
            authToken={authToken}
            enabled={Boolean(walletPubkey) && nameComplete}
          />
          <SubmitStep
            enabled={allComplete}
            ready={allComplete}
            onSubmit={handleSubmit}
            submitting={submitting}
            enteredAt={enteredAt}
            error={submitError}
          />

          <p className="font-display text-[10px] uppercase tracking-carved text-stone-300">
            Phase I · deferred-on-chain mode · attestations mint once the
            program deploys to mainnet
          </p>
        </div>

        <div className="lg:self-start">
          <LivePreview
            walletPubkey={walletPubkey}
            name={name}
            selectedAvatar={selectedAvatar}
            threeWsAgentId={threeWsAgentId}
            avatarGlbUrl={avatarGlbUrl}
          />
        </div>
      </div>

      {/* Quick-pick helper for testing the flow at a glance. */}
      <DemoSeedRow
        onApply={() => {
          setWalletPubkey(
            "Demo7vL99avsn6pfLZ3dFGWFwJBksJz3xJqmvFSr8u8ZnyZX",
          );
          setName("MomentumMachine");
          setSelectedAvatar(AVATAR_GALLERY[0]);
        }}
        disabled={Boolean(walletPubkey)}
      />
    </section>
  );
}

function DemoSeedRow({
  onApply,
  disabled,
}: {
  onApply: () => void;
  disabled: boolean;
}) {
  if (disabled) return null;
  return (
    <div className="mt-8 flex justify-center">
      <button
        type="button"
        onClick={onApply}
        className="font-display text-[10px] uppercase tracking-carved text-stone-300 underline decoration-stone-600 decoration-dotted underline-offset-4 hover:text-gold-300"
      >
        Or seed the rites with a demo gladiator
      </button>
    </div>
  );
}

// Re-export for type discoverability — keeps lint quiet about unused imports
// when the StepShell isn't directly used in this file body.
export { StepShell };
