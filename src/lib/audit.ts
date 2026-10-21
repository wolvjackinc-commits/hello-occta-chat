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
  | "reopen"
  | "view_sensitive"
  | "payment_received"
  | "phone_payment"
  | "verify"
  | "submit_to_provider"
  | "link"
  | "chat_transcript_export"
  | "error";

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
  | "user_role"
  | "customer_dob"
  | "payment_request"
  | "billing_settings"
  | "ticket_internal_note"
  | "complaint"
  | "complaint_event"
  | "communication_thread"
  | "communication_message"
  | "payment_reconciliation"
  | "chat_conversation"
  | "admin_overview";

interface LogAuditParams {
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an audit action to the audit_logs table.
 * Should be called after every admin mutation. audit_logs has no insert
 * policy: writes go through log_audit_action(), which checks the caller is staff.
 */
export async function logAudit({ action, entity, entityId, metadata = {} }: LogAuditParams): Promise<void> {
  try {
    const { error } = await supabase.rpc("log_audit_action", {
      _action: action,
      _entity: entity,
      _entity_id: entityId || undefined,
      _metadata: metadata as any,
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
