"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { initializeJackal } from "@/lib/jackalClient";
import { showErrorAlert } from "@/utils/alerts/error";

const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [client, setClient] = useState(null);
  const [storage, setStorage] = useState(null);
  const [address, setAddress] = useState(null);
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const connectWallet = async (walletType = "keplr", silent = false) => {
    try {
      if (typeof window !== 'undefined') {
        if (walletType === 'leap' && !window.leap) {
          if (!silent) showErrorAlert("Leap Wallet not found", "Please install the Leap Wallet extension to continue.<br><br><a href='https://www.leapwallet.io/download' target='_blank' class='btn btn-sm btn-primary'>Download Leap Wallet</a>", true);
          return false;
        }
        if (walletType === 'keplr' && !window.keplr) {
          if (!silent) showErrorAlert("Keplr Wallet not found", "Please install the Keplr Wallet extension to continue.<br><br><a href='https://www.keplr.app/download' target='_blank' class='btn btn-sm btn-primary'>Download Keplr Wallet</a>", true);
          return false;
        }
      }

      setLoading(true);
      const { client, storage } = await initializeJackal(walletType);
      setClient(client);
      setStorage(storage);
      setAddress(client.details?.address);
      setConnected(true);
      setReady(true);
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('vestalia:wallet_connected', 'true');
          localStorage.setItem('vestalia:wallet_type', walletType);
          localStorage.setItem('vestalia:wallet_address', client.details?.address || '');
        }
      } catch (e) {}
      if (!silent) try { router.push('/vault'); } catch (e) { try { window.location.href = '/vault'; } catch (err) {} }
      return true;
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.includes("does not exist on chain") || msg.includes("Send some tokens")) {
        if (!silent) {
          try { showErrorAlert("Account empty", "This wallet has no JACKAL (JKL). Please send some JKL tokens to your address before using the Vault. Redirecting to Pricing..."); } catch (alertErr) { }
          try { router.push("/pricing"); } catch (pushErr) { window.location.href = "/pricing"; }
        }
        return false;
      }
      
      if (msg.includes("No wallet exists") || msg.includes("Wallet not found")) {
        if (!silent) {
          showErrorAlert("Wallet Connection Failed", "We detected the wallet extension, but could not connect to it. Please ensure your wallet is unlocked and try again.", true);
        }
        return false;
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = async () => {
    setClient(null);
    setStorage(null);
    setAddress(null);
    setConnected(false);
    try { if (typeof window !== 'undefined') { localStorage.removeItem('vestalia:wallet_connected'); localStorage.removeItem('vestalia:wallet_address'); localStorage.removeItem('vestalia:wallet_type'); } } catch (e) {}
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const was = localStorage.getItem('vestalia:wallet_connected');
      if (was === 'true') {
        const savedAddr = localStorage.getItem('vestalia:wallet_address');
        const savedType = localStorage.getItem('vestalia:wallet_type') || "keplr";
        if (savedAddr) setAddress(savedAddr);
        setConnected(true);
        setReady(false);
        (async () => {
          const maxAttempts = 3;
          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try { if (await connectWallet(savedType, true)) return; } catch (e) {}
            await new Promise(res => setTimeout(res, 250 * Math.pow(2, attempt - 1)));
          }
          setReady(false);
        })();
      }
    } catch (e) {}
  }, []);

  return <WalletContext.Provider value={{ client, storage, address, connected, loading, connectWallet, setConnected, disconnectWallet, ready }}>{children}</WalletContext.Provider>;
};

export const useWallet = () => useContext(WalletContext);
