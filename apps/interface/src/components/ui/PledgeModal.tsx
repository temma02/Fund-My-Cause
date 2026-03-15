"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { useWallet } from "@/context/WalletContext";

interface PledgeModalProps {
  campaignTitle: string;
  onClose: () => void;
}

export function PledgeModal({ campaignTitle, onClose }: PledgeModalProps) {
  const { address, connect } = useWallet();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "done">("idle");

  const handlePledge = async () => {
    if (!address) {
      await connect();
      return;
    }
    setStatus("pending");
    // TODO: invoke Soroban contract contribute()
    setTimeout(() => setStatus("done"), 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Pledge to {campaignTitle}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        {status === "done" ? (
          <p className="text-green-400 text-center py-4">Pledge submitted successfully!</p>
        ) : (
          <>
            <input
              type="number"
              placeholder="Amount in XLM"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none"
            />
            <button
              onClick={handlePledge}
              disabled={status === "pending"}
              className="w-full bg-indigo-600 hover:bg-indigo-500 py-2 rounded-xl font-medium transition disabled:opacity-50"
            >
              {status === "pending" ? "Processing..." : address ? "Confirm Pledge" : "Connect Wallet to Pledge"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
