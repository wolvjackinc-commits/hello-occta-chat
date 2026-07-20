import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export const NotificationBell = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("notifications" as any)
        .select("id,type,title,body,link,read_at,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (mounted) setItems(((data ?? []) as unknown) as Notification[]);
    };
    load();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const unread = items.filter((n) => !n.read_at).length;

  const markAllRead = async () => {
    if (!userId || unread === 0) return;
    await supabase
      .from("notifications" as any)
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
  };

  const markOne = async (id: string) => {
    await supabase.from("notifications" as any).update({ read_at: new Date().toISOString() }).eq("id", id);
  };

  if (!userId) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 justify-center bg-destructive text-destructive-foreground border-2 border-background rounded-none">
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0 border-4 border-foreground rounded-none">
        <div className="flex items-center justify-between p-3 border-b-4 border-foreground bg-secondary">
          <span className="font-display uppercase text-sm">Notifications</span>
          {unread > 0 && (
            <button className="text-xs underline" onClick={markAllRead}>
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">You're all caught up.</div>
          ) : (
            <ul className="divide-y-2 divide-foreground/10">
              {items.map((n) => {
                const inner = (
                  <div className={`p-3 ${!n.read_at ? "bg-primary/5" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-display text-sm">{n.title}</span>
                      {!n.read_at && <span className="w-2 h-2 bg-destructive mt-1.5 shrink-0" />}
                    </div>
                    {n.body && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>}
                    <span className="text-[10px] text-muted-foreground uppercase">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </span>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link
                        to={n.link}
                        onClick={() => {
                          markOne(n.id);
                          setOpen(false);
                        }}
                        className="block hover:bg-muted/50"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <button
                        onClick={() => markOne(n.id)}
                        className="block w-full text-left hover:bg-muted/50"
                      >
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;