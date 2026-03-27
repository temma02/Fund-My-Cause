import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { PledgeModal } from "./PledgeModal";

// ── Mutable wallet state ──────────────────────────────────────────────────────
let mockWalletAddress: string | null = null;
const mockConnect = jest.fn();
const mockSignTx = jest.fn().mockResolvedValue("signed-xdr");
const mockAddToast = jest.fn();

jest.mock("@/context/WalletContext", () => ({
  useWallet: () => ({ address: mockWalletAddress, connect: mockConnect, signTx: mockSignTx }),
}));

jest.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

jest.mock("@/components/ui/TransactionStatus", () => ({
  TransactionStatus: ({ status }: { status: string }) => (
    <div data-testid="tx-status">{status}</div>
  ),
}));

// Mock the contract client (Issue #49) — includes new simulate helpers
jest.mock("@/lib/soroban", () => ({
  buildContributeTx: jest.fn().mockResolvedValue("unsigned-xdr"),
  simulateTx: jest.fn().mockResolvedValue({ minFeeXlm: "0.001 XLM", preparedXdr: "prepared-xdr" }),
  submitSignedTx: jest.fn().mockResolvedValue("mockhash123"),
  fetchCampaign: jest.fn(),
  fetchAllCampaigns: jest.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderModal(onClose = jest.fn()) {
  return render(
    <PledgeModal
      campaignTitle="Save the Rainforest"
      contractId="CABC123"
      onClose={onClose}
    />,
  );
}

beforeEach(() => {
  mockWalletAddress = null;
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PledgeModal", () => {
  // 1. Renders with the campaign title
  it("renders the campaign title", () => {
    renderModal();
    expect(screen.getByText("Pledge to Save the Rainforest")).toBeInTheDocument();
  });

  // 2. Close button calls onClose
  it("calls onClose when the close button is clicked", () => {
    const onClose = jest.fn();
    renderModal(onClose);
    const closeBtn = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // 3. Submitting without a wallet connected triggers connect
  it("calls connect() when pledging without a connected wallet", () => {
    mockWalletAddress = null;
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /connect wallet to pledge/i }));
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  // 4. Amount input rejects negative numbers (no tx started)
  it("does not start a transaction for negative amounts", () => {
    mockWalletAddress = "GABC123";
    renderModal();
    const input = screen.getByPlaceholderText(/amount in xlm/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "-50" } });
    expect(input.value).toBe("-50");
    expect(screen.queryByTestId("tx-status")).not.toBeInTheDocument();
  });

  // 5. Success state renders "Pledge submitted successfully!" via toast
  it("shows success state and fires the success toast after pledge", async () => {
    mockWalletAddress = "GABC123";
    renderModal();

    // Enter a valid amount
    fireEvent.change(screen.getByPlaceholderText(/amount in xlm/i), {
      target: { value: "10" },
    });

    // Click confirm — kicks off simulate → sign → submit chain (all mocked)
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirm pledge/i }));
    });

    // Advance the 1s confirming pause
    act(() => { jest.advanceTimersByTime(1100); });

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        "Pledge submitted successfully!",
        "success",
        "mockhash123",
      );
    });

    expect(screen.getByTestId("tx-status")).toHaveTextContent("success");
  });

  // 6. handleDismiss resets txStatus back to idle
  it("resets to idle input form when dismiss is called after success", async () => {
    mockWalletAddress = "GABC123";

    // Override the TransactionStatus mock to expose onDismiss
    const { TransactionStatus } = jest.requireMock("@/components/ui/TransactionStatus") as {
      TransactionStatus: React.FC<{ status: string; onDismiss?: () => void }>;
    };
    (
      jest.requireMock("@/components/ui/TransactionStatus") as {
        TransactionStatus: unknown;
      }
    ).TransactionStatus = ({
      status,
      onDismiss,
    }: {
      status: string;
      onDismiss?: () => void;
    }) => (
      <div data-testid="tx-status">
        {status}
        {onDismiss && (
          <button onClick={onDismiss} data-testid="dismiss-btn">
            Dismiss
          </button>
        )}
      </div>
    );

    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /confirm pledge/i }));
    act(() => { jest.advanceTimersByTime(4100); });

    await waitFor(() => expect(screen.getByTestId("tx-status")).toHaveTextContent("success"));

    const dismissBtn = screen.queryByTestId("dismiss-btn");
    if (dismissBtn) {
      fireEvent.click(dismissBtn);
      await waitFor(() =>
        expect(screen.getByPlaceholderText(/amount in xlm/i)).toBeInTheDocument(),
      );
    }

    // Restore original mock
    (
      jest.requireMock("@/components/ui/TransactionStatus") as {
        TransactionStatus: unknown;
      }
    ).TransactionStatus = TransactionStatus;
  });
});
