"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { requestAccess, getNetworkDetails, signTransaction } from "@stellar/freighter-api";
import { useToast } from "@/components/ui/Toast";
import { NETWORK_PASSPHRASE, NETWORK_NAME } from "@/lib/constants";

const SESSION_KEY = "fmc:wallet_address";

interface WalletContextType {
  address: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTx: (xdr: string) => Promise<string>;
  isConnecting: boolean;
  isAutoConnecting: boolean;
  error: string | null;
  networkMismatch: boolean;
  walletNetwork: string | null;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAutoConnecting, setIsAutoConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [networkMismatch, setNetworkMismatch] = useState(false);
  const [walletNetwork, setWalletNetwork] = useState<string | null>(null);
  const { addToast } = useToast();

  const checkNetwork = useCallback(async () => {
    const result = await getNetworkDetails();
    if (result.error) return;
    const wNet = result.networkPassphrase === NETWORK_PASSPHRASE ? NETWORK_NAME : result.network;
    setWalletNetwork(result.network);
    setNetworkMismatch(result.networkPassphrase !== NETWORK_PASSPHRASE);
    return wNet;
  }, []);

  // Auto-restore from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      setAddress(saved);
      checkNetwork().finally(() => setIsAutoConnecting(false));
    } else {
      setIsAutoConnecting(false);
    }
  }, [checkNetwork]);

  const connect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const result = await requestAccess();
      if (result.error) {
        const msg = result.error.message ?? "Failed to connect wallet.";
        setError(msg);
        addToast(msg, "error");
        return;
      }
      sessionStorage.setItem(SESSION_KEY, result.address);
      setAddress(result.address);
      await checkNetwork();
      addToast("Wallet connected successfully!", "success");
    } catch (e) {
      setError("Failed to connect wallet.");
      addToast("Failed to connect wallet.", "error");
      console.error(e);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setAddress(null);
    setNetworkMismatch(false);
    setWalletNetwork(null);
    addToast("Wallet disconnected", "info");
  }, [addToast]);

  const signTx = async (xdr: string): Promise<string> => {
    const result = await signTransaction(xdr, { networkPassphrase: NETWORK_PASSPHRASE });
    if (result.error) throw new Error(result.error.message ?? "Signing failed");
    return result.signedTxXdr;
  };

  return (
    <WalletContext.Provider
      value={{
        address,
        connect,
        disconnect,
        signTx,
        isConnecting,
        isAutoConnecting,
        error,
        networkMismatch,
        walletNetwork,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
