import { TASK_PRIORITIES, TASK_STATUSES, TASK_PRIORITY_LABEL, TASK_STATUS_LABEL, type TaskPriority, type TaskStatus } from "@/lib/tasks/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  status: TaskStatus | "all";
  priority: TaskPriority | "all";
  search: string;
  onChange: (next: { status?: TaskStatus | "all"; priority?: TaskPriority | "all"; search?: string }) => void;
}

export function TaskFilters({ status, priority, search, onChange }: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div>
        <Label className="text-xs uppercase">Status</Label>
        <Select value={status} onValueChange={(v) => onChange({ status: v as TaskStatus | "all" })}>
          <SelectTrigger className="rounded-none border-2 border-foreground"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{TASK_STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs uppercase">Priority</Label>
        <Select value={priority} onValueChange={(v) => onChange({ priority: v as TaskPriority | "all" })}>
          <SelectTrigger className="rounded-none border-2 border-foreground"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {TASK_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>{TASK_PRIORITY_LABEL[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs uppercase">Search</Label>
        <Input
          value={search}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder="Title, task number, account…"
          className="rounded-none border-2 border-foreground"
        />
      </div>
    </div>
  );
}