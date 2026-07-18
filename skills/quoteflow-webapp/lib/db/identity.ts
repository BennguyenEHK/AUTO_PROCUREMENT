import fs from "node:fs";

export type SignupIdentitySource = "signup_json" | "explicit";

export interface SignupIdentity {
  company_id: number;
  user_id: number;
  source: SignupIdentitySource;
  signup: true;
  warnings: string[];
}

export interface SignupIdentityPaths {
  signupJsonPath?: string;
}

const DEFAULT_SIGNUP_JSON_PATH =
  "C:\\Users\\LENOVO\\.codex\\skills\\quoteflow-webapp\\SIGNUP.json";

function numericId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function readJsonIdentity(filePath: string): SignupIdentity | string | null {
  if (!fs.existsSync(filePath)) return null;
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
  const companyId = numericId(parsed.company_id);
  const userId = numericId(parsed.user_id);
  if (!companyId || !userId || parsed.signup !== true) {
    return "SIGNUP.json exists but does not contain active signup IDs.";
  }
  return {
    company_id: companyId,
    user_id: userId,
    source: "signup_json",
    signup: true,
    warnings: []
  };
}

export function readSignupIdentity(options: SignupIdentityPaths = {}): SignupIdentity {
  const warnings: string[] = [];
  for (const identity of [readJsonIdentity(options.signupJsonPath ?? DEFAULT_SIGNUP_JSON_PATH)]) {
    if (!identity) continue;
    if (typeof identity === "string") {
      warnings.push(identity);
      continue;
    }
    return identity;
  }

  const details = warnings.length > 0 ? ` ${warnings.join(" ")}` : "";
  throw new Error(
    `Active signup identity not found.${details} Run setup-preflight and complete QuoteFlow signup, or pass both --company-id and --user-id.`
  );
}

export function resolveIdentity(
  overrides: { company_id?: number; user_id?: number } & SignupIdentityPaths = {}
): SignupIdentity {
  const hasCompanyId = overrides.company_id !== undefined;
  const hasUserId = overrides.user_id !== undefined;
  if (hasCompanyId !== hasUserId) {
    throw new Error("--company-id and --user-id must be supplied together.");
  }
  if (hasCompanyId && hasUserId) {
    const companyId = numericId(overrides.company_id);
    const userId = numericId(overrides.user_id);
    if (!companyId || !userId) {
      throw new Error("--company-id and --user-id must be positive integers.");
    }
    return {
      company_id: companyId,
      user_id: userId,
      source: "explicit",
      signup: true,
      warnings: []
    };
  }
  return readSignupIdentity(overrides);
}
