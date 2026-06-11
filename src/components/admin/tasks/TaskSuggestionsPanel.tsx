import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STATIC_SUGGESTIONS } from "@/lib/tasks/suggestions";
import { TASK_PRIORITY_LABEL, type TaskSuggestion } from "@/lib/tasks/types";

interface Props {
  onUse: (s: TaskSuggestion) => void;
}

export function TaskSuggestionsPanel({ onUse }: Props) {
  return (
    <section className="border-2 border-foreground p-4">
      <h2 className="font-display text-sm uppercase">Suggestions (not auto-created)</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        These are prompts only. Opening this page does not create any task. Click "Use" to prefill a new task.
      </p>
      <ul className="space-y-2">
        {STATIC_SUGGESTIONS.map((s) => (
          <li key={s.key} className="flex items-start justify-between gap-3 border-2 border-foreground p-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{s.title}</p>
                <Badge variant="outline" className="rounded-none border-2 border-foreground text-xs">{TASK_PRIORITY_LABEL[s.priority]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{s.description}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => onUse(s)} className="rounded-none border-2 border-foreground">Use</Button>
          </li>
        ))}
      </ul>
    </section>
  );
}