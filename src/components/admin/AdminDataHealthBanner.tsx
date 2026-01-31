import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

export const AdminDataHealthBanner = () => {
  const expectedView = "admin_customer_search_view" as const;
  const { data, isLoading } = useQuery({
    queryKey: ["admin-data-health", expectedView],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id ?? null;

      let isAdmin: boolean | null = null;
      if (userId) {
        const { data: hasAdminRole } = await supabase.rpc("has_role", {
          _user_id: userId,
          _role: "admin",
        });
        isAdmin = !!hasAdminRole;
      }

      const [profilesCountRes, viewCountRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from(expectedView).select("id", { count: "exact", head: true }),
      ]);

      return {
        userId,
        isAdmin,
        profiles: {
          count: profilesCountRes.count ?? null,
          error: profilesCountRes.error?.message ?? null,
        },
        view: {
          count: viewCountRes.count ?? null,
          error: viewCountRes.error?.message ?? null,
        },
      };
    },
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <Card className="border-2 border-foreground p-3">
        <p className="text-xs text-muted-foreground">Checking admin data access…</p>
      </Card>
    );
  }

  if (!data) return null;

  const hasProblem =
    !data.userId ||
    data.isAdmin !== true ||
    !!data.profiles.error ||
    !!data.view.error ||
    (data.profiles.count ?? 0) > 0 && (data.view.count ?? 0) === 0;

  if (!hasProblem) return null;

  return (
    <Card className="border-2 border-destructive bg-destructive/10 p-3">
      <div className="space-y-1 text-xs">
        <p className="font-medium text-destructive">Admin data access diagnostics</p>
        <p className="text-destructive/90">
          userId: <span className="font-mono">{data.userId ?? "(none)"}</span> · admin: {String(data.isAdmin)}
        </p>
        <p className="text-destructive/90">
          profiles count: {data.profiles.count ?? "?"}
          {data.profiles.error ? ` · error: ${data.profiles.error}` : ""}
        </p>
        <p className="text-destructive/90">
          {expectedView} count: {data.view.count ?? "?"}
          {data.view.error ? ` · error: ${data.view.error}` : ""}
        </p>
        {(data.profiles.count ?? 0) > 0 && (data.view.count ?? 0) === 0 && !data.view.error && (
          <p className="text-destructive/90">
            This usually means Row Level Security is blocking view rows for your session.
          </p>
        )}
      </div>
    </Card>
  );
};
