import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFinalReportReadyNotification,
  type FinalReportReadyInput
} from "../lib/services/notifications.js";
import {
  createFinalReportReadyNotification,
  listNotifications,
  markNotificationRead,
  type NotificationQuery
} from "../lib/db/notifications.js";

const scope = { company_id: 12, user_id: 34 };

function readyInput(overrides: Partial<FinalReportReadyInput> = {}): FinalReportReadyInput {
  return {
    rfq_id: 56,
    report_type: "technical_compliance_review",
    readiness: { state: "ready", is_ready: true },
    document_ready: true,
    rfq_reference: "RFQ-56",
    ...overrides
  };
}

test("builds notifications only for a final-ready report", () => {
  const draft = buildFinalReportReadyNotification(readyInput());

  assert.deepEqual(draft, {
    rfq_id: 56,
    event_type: "final_report_ready",
    report_type: "technical_compliance_review",
    title: "Final report ready",
    message: "Technical compliance review is ready for RFQ RFQ-56."
  });
  assert.equal(buildFinalReportReadyNotification(readyInput({ readiness: { state: "collecting", is_ready: false } })), null);
  assert.equal(buildFinalReportReadyNotification(readyInput({ document_ready: false })), null);
  assert.equal(buildFinalReportReadyNotification(readyInput({ report_type: "rfq_analysis" as never })), null);
});

test("creates a tenant and RFQ scoped notification idempotently", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const execute: NotificationQuery = async (sql, params = []) => {
    calls.push({ sql, params });
    return [{ notification_id: 91 }] as never[];
  };
  const draft = buildFinalReportReadyNotification(readyInput());
  assert.ok(draft);

  const row = await createFinalReportReadyNotification(execute, scope, draft);

  assert.equal(row?.notification_id, 91);
  assert.match(calls[0].sql, /insert into notifications/i);
  assert.match(calls[0].sql, /from rfq_analysis/i);
  assert.match(calls[0].sql, /on conflict \(company_id, user_id, rfq_id, event_type, report_type\) do nothing/i);
  assert.deepEqual(calls[0].params.slice(0, 3), [12, 34, 56]);
});

test("lists unread notifications within the active tenant and optional RFQ", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const execute: NotificationQuery = async (sql, params = []) => {
    calls.push({ sql, params });
    return sql.includes("count(*)") ? [{ unread_count: 2 }] as never[] : [{ notification_id: 7 }] as never[];
  };

  const result = await listNotifications(execute, scope, { rfq_id: 56, unread_only: true, limit: 25 });

  assert.equal(result.unread_count, 2);
  assert.equal(result.notifications.length, 1);
  assert.match(calls[0].sql, /company_id = \$1 and user_id = \$2 and rfq_id = \$3 and is_read = false/i);
  assert.deepEqual(calls[0].params, [12, 34, 56, 25]);
  assert.deepEqual(calls[1].params, [12, 34, 56]);
});

test("marks only the active tenant's notification as read", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const execute: NotificationQuery = async (sql, params = []) => {
    calls.push({ sql, params });
    return [{ notification_id: 91, is_read: true }] as never[];
  };

  const row = await markNotificationRead(execute, scope, 91);

  assert.equal(row?.notification_id, 91);
  assert.match(calls[0].sql, /where notification_id = \$1 and company_id = \$2 and user_id = \$3/i);
  assert.deepEqual(calls[0].params, [91, 12, 34]);
});
