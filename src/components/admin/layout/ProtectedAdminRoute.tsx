import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export const ProtectedAdminRoute = () => {
  const { toast } = useToast();
  const location = useLocation();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-access"],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        return { status: "no-session" } as const;
      }
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", sessionData.session.user.id);
      const roles = rolesData?.map((role) => role.role) ?? [];
      const allowed = roles.some((role) =>
        ["admin", "billing", "support", "provisioning", "read_only"].includes(role)
      );
      return { status: allowed ? "admin" : "denied" } as const;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (data?.status === "denied") {
      toast({
        title: "Access denied",
        description: "You don't have permission to access the admin console.",
        variant: "destructive",
      });
    }
  }, [data?.status, toast]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (data?.status === "no-session") {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (data?.status === "denied") {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};
