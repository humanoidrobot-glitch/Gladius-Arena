import { type AvatarOption } from "../../lib/avatars";
import { AgentAvatar3D } from "../AgentAvatar3D";
import { AvatarThumb } from "../AvatarThumb";

interface LivePreviewProps {
  walletPubkey: string | null;
  name: string;
  selectedAvatar: AvatarOption | null;
  threeWsAgentId: string | null;
}

export function LivePreview({
  walletPubkey,
  name,
  selectedAvatar,
  threeWsAgentId,
}: LivePreviewProps) {
  const trimmed = name.trim();
  const displayName = trimmed.length > 0 ? trimmed : "Unnamed";
  const ready = Boolean(walletPubkey && trimmed && (selectedAvatar || threeWsAgentId));

  return (
    <aside className="stone-panel sticky top-8 flex flex-col items-stretch border border-gold-700/30 px-6 py-7">
      <p className="font-display text-[10px] uppercase tracking-carved text-stone-300">
        At the Gates
      </p>

      <div className="relative mt-5 flex h-72 items-center justify-center overflow-hidden border border-gold-700/30 bg-night-800/60">
        <div className="absolute inset-0 bg-torch-light" />
        <div className="relative flex flex-col items-center gap-3">
          {threeWsAgentId ? (
            <ThreeWsAgentPreview agentId={threeWsAgentId} />
          ) : selectedAvatar ? (
            <AvatarThumb seed={selectedAvatar.seed} size={140} />
          ) : (
            <EmptyStage />
          )}
        </div>
        <p className="readout absolute bottom-2 right-3 text-[9px] uppercase tracking-wider text-stone-300">
          {threeWsAgentId
            ? "agent-3d · three.ws"
            : selectedAvatar
              ? "forged crest"
              : "pending"}
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-1">
        <h3
          className={`font-display uppercase ${
            trimmed ? "text-gold-200" : "text-stone-400"
          }`}
          style={{
            fontSize:
              displayName.length > 18
                ? "0.95rem"
                : displayName.length > 13
                  ? "1.2rem"
                  : "1.5rem",
            letterSpacing: displayName.length > 13 ? "0.05em" : "0.18em",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
            lineHeight: 1.15,
            textShadow: trimmed
              ? "0 1px 0 rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.8), 0 0 16px rgba(201,168,76,0.18)"
              : "none",
          }}
        >
          {displayName}
        </h3>
        {selectedAvatar && !threeWsAgentId && (
          <p className="font-body text-sm italic text-stone-200">
            {selectedAvatar.archetype}
          </p>
        )}
        {threeWsAgentId && (
          <p className="font-body text-sm italic text-stone-200">
            three.ws agent · linked
          </p>
        )}
      </div>

      <dl className="mt-6 space-y-3 border-t border-stone-700/40 pt-5 text-sm">
        <Row label="Wallet">
          {walletPubkey ? (
            <span className="readout text-xs text-stone-50">
              {walletPubkey.slice(0, 8)}…{walletPubkey.slice(-6)}
            </span>
          ) : (
            <span className="font-body italic text-stone-300">unbound</span>
          )}
        </Row>
        <Row label="Crest">
          <span className="font-display text-xs uppercase tracking-imperial text-stone-50">
            {threeWsAgentId
              ? "three.ws"
              : selectedAvatar
                ? selectedAvatar.name
                : "—"}
          </span>
        </Row>
        <Row label="Status">
          <span
            className={`font-display text-xs uppercase tracking-imperial ${
              ready ? "text-gold-200" : "text-stone-300"
            }`}
          >
            {ready ? "Ready to enter" : "Awaiting rites"}
          </span>
        </Row>
      </dl>
    </aside>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="font-display text-[10px] uppercase tracking-carved text-stone-300">
        {label}
      </dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function EmptyStage() {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <svg
        viewBox="0 0 64 64"
        className="h-14 w-14 text-stone-500"
        aria-hidden
      >
        <circle
          cx="32"
          cy="32"
          r="28"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.45"
          strokeWidth="1"
          strokeDasharray="2 4"
        />
        <path
          d="M32 12 L34 42 L32 50 L30 42 Z"
          fill="currentColor"
          fillOpacity="0.55"
        />
        <path
          d="M22 42 L42 42"
          stroke="currentColor"
          strokeOpacity="0.55"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
      <p className="max-w-[16rem] font-body text-sm italic leading-tight text-stone-300">
        The stage waits. Choose a crest or link a three.ws identity.
      </p>
    </div>
  );
}

function ThreeWsAgentPreview({ agentId }: { agentId: string }) {
  return (
    <AgentAvatar3D
      agentId={agentId}
      style={{ width: 192, height: 224, display: "block" }}
      fallback={
        <div className="flex h-56 w-44 flex-col items-center justify-center gap-2 border border-gold-600/40 bg-night-700/60">
          <span className="font-display text-[10px] uppercase tracking-carved text-gold-300">
            agent-3d
          </span>
          <span className="readout text-[10px] text-stone-300">
            {agentId.slice(0, 14)}
            {agentId.length > 14 ? "…" : ""}
          </span>
          <span className="font-body text-[11px] italic text-stone-300">
            three.ws script loading…
          </span>
        </div>
      }
      ariaLabel="three.ws preview"
    />
  );
}
