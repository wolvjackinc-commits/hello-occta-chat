import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Paperclip, Send, Users, BookOpen, Search, ShieldAlert, ShieldCheck, ShieldQuestion, Download, FileDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Conversation = {
  id: string;
  session_id: string;
  user_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  status: string;
  summary: string | null;
  handoff_reason: string | null;
  last_message_at: string;
  created_at: string;
};

type ChatRow = {
  id: string;
  conversation_id: string;
  role: "customer" | "bot" | "admin" | "system";
  content: string | null;
  attachments: unknown;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  awaiting_human: "bg-yellow-100 text-yellow-900 border-yellow-500",
  live: "bg-emerald-100 text-emerald-900 border-emerald-600",
  bot: "bg-muted text-foreground border-border",
  resolved: "bg-slate-100 text-slate-700 border-slate-400",
  closed: "bg-slate-100 text-slate-500 border-slate-300",
};

export default function AdminLiveChat() {
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatRow[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "requested">("open");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideQuery, setGuideQuery] = useState("");
  const [guides, setGuides] = useState<{ id: string; title: string; slug: string; summary: string | null }[]>([]);
  const [guidesLoading, setGuidesLoading] = useState(false);

  // Preselect from URL param.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get("c");
    if (c) setActiveId(c);
  }, []);

  // Deep-link: ?m=<message_id> — scroll to and highlight that message once loaded.
  const [highlightId, setHighlightId] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get("m");
    if (m) setHighlightId(m);
  }, []);
  useEffect(() => {
    if (!highlightId || messages.length === 0) return;
    // Wait a tick for DOM to paint.
    const t = setTimeout(() => {
      const el = document.getElementById(`msg-${highlightId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-4", "ring-yellow-400");
        setTimeout(() => el.classList.remove("ring-4", "ring-yellow-400"), 3000);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [highlightId, messages.length]);

  // Scan-status lookup for attachments.
  const [scanMap, setScanMap] = useState<Record<string, { status: string; reasons: string[] | null }>>({});
  useEffect(() => {
    const paths = messages
      .flatMap((m) => (Array.isArray(m.attachments) ? (m.attachments as any[]) : []))
      .map((a: any) => a?.path)
      .filter(Boolean);
    if (paths.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from("chat_attachment_scans" as any)
        .select("path, status, reasons")
        .in("path", paths);
      const map: Record<string, { status: string; reasons: string[] | null }> = {};
      (data ?? []).forEach((r: any) => { map[r.path] = { status: r.status, reasons: r.reasons }; });
      setScanMap(map);
    })();
  }, [messages]);

  const safeDownload = async (path: string, name: string, force = false) => {
    const { data, error } = await supabase.functions.invoke("chat-attachment-download", {
      body: { path, force },
    });
    if (error) {
      const details = (error as any)?.context?.text ? await (error as any).context.text() : error.message;
      toast({ title: "Download blocked", description: details, variant: "destructive" });
      return;
    }
    const url = (data as any)?.url;
    if (!url) { toast({ title: "Download failed", variant: "destructive" }); return; }
    const a = document.createElement("a");
    a.href = url; a.download = name; a.rel = "noopener"; a.click();
  };

  const loadConversations = async () => {
    let q = supabase
      .from("chat_conversations")
      .select("id, session_id, user_id, customer_name, customer_email, status, summary, handoff_reason, last_message_at, created_at")
      .order("last_message_at", { ascending: false })
      .limit(200);
    if (filter === "open") q = q.in("status", ["awaiting_human", "live"]);
    if (filter === "requested") q = q.eq("status", "awaiting_human");
    const { data, error } = await q;
    if (error) {
      toast({ title: "Failed to load conversations", description: error.message, variant: "destructive" });
      return;
    }
    setConversations((data ?? []) as Conversation[]);
  };

  useEffect(() => { loadConversations(); }, [filter]);

  // Realtime: update conversation list on new/updated rows.
  useEffect(() => {
    const ch = supabase
      .channel("admin-live-chat-convs")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations" }, () => loadConversations())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [filter]);

  // Load and subscribe to the active conversation's messages.
  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("id, conversation_id, role, content, attachments, created_at")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true });
      if (!cancelled) setMessages((data ?? []) as ChatRow[]);
    })();
    const ch = supabase
      .channel(`admin-live-chat-msgs-${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as ChatRow]);
        },
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [activeId]);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const sendReply = async (attachmentPath?: string, attachmentName?: string) => {
    if (!activeId) return;
    const content = reply.trim();
    if (!content && !attachmentPath) return;
    setSending(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const adminId = userRes.user?.id ?? null;
      const attachments = attachmentPath
        ? [{ path: attachmentPath, name: attachmentName ?? attachmentPath.split("/").pop() }]
        : [];
      const { error } = await supabase.from("chat_messages").insert({
        conversation_id: activeId,
        role: "admin",
        content: content || `📎 ${attachmentName || "Attachment"}`,
        sender_admin_id: adminId,
        attachments,
      });
      if (error) throw error;
      // Move conversation to active on first reply.
      await supabase
        .from("chat_conversations")
        .update({ status: "live", assigned_admin_id: adminId, last_message_at: new Date().toISOString() })
        .eq("id", activeId);
      setReply("");
    } catch (err: any) {
      toast({ title: "Reply failed", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!activeId) return;
    const { data: userRes } = await supabase.auth.getUser();
    const adminId = userRes.user?.id;
    if (!adminId) return;
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `user/${adminId}/${activeId}/${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from("chat-attachments").upload(path, file, { upsert: false });
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      return;
    }
    await sendReply(path, file.name);
  };

  const resolveConversation = async () => {
    if (!activeId) return;
    await supabase.from("chat_conversations").update({ status: "resolved" }).eq("id", activeId);
    toast({ title: "Conversation resolved" });
  };

  const [exporting, setExporting] = useState(false);
  const exportTranscript = async () => {
    if (!active) return;
    setExporting(true);
    try {
      // Fetch full message history (bypass in-memory state to be safe).
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("id, conversation_id, role, content, attachments, created_at, sender_admin_id")
        .eq("conversation_id", active.id)
        .order("created_at", { ascending: true });

      // Attachments metadata: enrich with scan status + signed URLs (7-day).
      const attachmentsMeta: any[] = [];
      for (const m of msgs ?? []) {
        const list = Array.isArray(m.attachments) ? (m.attachments as any[]) : [];
        for (const a of list) {
          if (!a?.path) continue;
          const { data: sc } = await supabase
            .from("chat_attachment_scans" as any)
            .select("status, reasons, scanned_at, size, content_type")
            .eq("path", a.path)
            .maybeSingle();
          const { data: signed } = await supabase.storage
            .from("chat-attachments")
            .createSignedUrl(a.path, 60 * 60 * 24 * 7);
          attachmentsMeta.push({
            message_id: m.id,
            name: a.name,
            path: a.path,
            signed_url: signed?.signedUrl ?? null,
            scan: sc ?? null,
          });
        }
      }

      // Linked invoice / order records for the customer.
      let linkedOrders: any[] = [];
      let linkedInvoices: any[] = [];
      if (active.user_id) {
        const [{ data: orders }, { data: invoices }] = await Promise.all([
          supabase.from("orders").select("id, order_number, status, created_at, total_amount").eq("user_id", active.user_id).order("created_at", { ascending: false }).limit(50),
          supabase.from("invoices").select("id, invoice_number, status, issue_date, due_date, total").eq("user_id", active.user_id).order("issue_date", { ascending: false }).limit(50),
        ]);
        linkedOrders = orders ?? [];
        linkedInvoices = invoices ?? [];
      }

      const bundle = {
        exported_at: new Date().toISOString(),
        conversation: active,
        messages: msgs ?? [],
        attachments: attachmentsMeta,
        linked_records: { orders: linkedOrders, invoices: linkedInvoices },
      };

      // JSON download
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.href = url;
      a.download = `chat-${active.session_id.slice(0, 8)}-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);

      // Log for audit trail (best-effort).
      const { data: userRes } = await supabase.auth.getUser();
      await supabase.from("audit_logs").insert({
        action: "chat_transcript_export",
        entity: "chat_conversation",
        metadata: { conversation_id: active.id, message_count: msgs?.length ?? 0, by: userRes.user?.id },
      });

      toast({ title: "Transcript exported", description: `${msgs?.length ?? 0} messages · ${attachmentsMeta.length} attachments` });
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const openGuidePicker = async () => {
    setGuideOpen(true);
    if (guides.length > 0) return;
    setGuidesLoading(true);
    const { data } = await supabase
      .from("kb_articles")
      .select("id, title, slug, summary")
      .eq("status", "approved")
      .order("updated_at", { ascending: false })
      .limit(200);
    setGuides((data ?? []) as any);
    setGuidesLoading(false);
  };

  const sendGuide = async (g: { title: string; slug: string; summary: string | null }) => {
    if (!activeId) return;
    const origin = window.location.origin;
    const url = `${origin}/help/${g.slug}`;
    const content = `📘 Here's a guide that should help:\n\n**${g.title}**\n${g.summary || ""}\n\n${url}`;
    const { data: userRes } = await supabase.auth.getUser();
    const adminId = userRes.user?.id ?? null;
    const { error } = await supabase.from("chat_messages").insert({
      conversation_id: activeId,
      role: "admin",
      content,
      sender_admin_id: adminId,
      attachments: [{ kind: "guide", title: g.title, slug: g.slug, url }],
    });
    if (error) {
      toast({ title: "Send guide failed", description: error.message, variant: "destructive" });
      return;
    }
    await supabase
      .from("chat_conversations")
      .update({ status: "live", assigned_admin_id: adminId, last_message_at: new Date().toISOString() })
      .eq("id", activeId);
    setGuideOpen(false);
    toast({ title: "Guide sent", description: g.title });
  };

  const filteredGuides = guides.filter((g) => {
    if (!guideQuery.trim()) return true;
    const q = guideQuery.toLowerCase();
    return g.title.toLowerCase().includes(q) || (g.summary ?? "").toLowerCase().includes(q) || g.slug.toLowerCase().includes(q);
  });

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight uppercase">Live Chat</h1>
          <p className="text-sm text-muted-foreground">Reply to customer conversations in real time.</p>
        </div>
        <div className="flex gap-2">
          {(["open", "requested", "all"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
              className="uppercase"
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-200px)]">
        {/* Conversation list */}
        <div className="border-2 border-foreground bg-background overflow-hidden flex flex-col">
          <div className="p-3 border-b-2 border-foreground bg-muted/40 flex items-center gap-2 text-xs uppercase font-black tracking-wider">
            <Users className="w-4 h-4" />
            {conversations.length} conversation{conversations.length === 1 ? "" : "s"}
          </div>
          <ScrollArea className="flex-1">
            {conversations.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No conversations to show.</div>
            ) : (
              conversations.map((c) => {
                const isActive = c.id === activeId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`w-full text-left p-3 border-b border-border hover:bg-muted transition-colors ${isActive ? "bg-muted" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm truncate">
                        {c.customer_name || c.customer_email || `Guest ${c.session_id.slice(0, 6)}`}
                      </span>
                      <Badge className={`text-[10px] border-2 ${STATUS_STYLES[c.status] || "bg-muted"} shrink-0`}>
                        {c.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {c.summary || c.handoff_reason || "—"}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {new Date(c.last_message_at).toLocaleString("en-GB")}
                    </div>
                  </button>
                );
              })
            )}
          </ScrollArea>
        </div>

        {/* Transcript + composer */}
        <div className="border-2 border-foreground bg-background flex flex-col overflow-hidden">
          {!active ? (
            <div className="flex-1 grid place-items-center p-8 text-center text-muted-foreground">
              Select a conversation to view the transcript and reply.
            </div>
          ) : (
            <>
              <div className="p-4 border-b-2 border-foreground flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-black uppercase tracking-tight">
                    {active.customer_name || active.customer_email || `Guest ${active.session_id.slice(0, 6)}`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {active.customer_email || "No email"} · Session {active.session_id.slice(0, 8)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`border-2 ${STATUS_STYLES[active.status] || "bg-muted"}`}>
                    {active.status.replace("_", " ")}
                  </Badge>
                  <Button size="sm" variant="outline" onClick={openGuidePicker}>
                    <BookOpen className="w-4 h-4 mr-1" /> Send guide
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportTranscript} disabled={exporting}>
                    {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileDown className="w-4 h-4 mr-1" />}
                    Export transcript
                  </Button>
                  <Button size="sm" variant="outline" onClick={resolveConversation}>Resolve</Button>
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      id={`msg-${m.id}`}
                      className={`max-w-[80%] p-3 border-2 ${
                        m.role === "admin"
                          ? "ml-auto bg-foreground text-background border-foreground"
                          : m.role === "system"
                            ? "mx-auto text-xs italic bg-muted border-border"
                            : m.role === "bot"
                              ? "bg-muted border-border"
                              : "bg-background border-foreground"
                      }`}
                    >
                      <div className="text-[10px] uppercase tracking-widest opacity-70 mb-1">
                        {m.role} · {new Date(m.created_at).toLocaleTimeString("en-GB")}
                      </div>
                      <div className="whitespace-pre-wrap text-sm">{m.content}</div>
                      {Array.isArray(m.attachments) && (m.attachments as any[]).length > 0 && (
                        <div className="mt-2 space-y-1">
                          {(m.attachments as any[]).map((a: any, i: number) => {
                            if (!a?.path) return null;
                            const scan = scanMap[a.path];
                            const st = scan?.status ?? "pending";
                            const Icon = st === "clean" ? ShieldCheck : st === "quarantined" ? ShieldAlert : ShieldQuestion;
                            const tone =
                              st === "clean" ? "text-emerald-600 border-emerald-500" :
                              st === "quarantined" ? "text-red-600 border-red-500" :
                              "text-amber-600 border-amber-500";
                            return (
                              <div key={i} className={`flex items-center gap-2 border-2 ${tone} p-2 bg-background text-foreground text-xs`}>
                                <Icon className="w-4 h-4 shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-bold truncate">{a.name || a.path.split("/").pop()}</div>
                                  <div className="opacity-70 uppercase tracking-widest text-[10px]">
                                    {st}{scan?.reasons?.length ? ` · ${scan.reasons.join(", ")}` : ""}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={st === "pending"}
                                  onClick={() => safeDownload(a.path, a.name || "attachment", st === "quarantined")}
                                  title={st === "quarantined" ? "Force download quarantined file" : "Download"}
                                >
                                  <Download className="w-3 h-3 mr-1" />
                                  {st === "quarantined" ? "Force" : "Download"}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                  {messages.length === 0 && (
                    <div className="text-sm text-muted-foreground">No messages yet.</div>
                  )}
                </div>
              </ScrollArea>

              <div className="p-3 border-t-2 border-foreground bg-muted/30 space-y-2">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type your reply… (Enter to send, Shift+Enter for a new line)"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                />
                <div className="flex items-center justify-between gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(f);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending}
                  >
                    <Paperclip className="w-4 h-4 mr-1" /> Attach
                  </Button>
                  <Button onClick={() => sendReply()} disabled={sending || !reply.trim()}>
                    {sending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                    Send reply
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight">Send a help guide</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input value={guideQuery} onChange={(e) => setGuideQuery(e.target.value)} placeholder="Search guides…" className="pl-8" />
          </div>
          <ScrollArea className="flex-1 mt-2 pr-2">
            {guidesLoading ? (
              <div className="p-6"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : filteredGuides.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No guides match.</div>
            ) : filteredGuides.map((g) => (
              <button
                key={g.id}
                onClick={() => sendGuide(g)}
                className="w-full text-left p-3 border-b border-border hover:bg-muted"
              >
                <div className="font-bold text-sm">{g.title}</div>
                {g.summary && <div className="text-xs text-muted-foreground line-clamp-2">{g.summary}</div>}
                <div className="text-[10px] text-muted-foreground mt-1">/help/{g.slug}</div>
              </button>
            ))}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}