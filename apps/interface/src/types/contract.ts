/**
 * Contract interaction types
 */

/** Wallet signing function type */
export type SignFn = (xdr: string) => Promise<string>;

/**
 * Error thrown when a contract call fails.
 */
export class ContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractError";
  }
}
