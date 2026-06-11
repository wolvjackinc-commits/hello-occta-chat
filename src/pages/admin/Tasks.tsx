import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { TaskFilters } from "@/components/admin/tasks/TaskFilters";
import { TaskListTable } from "@/components/admin/tasks/TaskListTable";
import { TaskFormDialog } from "@/components/admin/tasks/TaskFormDialog";
import { TaskDetailDrawer } from "@/components/admin/tasks/TaskDetailDrawer";
import { TaskSuggestionsPanel } from "@/components/admin/tasks/TaskSuggestionsPanel";
import type { AdminTask, TaskPriority, TaskStatus, TaskSuggestion } from "@/lib/tasks/types";

export default function AdminTasks() {
  const [params] = useSearchParams();
  const accountFilter = params.get("account") ?? "";
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [status, setStatus] = useState<TaskStatus | "all">("open");
  const [priority, setPriority] = useState<TaskPriority | "all">("all");
  const [search, setSearch] = useState(accountFilter);
  const [createOpen, setCreateOpen] = useState(false);
  const [prefill, setPrefill] = useState<Partial<AdminTask> | undefined>(undefined);
  const [selected, setSelected] = useState<AdminTask | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("admin_tasks")
      .select("*")
      .order("created_at", { ascending: false });
    setTasks((data ?? []) as AdminTask[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (status !== "all" && t.status !== status) return false;
      if (priority !== "all" && t.priority !== priority) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.task_number.toLowerCase().includes(q) ||
        (t.related_account_number ?? "").toLowerCase().includes(q)
      );
    });
  }, [tasks, status, priority, search]);

  const handleSuggestion = (s: TaskSuggestion) => {
    setPrefill({ title: s.title, description: s.description, priority: s.priority });
    setCreateOpen(true);
  };

  return (
    <div className="space-y-6">
      <Helmet><title>Admin · Tasks</title></Helmet>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl uppercase">Task queue</h1>
          <p className="text-sm text-muted-foreground">
            Internal workflow only. No supplier orders, payments, or emails are triggered by anything on this page.
          </p>
        </div>
        <Button
          onClick={() => { setPrefill(accountFilter ? { related_account_number: accountFilter } : undefined); setCreateOpen(true); }}
          className="rounded-none border-2 border-foreground"
        >
          Create task
        </Button>
      </header>

      <TaskFilters
        status={status}
        priority={priority}
        search={search}
        onChange={(next) => {
          if (next.status !== undefined) setStatus(next.status);
          if (next.priority !== undefined) setPriority(next.priority);
          if (next.search !== undefined) setSearch(next.search);
        }}
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <TaskListTable tasks={filtered} onSelect={setSelected} />
      )}

      <TaskSuggestionsPanel onUse={handleSuggestion} />

      <TaskFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={load}
        prefill={prefill as any}
      />

      <TaskDetailDrawer
        task={selected}
        onOpenChange={(open) => { if (!open) setSelected(null); }}
        onChanged={async () => { await load(); }}
      />
    </div>
  );
}