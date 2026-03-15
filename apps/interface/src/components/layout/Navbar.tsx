"use client";

import React from "react";
import { Wallet, Rocket, LogOut, Loader2 } from "lucide-react";
import { useWallet } from "@/context/WalletContext";

export function Navbar() {
  const { address, connect, disconnect, isConnecting, error } = useWallet();

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950">
      <div className="flex items-center gap-2 font-bold text-lg">
        <Rocket className="text-indigo-400" size={20} />
        Fund-My-Cause
      </div>

      <div className="flex items-center gap-3">
        {error && <span className="text-red-400 text-sm">{error}</span>}
        {address ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-300">
              {`${address.substring(0, 5)}...${address.substring(address.length - 4)}`}
            </span>
            <button
              onClick={disconnect}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition"
            >
              <LogOut size={16} /> Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={connect}
            disabled={isConnecting}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
          >
            {isConnecting ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
            Connect Wallet
          </button>
        )}
      </div>
    </nav>
  );
}
