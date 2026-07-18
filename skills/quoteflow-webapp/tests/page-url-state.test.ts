import assert from "node:assert/strict";
import test from "node:test";
import { defaultPageUrlState, readPageUrlState, writePageUrlState } from "../app/page-url-state";

test("reads supported deep-link values", () => {
  assert.deepEqual(
    readPageUrlState(new URLSearchParams("view=proposal&tab=certificates&rfqId=42")),
    { view: "proposal", tab: "certificates", rfqId: 42 }
  );
});

test("falls back safely for unsupported or malformed location values", () => {
  assert.deepEqual(
    readPageUrlState(new URLSearchParams("view=other&tab=other&rfqId=not-a-number")),
    defaultPageUrlState
  );
});

test("writes an exact sharable location without discarding unrelated parameters", () => {
  const params = writePageUrlState(
    { view: "pricing", tab: "quotes", rfqId: 12 },
    new URLSearchParams("source=email")
  );

  assert.equal(params.toString(), "source=email&view=pricing&tab=quotes&rfqId=12");
});
