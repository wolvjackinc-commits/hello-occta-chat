import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type Subscription = {
  table: string;
  filter?: string;
  event?: "*" | "INSERT" | "UPDATE" | "DELETE";
};

/**
 * Subscribe to postgres_changes on one or more tables and invoke `onChange`
 * (debounced) whenever a matching event arrives. Cleans up on unmount.
 *
 * Use inside a mounted component after the current user id is known so the
 * `filter` (e.g. `user_id=eq.<uuid>`) is set and RLS scoping is respected.
 */
export function useRealtimeSync(
  channelName: string,
  subscriptions: Subscription[],
  onChange: () => void,
  enabled: boolean = true,
) {
  useEffect(() => {
    if (!enabled) return;
    if (!subscriptions.length) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => onChange(), 250);
    };

    let channel = supabase.channel(channelName);
    subscriptions.forEach((sub) => {
      channel = channel.on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        {
          event: sub.event ?? "*",
          schema: "public",
          table: sub.table,
          ...(sub.filter ? { filter: sub.filter } : {}),
        },
        trigger,
      );
    });

    channel.subscribe();

    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, enabled, JSON.stringify(subscriptions)]);
}

/**
 * Refetch when the browser comes back online. Pairs with cached snapshots so
 * the UI stays responsive during connectivity blips.
 */
export function useReconnectSync(onReconnect: () => void, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = () => onReconnect();
    window.addEventListener("online", handler);
    return () => window.removeEventListener("online", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}