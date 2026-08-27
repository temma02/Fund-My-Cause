/**
 * Centralized secrets management module.
 *
 * All services should load secrets through this module to ensure consistent
 * validation and prevent accidental logging of sensitive values.
 */

const logger = console;

export interface SecretsConfig {
  jwtSecret?: string;
  pagerDutyApiKey?: string;
  redisUrl?: string;
  databaseUrl?: string;
  rpcUrl?: string;
}

const KNOWN_DEFAULTS = [
  "your-secret-key",
  "your-secret-key-change-in-production",
  "dev-secret-key-change-in-production",
  "test-key",
  "test-secret",
  "dev-secret",
  "123456",
];

/**
 * Check if a value is a known default/placeholder secret
 */
function isKnownDefault(value: string): boolean {
  return KNOWN_DEFAULTS.includes(value.toLowerCase());
}

/**
 * Validate that a secret is not a known default
 */
function validateSecret(name: string, value: string | undefined): void {
  if (!value || value.trim() === "") {
    throw new Error(`Secret '${name}' is required but not set`);
  }

  if (isKnownDefault(value)) {
    throw new Error(
      `Secret '${name}' appears to be a default/example value and must be changed`
    );
  }

  // Secrets should have minimum length for safety
  if (value.length < 32) {
    logger.warn(
      `Secret '${name}' is shorter than 32 characters; consider using a stronger value`
    );
  }
}

/**
 * Load and validate JWT secret from environment
 */
export function loadJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  validateSecret("JWT_SECRET", secret);
  return secret!;
}

/**
 * Load PagerDuty API key from environment
 * Returns undefined if not set (optional for non-critical deployments)
 */
export function loadPagerDutyApiKey(): string | undefined {
  const key = process.env.PAGERDUTY_API_KEY;
  if (key && isKnownDefault(key)) {
    throw new Error(
      "PAGERDUTY_API_KEY appears to be a default/example value and must be changed"
    );
  }
  if (key && key.length < 20) {
    logger.warn(
      "PAGERDUTY_API_KEY appears to be too short for a valid API key"
    );
  }
  return key;
}

/**
 * Load and validate Redis URL
 */
export function loadRedisUrl(): string {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  if (isKnownDefault(url)) {
    throw new Error("REDIS_URL appears to be a default value and must be changed");
  }
  return url;
}

/**
 * Load and validate database URL
 */
export function loadDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (url && isKnownDefault(url)) {
    throw new Error(
      "DATABASE_URL appears to be a default value and must be changed"
    );
  }
  if (url && url.includes("password")) {
    logger.warn("DATABASE_URL contains password in connection string; use environment variables");
  }
  return url;
}

/**
 * Load and validate RPC URL
 */
export function loadRpcUrl(): string {
  const url = process.env.RPC_URL || process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
  if (isKnownDefault(url)) {
    throw new Error("RPC_URL appears to be a default value and must be changed");
  }
  return url;
}

/**
 * Load all secrets at once
 */
export function loadAllSecrets(): SecretsConfig {
  return {
    jwtSecret: process.env.JWT_SECRET,
    pagerDutyApiKey: loadPagerDutyApiKey(),
    redisUrl: loadRedisUrl(),
    databaseUrl: loadDatabaseUrl(),
    rpcUrl: loadRpcUrl(),
  };
}
