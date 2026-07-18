import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { readSignupIdentity, resolveIdentity } from "../lib/db/identity.js";

async function withIdentityFiles(
  files: { json?: Record<string, unknown>; txt?: string },
  run: (paths: { signupJsonPath: string; signupTxtPath: string }) => Promise<void> | void
): Promise<void> {
  const directory = await mkdtemp(path.join(process.cwd(), ".test-db-identity-"));
  const signupJsonPath = path.join(directory, "SIGNUP.json");
  const signupTxtPath = path.join(directory, "SIGNUP.txt");
  try {
    if (files.json) await writeFile(signupJsonPath, JSON.stringify(files.json), "utf8");
    if (files.txt) await writeFile(signupTxtPath, files.txt, "utf8");
    await run({ signupJsonPath, signupTxtPath });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("rejects missing signup identity instead of using a default tenant", async () => {
  await withIdentityFiles({}, (paths) => {
    assert.throws(() => readSignupIdentity(paths), /Active signup identity not found/);
  });
});

test("rejects inactive or incomplete signup state", async () => {
  await withIdentityFiles({ json: { signup: false, company_id: 1, user_id: 1 } }, (paths) => {
    assert.throws(() => readSignupIdentity(paths), /does not contain active signup IDs/);
  });
});

test("accepts a valid active signup identity", async () => {
  await withIdentityFiles({ json: { signup: true, company_id: 27, user_id: 42 } }, (paths) => {
    assert.deepEqual(readSignupIdentity(paths), {
      company_id: 27,
      user_id: 42,
      source: "signup_json",
      signup: true,
      warnings: []
    });
  });
});

test("requires explicit tenant overrides as a complete pair", () => {
  assert.throws(() => resolveIdentity({ company_id: 27 }), /must be supplied together/);
  assert.deepEqual(resolveIdentity({ company_id: 27, user_id: 42 }), {
    company_id: 27,
    user_id: 42,
    source: "explicit",
    signup: true,
    warnings: []
  });
});
