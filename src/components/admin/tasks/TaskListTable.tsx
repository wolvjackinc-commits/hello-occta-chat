import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TASK_PRIORITY_LABEL, TASK_STATUS_LABEL, type AdminTask } from "@/lib/tasks/types";

interface Props {
  tasks: AdminTask[];
  onSelect: (task: AdminTask) => void;
}

export function TaskListTable({ tasks, onSelect }: Props) {
  if (tasks.length === 0) {
    return <p className="border-2 border-foreground p-6 text-center text-sm text-muted-foreground">No tasks match the current filters.</p>;
  }
  return (
    <div className="border-2 border-foreground">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Due</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((t) => (
            <TableRow key={t.id} className="cursor-pointer" onClick={() => onSelect(t)}>
              <TableCell className="font-mono text-xs">{t.task_number}</TableCell>
              <TableCell className="font-medium">{t.title}</TableCell>
              <TableCell><Badge variant="outline" className="rounded-none border-2 border-foreground">{TASK_STATUS_LABEL[t.status]}</Badge></TableCell>
              <TableCell><Badge variant="outline" className="rounded-none border-2 border-foreground">{TASK_PRIORITY_LABEL[t.priority]}</Badge></TableCell>
              <TableCell>{t.related_account_number ?? "—"}</TableCell>
              <TableCell>{t.due_date ? new Date(t.due_date).toLocaleDateString() : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}