"use client";

import React, { useState, useRef } from "react";
import { X } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { TransactionStatus, TxStatus } from "@/components/ui/TransactionStatus";
import { useToast } from "@/components/ui/Toast";
import { contribute } from "@/lib/contract";
import { useAccountExists } from "@/hooks/useAccountExists";

const XLM_TO_STROOPS = 10_000_000n;
const PLEDGE_DEBOUNCE_MS = 2000;

interface PledgeModalProps {
  contractId: string;
  campaignTitle: string;
  /** Minimum contribution in stroops. */
  minContribution?: bigint;
  onClose: () => void;
  /** Called after a successful pledge so the parent can refresh stats. */
  onSuccess?: () => void;
}

export function PledgeModal({
  contractId,
  campaignTitle,
  minContribution = 1n,
  onClose,
  onSuccess,
}: PledgeModalProps) {
  const { address, connect, signTx, isSigning } = useWallet();
  const { exists: accountExists, loading: accountLoading } = useAccountExists(address);
  const { addToast } = useToast();
  const [amount, setAmount] = useState("");
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [pendingTx, setPendingTx] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<Element | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Store the element that opened the modal so focus can be returned on close
  React.useEffect(() => {
    triggerRef.current = document.activeElement;
    return () => {
      (triggerRef.current as HTMLElement | null)?.focus();
    };
  }, []);

  // Close on Escape
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isProcessing) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  // Trap focus inside dialog
  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length) focusable[0].focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, []);

  const minXlm = Number(minContribution) / 1e7;

  const handlePledge = async () => {
    if (!address) {
      await connect();
      return;
    }

    // Prevent double-submission with debounce
    if (pendingTx) {
      return;
    }

    const xlm = parseFloat(amount);
    if (!amount || isNaN(xlm) || xlm <= 0) {
      addToast("Please enter a valid amount.", "error");
      return;
    }

    const stroops = BigInt(Math.round(xlm * 1e7));
    if (stroops < minContribution) {
      addToast(`Minimum contribution is ${minXlm} XLM.`, "error");
      return;
    }

    setErrorMessage("");
    setPendingTx(true);
    setTxStatus("signing");

    try {
      const hash = await contribute(contractId, address, stroops, async (xdr) => {
        setTxStatus("signing");
        const signed = await signTx(xdr);
        setTxStatus("submitting");
        return signed;
      });

      setTxStatus("confirming");
      // contribute() already polls — by the time it resolves we're confirmed
      setTxHash(hash);
      setTxStatus("success");
      addToast("Pledge submitted successfully!", "success", hash);
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed.";
      setErrorMessage(msg);
      setTxStatus("error");
      addToast(msg, "error");
    } finally {
      setPendingTx(false);
    }
  };

  const handlePledgeWithDebounce = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      handlePledge();
    }, PLEDGE_DEBOUNCE_MS);
  };

  const handleDismiss = () => {
    setTxStatus("idle");
    setTxHash("");
    setErrorMessage("");
  };

  const isProcessing = txStatus !== "idle" || pendingTx || isSigning;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pledge-modal-title"
        className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700 space-y-4"
      >
        <div className="flex justify-between items-center">
          <h2 id="pledge-modal-title" className="text-lg font-semibold">Pledge to {campaignTitle}</h2>
          <button onClick={onClose} aria-label="Close" disabled={isProcessing}>
            <X size={20} />
          </button>
        </div>

        {txStatus !== "idle" ? (
          <TransactionStatus
            status={txStatus}
            txHash={txHash}
            errorMessage={errorMessage}
            onDismiss={handleDismiss}
          />
        ) : (
          <>
            <div className="space-y-1">
              {address && !accountLoading && !accountExists && (
                <p className="text-xs text-yellow-400">
                  ⚠️ This account is not funded on the network. Your transaction will fail.
                </p>
              )}
              <input
                type="number"
                placeholder={`Amount in XLM (min ${minXlm})`}
                value={amount}
                min={minXlm}
                step="0.1"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                disabled={isProcessing}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none disabled:opacity-50"
              />
              {minContribution > XLM_TO_STROOPS && (
                <p className="text-xs text-gray-500">Minimum: {minXlm} XLM</p>
              )}
            </div>
            <button
              onClick={handlePledgeWithDebounce}
              disabled={isProcessing}
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
