import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldX, Home, LayoutDashboard } from "lucide-react";
import { Link } from "react-router-dom";

// Inline component for access denied - brutalist OCCTA style
const AdminAccessDenied = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center border-4 border-foreground bg-muted">
          <ShieldX className="h-10 w-10 text-destructive" />
        </div>
        
        <div className="space-y-2">
          <h1 className="font-display text-3xl uppercase tracking-tight">
            Not Authorised
          </h1>
          <p className="text-muted-foreground">
            You don't have permission to access the admin console.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild variant="default">
            <Link to="/dashboard">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              Go to Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

type Role = "admin" | "super_admin" | "business_admin" | "ticket_admin" | "sales_admin" | "moderator";

interface Props {
  /** Any of these roles grants access. Defaults to ["admin","super_admin"]. */
  requiredRoles?: Role[];
}

export const ProtectedAdminRoute = ({ requiredRoles }: Props = {}) => {
  const location = useLocation();
  const roles = requiredRoles && requiredRoles.length > 0 ? requiredRoles : ["admin", "super_admin"];
  const { data, isLoading } = useQuery({
    queryKey: ["admin-access", roles.join(",")],
    queryFn: async () => {
      // Re-validate with the Auth server rather than trusting a cached session token.
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user) {
        return { status: "no-session" } as const;
      }
      // Check each accepted role; any match grants access.
      for (const r of roles) {
        const { data: ok } = await supabase.rpc("has_role", {
          _user_id: userData.user.id,
          _role: r as any,
        });
        if (ok) return { status: "admin" } as const;
      }
      return { status: "denied" } as const;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  // Redirect to auth with ?next= preserving the deep-linked admin path so
  // the user returns exactly where they tried to go after signing in.
  if (data?.status === "no-session") {
    const target = `${location.pathname}${location.search}${location.hash}` || "/admin/overview";
    const next = target.startsWith("/admin") ? target : "/admin/overview";
    return <Navigate to={`/auth?next=${encodeURIComponent(next)}`} replace />;
  }

  // Show access denied page instead of silent redirect
  if (data?.status === "denied") {
    return <AdminAccessDenied />;
  }

  return <Outlet />;
};
