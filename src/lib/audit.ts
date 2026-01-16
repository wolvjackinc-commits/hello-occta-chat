import { supabase } from "@/integrations/supabase/client";

type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "suspend"
  | "resume"
  | "cancel"
  | "activate"
  | "assign"
  | "unassign"
  | "send"
  | "mark_paid"
  | "void"
  | "reply"
  | "close"
  | "reopen";

type AuditEntity =
  | "service"
  | "invoice"
  | "receipt"
  | "credit_note"
  | "dd_mandate"
  | "payment_attempt"
  | "support_ticket"
  | "ticket_message"
  | "profile"
  | "user_role";

interface LogAuditParams {
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an audit action to the audit_logs table.
 * Should be called after every admin mutation.
 */
export async function logAudit({ action, entity, entityId, metadata = {} }: LogAuditParams): Promise<void> {
  try {
    const { error } = await supabase.from("audit_logs" as any).insert({
      action,
      entity,
      entity_id: entityId || null,
      metadata,
    });
    
    if (error) {
      console.error("Failed to log audit action:", error);
    }
  } catch (err) {
    console.error("Audit logging error:", err);
  }
}

/**
 * Fetch recent audit logs for the admin overview.
 */
export async function fetchRecentAuditLogs(limit = 20) {
  const { data, error } = await supabase
    .from("audit_logs" as any)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error("Failed to fetch audit logs:", error);
    return [];
  }
  
  return data || [];
}
