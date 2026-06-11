export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus =
  | "open"
  | "in_progress"
  | "waiting_customer"
  | "waiting_supplier"
  | "resolved"
  | "cancelled";

export const TASK_PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];
export const TASK_STATUSES: TaskStatus[] = [
  "open",
  "in_progress",
  "waiting_customer",
  "waiting_supplier",
  "resolved",
  "cancelled",
];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_customer: "Waiting on customer",
  waiting_supplier: "Waiting on supplier/admin action",
  resolved: "Resolved",
  cancelled: "Cancelled",
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export interface AdminTask {
  id: string;
  task_number: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  related_customer_id: string | null;
  related_account_number: string | null;
  related_quote_id: string | null;
  related_contract_summary_id: string | null;
  related_payment_request_id: string | null;
  assigned_to: string | null;
  due_date: string | null;
  created_by: string;
  cancelled_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminTaskNote {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface TaskSuggestion {
  key: string;
  title: string;
  description: string;
  priority: TaskPriority;
}