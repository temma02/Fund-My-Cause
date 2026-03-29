import type { CampaignStatus } from "./soroban";

/**
 * Campaign display model - extended from CampaignInfo with rendered fields.
 * Includes all contract fields plus UI-specific properties.
 */
export interface Campaign {
  /** Contract ID (campaign identifier) */
  id: string;
  contractId: string;

  // Basic metadata
  title: string;
  description: string;
  creator: string;
  image?: string;

  // Financial
  raised: number;
  goal: number;

  // Scheduling and status
  deadline: string;
  status: CampaignStatus;

  // Token and contribution
  token: string;
  minContribution?: number;
  acceptedTokens?: string[];

  // Campaign statistics
  contributorCount?: number;
  averageContribution?: number;
  largestContribution?: number;

  // Social and platform
  socialLinks?: string[];
  hasPlatformConfig?: boolean;
  platformFeeBps?: number;
  platformAddress?: string;
}
