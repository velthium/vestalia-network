"use client";

import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { initializeJackal } from "@/lib/jackalClient";
import { showErrorAlert } from "@/utils/alerts/error";

const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [client, setClient] = useState(null);
  const [storage, setStorage] = useState(null);
  const [address, setAddress] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const connectWallet = async () => {
    try {
      setLoading(true);

      const { client, storage } = await initializeJackal();

      setClient(client);
      setStorage(storage);
      setAddress(client.details?.address);
      setConnected(true);

      return true;
    } catch (err) {
      console.error("Wallet connection failed:", err);

      const msg = err?.message || String(err);

      // If account doesn't exist (no JKL tokens), ask user to fund and redirect to pricing
      if (msg.includes("does not exist on chain") || msg.includes("Send some tokens")) {
        try {
          showErrorAlert(
            "Account empty",
            "This wallet has no JACKAL (JKL). Please send some JKL tokens to your address before using the Vault. Redirecting to Pricing..."
          );
        } catch (alertErr) {
          console.warn("Alert display failed:", alertErr);
        }

        try {
          router.push("/pricing");
        } catch (pushErr) {
          // Fallback to full navigation if router push isn't available
          window.location.href = "/pricing";
        }

        return false;
      }

      return false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <WalletContext.Provider
      value={{
        client,
        storage,
        address,
        connected,
        loading,
        connectWallet,

        // 👉 we expose the missing function
        setConnected,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => useContext(WalletContext);
