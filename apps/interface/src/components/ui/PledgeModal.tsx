"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { TransactionStatus, TxStatus } from "@/components/ui/TransactionStatus";
import { useToast } from "@/components/ui/Toast";
import { buildContributeTx, simulateTx, submitSignedTx } from "@/lib/soroban";

interface PledgeModalProps {
  campaignTitle: string;
  contractId: string;
  onClose: () => void;
}

export function PledgeModal({ campaignTitle, contractId, onClose }: PledgeModalProps) {
  const { address, connect, signTx } = useWallet();
  const { addToast } = useToast();
  const [amount, setAmount] = useState("");
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState("");
  const [txError, setTxError] = useState("");
  const [estimatedFee, setEstimatedFee] = useState<string | null>(null);

  const handlePledge = async () => {
    if (!address) {
      await connect();
      return;
    }

    const xlm = parseFloat(amount);
    if (!xlm || xlm <= 0) {
      addToast("Please enter a valid amount.", "error");
      return;
    }

    setTxError("");
    setEstimatedFee(null);

    try {
      // ── Step 1: build unsigned tx ─────────────────────────────────────────
      setTxStatus("simulating");
      const unsignedXdr = await buildContributeTx(address, contractId, xlm);

      // ── Step 2: simulate — estimate fee, catch contract errors early ──────
      const { minFeeXlm, preparedXdr } = await simulateTx(unsignedXdr);
      setEstimatedFee(minFeeXlm);

      // ── Step 3: sign with Freighter ───────────────────────────────────────
      setTxStatus("signing");
      const signedXdr = await signTx(preparedXdr);

      // ── Step 4: submit ────────────────────────────────────────────────────
      setTxStatus("submitting");
      const hash = await submitSignedTx(signedXdr);

      setTxStatus("confirming");
      // Brief pause so the user sees the confirming step before success
      await new Promise((r) => setTimeout(r, 1000));

      setTxHash(hash);
      setTxStatus("success");
      addToast("Pledge submitted successfully!", "success", hash);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed.";
      setTxError(msg);
      setTxStatus("error");
      addToast(msg, "error");
    }
  };

  const handleDismiss = () => {
    setTxStatus("idle");
    setTxHash("");
    setTxError("");
    setEstimatedFee(null);
  };

  const isProcessing = txStatus !== "idle";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Pledge to {campaignTitle}</h2>
          <button onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        {txStatus === "success" || txStatus === "error" ? (
          <TransactionStatus
            status={txStatus}
            txHash={txHash}
            errorMessage={txError}
            onDismiss={handleDismiss}
          />
        ) : isProcessing ? (
          <>
            <TransactionStatus status={txStatus} />
            {/* Show estimated fee once simulation completes */}
            {estimatedFee && txStatus !== "simulating" && (
              <p className="text-xs text-gray-400 text-center">
                Estimated network fee: <span className="text-white font-medium">{estimatedFee}</span>
              </p>
            )}
          </>
        ) : (
          <>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="Amount in XLM"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none"
            />
            {/* Fee estimate shown after a previous simulation (e.g. user dismissed and retries) */}
            {estimatedFee && (
              <p className="text-xs text-gray-400">
                Estimated fee: <span className="text-white font-medium">{estimatedFee}</span>
              </p>
            )}
            <button
              onClick={handlePledge}
              className="w-full bg-indigo-600 hover:bg-indigo-500 py-2 rounded-xl font-medium transition disabled:opacity-50"
            >
              {address ? "Confirm Pledge" : "Connect Wallet to Pledge"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
