/**
 * License Validation System
 *
 * Validates license keys for the Portainer Migrator tool.
 * Supports both online validation (via license server) and offline validation.
 */

import { config } from "../config.js";
import { db, licenses } from "../db/index.js";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { License, LicenseValidationResult } from "../types/index.js";

// License key format: PM-XXXX-XXXX-XXXX-XXXX (PM = Portainer Migrator)
const LICENSE_KEY_PATTERN = /^PM-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

// Feature flags
export const FEATURES = {
  UNLIMITED_MIGRATIONS: "unlimited_migrations",
  UNLIMITED_STACKS: "unlimited_stacks",
  BOLTDB_SUPPORT: "boltdb_support",
  DRY_RUN: "dry_run",
  AUTO_DEPLOY: "auto_deploy",
  PRIORITY_SUPPORT: "priority_support",
  API_ACCESS: "api_access",
  EXPORT_REPORTS: "export_reports",
} as const;

// License type configurations
const LICENSE_CONFIGS: Record<string, {
  maxMigrations: number | null;
  maxStacks: number | null;
  features: string[];
}> = {
  trial: {
    maxMigrations: 3,
    maxStacks: 10,
    features: [FEATURES.DRY_RUN],
  },
  standard: {
    maxMigrations: 10,
    maxStacks: 50,
    features: [FEATURES.DRY_RUN, FEATURES.BOLTDB_SUPPORT],
  },
  professional: {
    maxMigrations: null, // unlimited
    maxStacks: null, // unlimited
    features: [
      FEATURES.DRY_RUN,
      FEATURES.BOLTDB_SUPPORT,
      FEATURES.AUTO_DEPLOY,
      FEATURES.EXPORT_REPORTS,
    ],
  },
  enterprise: {
    maxMigrations: null,
    maxStacks: null,
    features: [
      FEATURES.UNLIMITED_MIGRATIONS,
      FEATURES.UNLIMITED_STACKS,
      FEATURES.BOLTDB_SUPPORT,
      FEATURES.DRY_RUN,
      FEATURES.AUTO_DEPLOY,
      FEATURES.PRIORITY_SUPPORT,
      FEATURES.API_ACCESS,
      FEATURES.EXPORT_REPORTS,
    ],
  },
};

/**
 * Validate license key format
 */
export function isValidLicenseKeyFormat(key: string): boolean {
  return LICENSE_KEY_PATTERN.test(key);
}

/**
 * Validate license key (online or offline)
 */
export async function validateLicense(licenseKey: string): Promise<LicenseValidationResult> {
  // Check format
  if (!isValidLicenseKeyFormat(licenseKey)) {
    return { valid: false, error: "Invalid license key format" };
  }

  // Check if already activated locally
  const localLicense = await getLocalLicense(licenseKey);
  if (localLicense) {
    // Verify expiration
    if (new Date(localLicense.expiresAt) < new Date()) {
      await markLicenseInvalid(licenseKey);
      return { valid: false, error: "License has expired" };
    }
    return { valid: true, license: localLicense };
  }

  // Try online validation
  if (config.licenseServerUrl) {
    try {
      const result = await validateOnline(licenseKey);
      if (result.valid && result.license) {
        await storeLicense(result.license);
      }
      return result;
    } catch (error) {
      // Fall back to offline validation
      console.warn("Online license validation failed, using offline mode");
    }
  }

  // Offline validation (decode key)
  return validateOffline(licenseKey);
}

/**
 * Online license validation via license server
 */
