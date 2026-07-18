import type { FinalReportNotificationDraft } from "../services/notifications.js";

export type NotificationRow = Record<string, unknown> & {
  notification_id?: number;
  company_id?: number;
  user_id?: number;
  rfq_id?: number;
  is_read?: boolean;
};

export type NotificationQuery = (
  sql: string,
  params?: unknown[]
) => Promise<Array<Record<string, unknown>>>;

export interface NotificationScope {
  company_id: number;
  user_id: number;
}

export interface NotificationListOptions {
  rfq_id?: number;
  unread_only?: boolean;
  limit?: number;
}

export interface NotificationListResult {
  notifications: NotificationRow[];
  unread_count: number;
}

export async function createFinalReportReadyNotification(
  execute: NotificationQuery,
  scope: NotificationScope,
  draft: FinalReportNotificationDraft
): Promise<NotificationRow | null> {
  assertScope(scope);
  const rows = await execute(
    `insert into notifications
       (company_id, user_id, rfq_id, event_type, report_type, title, message)
     select $1, $2, rfq.rfq_id, $4, $5, $6, $7
       from rfq_analysis rfq
       join user_info usr on usr.user_id = $2 and usr.company_id = $1
      where rfq.rfq_id = $3
        and rfq.company_id = $1
        and (rfq.user_id is null or rfq.user_id = $2)
     on conflict (company_id, user_id, rfq_id, event_type, report_type) do nothing
     returning *`,
    [
      scope.company_id,
      scope.user_id,
      draft.rfq_id,
      draft.event_type,
      draft.report_type,
      draft.title,
      draft.message
    ]
  );
  return (rows[0] as NotificationRow | undefined) ?? null;
}

export async function listNotifications(
  execute: NotificationQuery,
  scope: NotificationScope,
  options: NotificationListOptions = {}
): Promise<NotificationListResult> {
  assertScope(scope);
  const params: unknown[] = [scope.company_id, scope.user_id];
  const filters = ["company_id = $1", "user_id = $2"];
  if (options.rfq_id !== undefined) {
    assertPositiveId(options.rfq_id, "rfq_id");
    params.push(options.rfq_id);
    filters.push(`rfq_id = $${params.length}`);
  }
  if (options.unread_only) filters.push("is_read = false");

  const limit = clampLimit(options.limit);
  const notifications = await execute(
    `select notification_id, company_id, user_id, rfq_id, event_type, report_type,
            title, message, is_read, read_at, created_at, updated_at
       from notifications
      where ${filters.join(" and ")}
      order by created_at desc, notification_id desc
      limit $${params.length + 1}`,
    [...params, limit]
  );

  const unreadFilters = filters.filter((filter) => filter !== "is_read = false");
  unreadFilters.push("is_read = false");
  const unreadRows = await execute(
    `select count(*)::int as unread_count
       from notifications
      where ${unreadFilters.join(" and ")}`,
    params
  );

  return {
    notifications: notifications as NotificationRow[],
    unread_count: Number(unreadRows[0]?.unread_count ?? 0)
  };
}

export async function markNotificationRead(
  execute: NotificationQuery,
  scope: NotificationScope,
  notificationId: number
): Promise<NotificationRow | null> {
  assertScope(scope);
  assertPositiveId(notificationId, "notification_id");
  const rows = await execute(
    `update notifications
        set is_read = true,
            read_at = coalesce(read_at, now()),
            updated_at = now()
      where notification_id = $1 and company_id = $2 and user_id = $3
      returning notification_id, company_id, user_id, rfq_id, event_type, report_type,
                title, message, is_read, read_at, created_at, updated_at`,
    [notificationId, scope.company_id, scope.user_id]
  );
  return (rows[0] as NotificationRow | undefined) ?? null;
}

function assertScope(scope: NotificationScope): void {
  assertPositiveId(scope.company_id, "company_id");
  assertPositiveId(scope.user_id, "user_id");
}

function assertPositiveId(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer.`);
}

function clampLimit(value: number | undefined): number {
  if (value === undefined) return 50;
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(1, Math.trunc(value)));
}
