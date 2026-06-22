"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { ogGalileo } from "@/lib/chain";

/**
 * Web2 + Web3 auth. Email/Google users get an embedded 0G wallet automatically;
 * crypto users connect their own. Both produce a real wallet that signs onchain.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) return <>{children}</>;

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: "#0A1628",
          accentColor: "#00C853",
          logo: "/gaffer-logo.svg",
          landingHeader: "Sign in to Gaffer",
          loginMessage: "Build your AI gaffer. Deploy it. Let it cook.",
          showWalletLoginFirst: false,
        },
        loginMethods: ["email", "google", "wallet"],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
          showWalletUIs: true,
        },
        defaultChain: ogGalileo,
        supportedChains: [ogGalileo],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
