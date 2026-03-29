/**
 * Central export for all application types.
 * Consolidates types from Campaign, Soroban contract, and business logic.
 */

export type { Campaign } from "./campaign";
export type {
  CampaignStatus,
  CampaignInfo,
  CampaignStats,
  PlatformConfig,
  StatusVariant,
  ContributionRecord,
  InitializeParams,
  CampaignData,
} from "./soroban";
export type { SignFn } from "./contract";
export { ContractError } from "./contract";
