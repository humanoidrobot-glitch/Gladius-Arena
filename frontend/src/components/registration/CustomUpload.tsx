import { type DragEvent, useCallback, useRef, useState } from "react";

import { ApiError, uploadAvatar } from "../../lib/api";

interface CustomUploadProps {
  /** Server-relative URL of the currently uploaded GLB, or null. */
  avatarGlbUrl: string | null;
  onUploaded: (url: string) => void;
  onCleared: () => void;
  /** Auth token for the upload endpoint. Null = upload disabled. */
  authToken: string | null;
  disabled?: boolean;
}

const MAX_BYTES = 50 * 1024 * 1024;
const GLB_MAGIC = new Uint8Array([0x67, 0x6c, 0x54, 0x46]); // "glTF"

export function CustomUpload({
  avatarGlbUrl,
  onUploaded,
  onCleared,
  authToken,
  disabled,
}: CustomUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  const reset = () => {
    setError(null);
    setFilename(null);
    onCleared();
    if (inputRef.current) inputRef.current.value = "";
  };

  const accept = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.name.toLowerCase().endsWith(".glb")) {
        setError("file must be a .glb model");
        return;
      }
      if (file.size > MAX_BYTES) {
        setError(`file is ${(file.size / 1024 / 1024).toFixed(1)} MB; max 50 MB`);
        return;
      }

      const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      if (
        head.length < 4 ||
        head[0] !== GLB_MAGIC[0] ||
        head[1] !== GLB_MAGIC[1] ||
        head[2] !== GLB_MAGIC[2] ||
        head[3] !== GLB_MAGIC[3]
      ) {
        setError("file is not a valid glTF binary (.glb)");
        return;
      }

      setBusy(true);
      try {
        const result = await uploadAvatar(file, authToken);
        setFilename(file.name);
        onUploaded(result.url);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("upload failed");
        }
      } finally {
        setBusy(false);
      }
    },
    [authToken, onUploaded],
  );

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setHover(false);
    if (disabled || busy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) accept(file);
  };

  const onClick = () => {
    if (disabled || busy) return;
    inputRef.current?.click();
  };

  if (avatarGlbUrl) {
    return (
      <div className="rounded-sm border border-gold-500/55 bg-night-700/40 p-5 shadow-gold-glow">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="font-display text-[10px] uppercase tracking-carved text-gold-200">
              Custom GLB · uploaded
            </span>
            <span className="readout text-xs text-stone-200">
              {filename ?? avatarGlbUrl.split("/").pop()}
            </span>
          </div>
          <button
            type="button"
            onClick={reset}
            disabled={disabled || busy}
            className="font-display text-[10px] uppercase tracking-carved text-stone-300 hover:text-blood-400"
          >
            replace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        if (!disabled && !busy) setHover(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setHover(false);
      }}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={onDrop}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      aria-disabled={disabled || busy}
      className={`group flex cursor-pointer flex-col items-center gap-3 rounded-sm border-2 border-dashed bg-night-800/40 px-6 py-8 text-center transition-all ${
        hover
          ? "border-gold-500/70 bg-night-700/50"
          : "border-stone-600/40 hover:border-gold-700/60 hover:bg-night-700/30"
      } ${disabled || busy ? "pointer-events-none opacity-60" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".glb,model/gltf-binary"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) accept(f);
        }}
      />
      <UploadIcon />
      <p className="font-display text-[11px] uppercase tracking-imperial text-gold-200">
        {busy ? "Uploading…" : "Drop a .glb here"}
      </p>
      <p className="max-w-md font-body text-sm leading-snug text-stone-200">
        Bring your own 3D model from{" "}
        <a
          href="https://readyplayer.me"
          target="_blank"
          rel="noreferrer"
          className="text-gold-300 underline decoration-gold-700/60 underline-offset-4 hover:text-gold-200"
        >
          Ready Player Me
        </a>
        ,{" "}
        <a
          href="https://www.mixamo.com"
          target="_blank"
          rel="noreferrer"
          className="text-gold-300 underline decoration-gold-700/60 underline-offset-4 hover:text-gold-200"
        >
          Mixamo
        </a>
        , Sketchfab, or your own renderer. ≤50 MB. We host it on the coordinator's CDN and embed it via{" "}
        <code className="readout text-[12px] text-gold-100">{"<agent-3d body=…>"}</code>.
      </p>
      {error && (
        <p className="font-body text-sm italic text-blood-400">{error}</p>
      )}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-8 w-8 text-gold-500/80"
      aria-hidden
    >
      <path
        d="M16 4 L16 20 M9 11 L16 4 L23 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 22 L5 26 Q5 28 7 28 L25 28 Q27 28 27 26 L27 22"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.6"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
