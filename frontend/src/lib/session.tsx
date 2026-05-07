/**
 * SessionContext — bridges wallet-adapter-react to the coordinator's
 * Ed25519 challenge/sign/verify flow.
 *
 * Lifecycle:
 *   1. user clicks WalletMultiButton → wallet-adapter sets `publicKey`
 *   2. effect picks that up, calls `requestChallenge(wallet)` for a
 *      server-issued nonce
 *   3. asks the wallet to sign the nonce bytes (utf-8) via `signMessage`
 *   4. base58-encodes the signature, calls `verifyChallenge(...)` which
 *      returns a 24-hour JWT
 *   5. JWT is stashed in state + localStorage so a refresh keeps the user
 *      signed in until expiry
 *
 * The SessionContext exposes `{ wallet, token, status, error, signOut }`.
 * Components that need authenticated calls (CustomUpload, RegisterPage)
 * read `token` from this context — no more wallet-pubkey-as-token hack.
 */

import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ApiError, requestChallenge, verifyChallenge } from "./api";

export type SessionStatus =
  | "disconnected"
  | "connecting"
  | "signing"
  | "authenticated"
  | "error";

interface Session {
  wallet: string | null;
  token: string | null;
  expiresAt: number | null;
  status: SessionStatus;
  error: string | null;
  signOut: () => void;
}

const STORAGE_KEY = "gladius.session.v1";

interface PersistedSession {
  wallet: string;
  token: string;
  expiresAt: number;
}

function loadPersisted(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    if (parsed.expiresAt * 1000 < Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persist(s: PersistedSession | null) {
  if (s === null) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { publicKey, signMessage, disconnect, connected } = useWallet();
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [status, setStatus] = useState<SessionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);

  // Avoid kicking off challenge → sign → verify twice for the same wallet
  // (StrictMode double-mount, fast publicKey toggles).
  const inFlightFor = useRef<string | null>(null);

  const wallet = publicKey?.toBase58() ?? null;

  // Hydrate from localStorage on first mount if the wallet matches.
  useEffect(() => {
    const persisted = loadPersisted();
    if (persisted && persisted.wallet === wallet) {
      setToken(persisted.token);
      setExpiresAt(persisted.expiresAt);
      setStatus("authenticated");
    }
  }, [wallet]);

  const signOut = useCallback(() => {
    setToken(null);
    setExpiresAt(null);
    setStatus(connected ? "connecting" : "disconnected");
    setError(null);
    persist(null);
    inFlightFor.current = null;
    disconnect().catch(() => {
      /* wallet may already be disconnected */
    });
  }, [connected, disconnect]);

  // Drive the challenge → sign → verify flow when a new wallet connects.
  useEffect(() => {
    if (!wallet) {
      setToken(null);
      setExpiresAt(null);
      setStatus("disconnected");
      setError(null);
      inFlightFor.current = null;
      return;
    }
    if (token) {
      return;
    }
    if (!signMessage) {
      setStatus("error");
      setError("connected wallet doesn't support signMessage");
      return;
    }
    if (inFlightFor.current === wallet) {
      return;
    }
    inFlightFor.current = wallet;

    let cancelled = false;
    setStatus("connecting");
    setError(null);

    (async () => {
      try {
        const { nonce, expires_at } = await requestChallenge(wallet);
        if (cancelled) return;
        setStatus("signing");
        const sig = await signMessage(new TextEncoder().encode(nonce));
        if (cancelled) return;
        const sigB58 = bs58.encode(sig);
        const verified = await verifyChallenge(wallet, nonce, sigB58);
        if (cancelled) return;
        setToken(verified.token);
        setExpiresAt(verified.expires_at);
        setStatus("authenticated");
        persist({ wallet, token: verified.token, expiresAt: verified.expires_at });
        // Reference unused var so eslint doesn't complain on noUnusedLocals.
        void expires_at;
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "sign-in failed";
        setStatus("error");
        setError(message);
        inFlightFor.current = null;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [wallet, signMessage, token]);

  // Auto-expire the token client-side ~30s before it actually expires.
  useEffect(() => {
    if (!expiresAt) return;
    const ms = expiresAt * 1000 - Date.now() - 30_000;
    if (ms <= 0) {
      signOut();
      return;
    }
    const timer = window.setTimeout(signOut, ms);
    return () => window.clearTimeout(timer);
  }, [expiresAt, signOut]);

  const value = useMemo<Session>(
    () => ({ wallet, token, expiresAt, status, error, signOut }),
    [wallet, token, expiresAt, status, error, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (ctx === null) {
    throw new Error("useSession must be called inside <SessionProvider>");
  }
  return ctx;
}
