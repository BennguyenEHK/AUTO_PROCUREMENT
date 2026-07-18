import fs from "node:fs/promises";
import path from "node:path";

export interface SignupState {
  signup: boolean;
  user_id: number | null;
  company_id: number | null;
  username?: string;
  company_name?: string;
  updated_at?: string;
}

const emptySignupState: SignupState = {
  signup: false,
  user_id: null,
  company_id: null
};

// One canonical, app-local identity record for both the UI and database CLI.
export const signupStatePath = path.join(process.cwd(), "SIGNUP.json");

export async function readSignupState(): Promise<SignupState> {
  try {
    return normalizeSignupState(JSON.parse(await fs.readFile(signupStatePath, "utf8")));
  } catch {
    return emptySignupState;
  }
}

export async function writeSignupState(state: SignupState): Promise<void> {
  const next = { ...normalizeSignupState(state), updated_at: new Date().toISOString() };
  if (next.signup && (!next.user_id || !next.company_id)) {
    throw new Error("Active signup state requires positive user_id and company_id values.");
  }
  const contents = `${JSON.stringify(next, null, 2)}\n`;
  await writeJsonAtomically(signupStatePath, contents);
}

async function writeJsonAtomically(targetPath: string, contents: string): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  await fs.writeFile(temporaryPath, contents, "utf8");
  await fs.rename(temporaryPath, targetPath);
}

function normalizeSignupState(value: unknown): SignupState {
  const state = value as Partial<SignupState>;
  return {
    signup: state.signup === true,
    user_id: toId(state.user_id),
    company_id: toId(state.company_id),
    ...(typeof state.username === "string" ? { username: state.username } : {}),
    ...(typeof state.company_name === "string" ? { company_name: state.company_name } : {}),
    ...(typeof state.updated_at === "string" ? { updated_at: state.updated_at } : {})
  };
}

function toId(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}
