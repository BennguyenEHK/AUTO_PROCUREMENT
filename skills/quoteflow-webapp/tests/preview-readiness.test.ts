import assert from "node:assert/strict";
import test from "node:test";
import { isReportableStageRow, readinessForItems } from "../lib/services/preview/readiness.ts";

const requirements = ["Every RFQ item needs final evidence."];

test("allows a final report only when every RFQ item is covered", () => {
  const readiness = readinessForItems([1, 2, 3], [3, 1, 2], requirements);
  assert.equal(readiness.is_ready, true);
  assert.equal(readiness.state, "ready");
  assert.deepEqual(readiness.missing_item_ids, []);
  assert.deepEqual(readiness.blockers, []);
});

test("keeps partial evidence interim and identifies its blockers", () => {
  const readiness = readinessForItems([1, 2, 3], [1], requirements);
  assert.equal(readiness.is_ready, false);
  assert.equal(readiness.state, "collecting");
  assert.deepEqual(readiness.missing_item_ids, [2, 3]);
  assert.match(readiness.blockers[0]!, /2, 3/);
});

test("excludes draft normalization rows from final coverage", () => {
  assert.equal(isReportableStageRow({ item_id: 1, supplier_name: "Supplier A", status: "draft", payload: { quote_reference: "Q-1" } }, "supplier_quote_normalization"), false);
});

test("accepts technical evidence and documented insufficient-evidence blockers", () => {
  assert.equal(isReportableStageRow({ item_id: 1, status: "compliant", payload: { requirement: "IP65", offered: "IP65", datasheet: "https://example.test/data" } }, "technical_compliance_review"), true);
  assert.equal(isReportableStageRow({ item_id: 2, status: "insufficient evidence", summary: "Supplier has not supplied a datasheet.", payload: {} }, "technical_compliance_review"), true);
});
