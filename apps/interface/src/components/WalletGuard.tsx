"use client";

import React from "react";
import { Loader2, Wallet } from "lucide-react";
import { useWallet } from "@/context/WalletContext";

interface WalletGuardProps {
  children: React.ReactNode;
  message?: string;
}

export function WalletGuard({ children, message = "Connect your wallet to continue." }: WalletGuardProps) {
  const { address, connect, isConnecting, isAutoConnecting } = useWallet();

  if (isAutoConnecting) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Loader2 size={28} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <p className="text-gray-600 dark:text-gray-400">{message}</p>
        <button
          onClick={connect}
          disabled={isConnecting}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-xl font-medium transition disabled:opacity-50 text-white"
        >
          {isConnecting ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
          Connect Wallet
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