async function validateOnline(licenseKey: string): Promise<LicenseValidationResult> {
  const response = await fetch(`${config.licenseServerUrl}/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: licenseKey,
      product: "portainer-migrator",
      version: "1.0.0",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return { valid: false, error };
  }

  const data = await response.json();
  return {
    valid: data.valid,
    license: data.license,
    error: data.error,
  };
}

/**
 * Offline license validation (basic key decoding)
 */
function validateOffline(licenseKey: string): LicenseValidationResult {
  // For offline mode, we use a simple encoding scheme
  // In production, you'd use proper cryptographic signing

  try {
    // Extract parts from key: PM-TYPE-EXPR-RAND-CHCK
    const parts = licenseKey.split("-");
    if (parts.length !== 5) {
      return { valid: false, error: "Invalid key structure" };
    }

    // Decode type from second segment
    const typeCode = parts[1];
    let type: "trial" | "standard" | "professional" | "enterprise" = "trial";

    if (typeCode.startsWith("TRL")) type = "trial";
    else if (typeCode.startsWith("STD")) type = "standard";
    else if (typeCode.startsWith("PRO")) type = "professional";
    else if (typeCode.startsWith("ENT")) type = "enterprise";

    // Decode expiration from third segment (YYMM format encoded)
    const exprCode = parts[2];
    const year = 2020 + parseInt(exprCode.slice(0, 2), 36);
    const month = parseInt(exprCode.slice(2, 4), 36) % 12;
    const expiresAt = new Date(year, month + 1, 0).toISOString();

    // Verify expiration
    if (new Date(expiresAt) < new Date()) {
      return { valid: false, error: "License has expired" };
    }

    const licenseConfig = LICENSE_CONFIGS[type];

    const license: License = {
      key: licenseKey,
      type,
      holder: "Offline User",
      email: "offline@local",
      expiresAt,
      features: licenseConfig.features,
      maxMigrations: licenseConfig.maxMigrations ?? undefined,
      maxStacks: licenseConfig.maxStacks ?? undefined,
      isValid: true,
    };

    return { valid: true, license };
  } catch {
    return { valid: false, error: "Failed to decode license key" };
  }
}

/**
 * Get locally stored license
 */
async function getLocalLicense(licenseKey: string): Promise<License | null> {
  const result = await db.query.licenses.findFirst({
    where: eq(licenses.licenseKey, licenseKey),
  });

  if (!result) return null;

  return {
    key: result.licenseKey,
    type: result.type as License["type"],
    holder: result.holder,
    email: result.email,
    expiresAt: result.expiresAt,
    features: (result.features as string[]) || [],
    maxMigrations: result.maxMigrations ?? undefined,
    maxStacks: result.maxStacks ?? undefined,
    isValid: result.isValid,
  };
}

/**
 * Store license locally
 */
async function storeLicense(license: License): Promise<void> {
  await db.insert(licenses).values({
    id: nanoid(),
    licenseKey: license.key,
    type: license.type,
    holder: license.holder,
    email: license.email,
    expiresAt: license.expiresAt,
    features: license.features,
    maxMigrations: license.maxMigrations,
    maxStacks: license.maxStacks,
    isValid: license.isValid,
  }).onConflictDoUpdate({
    target: licenses.licenseKey,
    set: {
      type: license.type,
      holder: license.holder,
      email: license.email,
      expiresAt: license.expiresAt,
      features: license.features,
      maxMigrations: license.maxMigrations,
      maxStacks: license.maxStacks,
      isValid: license.isValid,
      lastValidatedAt: sql`datetime('now')`,
    },
  });
}

/**
 * Mark license as invalid
 */
async function markLicenseInvalid(licenseKey: string): Promise<void> {
  await db.update(licenses)
    .set({ isValid: false })
    .where(eq(licenses.licenseKey, licenseKey));
}

/**
 * Get active license
 */
export async function getActiveLicense(): Promise<License | null> {
  const result = await db.query.licenses.findFirst({
    where: eq(licenses.isValid, true),
  });

  if (!result) return null;

  // Check expiration
  if (new Date(result.expiresAt) < new Date()) {
    await markLicenseInvalid(result.licenseKey);
    return null;
  }

  return {
    key: result.licenseKey,
    type: result.type as License["type"],
    holder: result.holder,
    email: result.email,
    expiresAt: result.expiresAt,
    features: (result.features as string[]) || [],
    maxMigrations: result.maxMigrations ?? undefined,
    maxStacks: result.maxStacks ?? undefined,
    isValid: result.isValid,
  };
}

/**
 * Check if a feature is enabled
 */
export async function hasFeature(feature: string): Promise<boolean> {
  const license = await getActiveLicense();
  if (!license) return false;
  return license.features.includes(feature);
}

/**
 * Check migration limits
 */
export async function canCreateMigration(): Promise<{ allowed: boolean; reason?: string }> {
  const license = await getActiveLicense();

  if (!license) {
    return { allowed: false, reason: "No valid license found" };
  }

  if (license.maxMigrations === undefined) {
    return { allowed: true };
  }

  // Count existing migrations
  const countResult = await db.select({ count: sql<number>`count(*)` })
    .from(licenses);

  // This is simplified - in production, count from migrations table
  const currentCount = 0; // Replace with actual count

  if (currentCount >= license.maxMigrations) {
    return {
      allowed: false,
      reason: `Migration limit reached (${license.maxMigrations} migrations)`,
    };
  }

  return { allowed: true };
}

/**
 * Generate a license key (for admin/testing purposes)
 */
export function generateLicenseKey(
  type: "trial" | "standard" | "professional" | "enterprise",
  expiresAt: Date
): string {
  const typeCode = {
    trial: "TRL",
    standard: "STD",
    professional: "PRO",
    enterprise: "ENT",
  }[type];

  const year = expiresAt.getFullYear() - 2020;
  const month = expiresAt.getMonth();
  const exprCode = year.toString(36).toUpperCase().padStart(2, "0") +
                   month.toString(36).toUpperCase().padStart(2, "0");

  const random = () => Math.random().toString(36).substring(2, 6).toUpperCase();

  return `PM-${typeCode}${random().slice(0, 1)}-${exprCode}${random().slice(0, 2)}-${random()}-${random()}`;
}
