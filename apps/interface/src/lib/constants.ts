export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK === "mainnet"
    ? "Public Global Stellar Network ; September 2015"
    : "Test SDF Network ; September 2015";

export const NETWORK_NAME =
  process.env.NEXT_PUBLIC_NETWORK === "mainnet" ? "mainnet" : "testnet";
