import { db, auditLogsTable } from "@visit-control/db";

interface AuditParams {
  userId: number;
  action: string;
  ipAddress?: string | null;
  entityType?: string | null;
  entityId?: number | null;
  previousData?: unknown;
  newData?: unknown;
}

export async function auditAction(params: AuditParams): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      userId: params.userId,
      action: params.action,
      ipAddress: params.ipAddress ?? null,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      previousData: params.previousData
        ? JSON.stringify(params.previousData)
        : null,
      newData: params.newData ? JSON.stringify(params.newData) : null,
    });
  } catch {
    // Audit failures must not break the main flow
  }
}
