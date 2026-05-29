import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import { MessageSquare, Search, User, Bot, Clock, Hash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type ChatRow = {
  id: string;
  session_id: string;
  user_id: string | null;
  message_type: string;
  message_content: string;
  detected_intent: string | null;
  detected_category: string | null;
  response_time_ms: number | null;
  created_at: string;
};

type SessionSummary = {
  session_id: string;
  user_id: string | null;
  user_email: string | null;
  first_at: string;
  last_at: string;
  message_count: number;
  user_message_count: number;
  last_user_message: string;
  categories: string[];
  intents: string[];
};

export function AdminChatTranscripts() {
  const [search, setSearch] = useState("");
  const [activeSession, setActiveSession] = useState<string | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["chat-analytics-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_analytics")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data as ChatRow[]) ?? [];
    },
    refetchInterval: 30000,
  });

  const userIds = useMemo(
    () => Array.from(new Set((rows ?? []).map((r) => r.user_id).filter(Boolean) as string[])),
    [rows]
  );

  const { data: profiles } = useQuery({
    queryKey: ["chat-profiles", userIds.sort().join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,email,full_name")
        .in("id", userIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const profileMap = useMemo(() => {
    const m = new Map<string, { email: string | null; full_name: string | null }>();
    (profiles ?? []).forEach((p: any) => m.set(p.id, { email: p.email, full_name: p.full_name }));
    return m;
  }, [profiles]);

  const sessions: SessionSummary[] = useMemo(() => {
    const map = new Map<string, SessionSummary>();
    const ordered = [...(rows ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (const r of ordered) {
      const existing = map.get(r.session_id);
      const profile = r.user_id ? profileMap.get(r.user_id) : null;
      if (!existing) {
        map.set(r.session_id, {
          session_id: r.session_id,
          user_id: r.user_id,
          user_email: profile?.email ?? (profile?.full_name ?? null),
          first_at: r.created_at,
          last_at: r.created_at,
          message_count: 1,
          user_message_count: r.message_type === "user" ? 1 : 0,
          last_user_message: r.message_type === "user" ? r.message_content : "",
          categories: r.detected_category ? [r.detected_category] : [],
          intents: r.detected_intent ? [r.detected_intent] : [],
        });
      } else {
        existing.last_at = r.created_at;
        existing.message_count += 1;
        if (r.message_type === "user") {
          existing.user_message_count += 1;
          existing.last_user_message = r.message_content;
        }
        if (!existing.user_email && profile) {
          existing.user_email = profile.email ?? profile.full_name ?? null;
        }
        if (r.detected_category && !existing.categories.includes(r.detected_category)) {
          existing.categories.push(r.detected_category);
        }
        if (r.detected_intent && !existing.intents.includes(r.detected_intent)) {
          existing.intents.push(r.detected_intent);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.last_at.localeCompare(a.last_at));
  }, [rows, profileMap]);

  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) =>
      [
        s.session_id,
        s.user_email ?? "",
        s.last_user_message,
        s.categories.join(" "),
        s.intents.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [sessions, search]);

  const activeMessages = useMemo(() => {
    if (!activeSession || !rows) return [];
    return rows
      .filter((r) => r.session_id === activeSession)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [activeSession, rows]);

  const activeMeta = useMemo(
    () => sessions.find((s) => s.session_id === activeSession) ?? null,
    [sessions, activeSession]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight uppercase">Chat Transcripts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every IRA chatbot conversation is recorded for training &amp; quality. Showing the most
            recent {rows?.length ?? 0} messages across {sessions.length} sessions.
          </p>
        </div>
      </div>

      <Card className="rounded-none border-2 border-foreground">
        <CardHeader className="border-b-2 border-foreground bg-muted/30 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transcripts by message, email, category, intent…"
              className="pl-9 rounded-none border-2"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading transcripts…</div>
          ) : filteredSessions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No chat sessions found{search ? " for that search" : ""}.
            </div>
          ) : (
            <div className="divide-y-2 divide-foreground/10">
              {filteredSessions.map((s) => (
                <button
                  key={s.session_id}
                  onClick={() => setActiveSession(s.session_id)}
                  className="w-full text-left p-4 hover:bg-muted/30 transition-colors focus:outline-none focus:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="outline" className="rounded-none border-2 font-mono text-xs">
                          <Hash className="h-3 w-3 mr-1" />
                          {s.session_id.slice(0, 12)}
                        </Badge>
                        {s.user_email ? (
                          <Badge className="rounded-none border-2 border-foreground bg-foreground text-background">
                            <User className="h-3 w-3 mr-1" />
                            {s.user_email}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="rounded-none border-2">
                            Guest
                          </Badge>
                        )}
                        {s.categories.map((c) => (
                          <Badge key={c} variant="outline" className="rounded-none">
                            {c}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-sm font-medium line-clamp-2 mt-1">
                        {s.last_user_message || "(no user messages yet)"}
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground shrink-0">
                      <div className="flex items-center justify-end gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {s.message_count} msgs
                      </div>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(s.last_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!activeSession} onOpenChange={(o) => !o && setActiveSession(null)}>
        <DialogContent className="max-w-3xl rounded-none border-2 border-foreground flex flex-col max-h-[90vh] p-0">
          <DialogHeader className="p-6 border-b-2 border-foreground bg-muted/30">
            <DialogTitle className="uppercase tracking-wide">Chat Transcript</DialogTitle>
            <DialogDescription className="text-xs font-mono mt-2 space-y-1">
              <div>Session: {activeSession}</div>
              {activeMeta && (
                <div>
                  {activeMeta.user_email ?? "Guest"} • {activeMeta.message_count} messages •
                  Started {format(new Date(activeMeta.first_at), "PPp")}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-4">
              {activeMessages.map((m) => (
                <div key={m.id} className="flex gap-3">
                  <div
                    className={`h-8 w-8 shrink-0 flex items-center justify-center border-2 border-foreground ${
                      m.message_type === "user"
                        ? "bg-foreground text-background"
                        : "bg-background"
                    }`}
                  >
                    {m.message_type === "user" ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                      <span className="font-bold uppercase">
                        {m.message_type === "user" ? "Customer" : "IRA"}
                      </span>
                      <span>•</span>
                      <span>{format(new Date(m.created_at), "PPp")}</span>
                      {m.response_time_ms != null && (
                        <>
                          <span>•</span>
                          <span>{m.response_time_ms}ms</span>
                        </>
                      )}
                    </div>
                    <div className="text-sm whitespace-pre-wrap break-words border-2 border-foreground/20 p-3 bg-muted/20">
                      {m.message_content}
                    </div>
                  </div>
                </div>
              ))}
              {activeMessages.length === 0 && (
                <div className="text-center text-muted-foreground py-8">No messages.</div>
              )}
            </div>
          </ScrollArea>
          <div className="p-4 border-t-2 border-foreground bg-muted/30 flex justify-end">
            <Button
              variant="outline"
              className="rounded-none border-2 border-foreground"
              onClick={() => setActiveSession(null)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminChatTranscripts;