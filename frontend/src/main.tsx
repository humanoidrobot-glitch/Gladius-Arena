import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { useMemo } from "react";
import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App";
import { SessionProvider } from "./lib/session";
import "./styles/globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";

function Root() {
  // Devnet by default; flip via VITE_RPC_URL when targeting mainnet.
  const endpoint =
    import.meta.env.VITE_RPC_URL ?? "https://api.devnet.solana.com";
  // Wallets are listed once and memoized — they're stateful adapters.
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <SessionProvider>
            <App />
          </SessionProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
