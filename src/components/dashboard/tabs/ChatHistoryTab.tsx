import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { MessageSquare } from "lucide-react";
import { EmptyState } from "./EmptyState";

type Row = { id: string; session_id: string; message_type: string; message_content: string | null; created_at: string };

export function ChatHistoryTab({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("chat_analytics")
        .select("id,session_id,message_type,message_content,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) setDenied(true);
      setRows((data as Row[]) || []);
      setLoading(false);
    })();
  }, [userId]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (denied || rows.length === 0) {
    return <EmptyState icon={<MessageSquare className="w-8 h-8" />} title="No chat history yet" message="Chat history will appear here after you contact OCCTA support." />;
  }

  return (
    <div className="space-y-2">
      {rows.map(r => (
        <div key={r.id} className="p-3 border-2 border-foreground bg-background">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase text-muted-foreground">{r.message_type}</span>
            <span className="text-xs text-muted-foreground">{format(new Date(r.created_at), "dd MMM yyyy HH:mm")}</span>
          </div>
          <p className="text-sm">{r.message_content}</p>
        </div>
      ))}
    </div>
  );
}