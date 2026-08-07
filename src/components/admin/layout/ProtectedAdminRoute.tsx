import { useEffect, useState } from "react";
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
  const rolesKey = roles.join(",");
  const [status, setStatus] = useState<"loading" | "no-session" | "denied" | "admin">("loading");

  useEffect(() => {
    let active = true;
    const acceptedRoles = rolesKey.split(",") as Role[];

    const validate = async () => {
      // Never share admin approval through a query cache: every mount and auth
      // change must be checked against the current server-validated identity.
      if (active) setStatus("loading");
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (!active) return;
      if (userErr || !userData.user) {
        setStatus("no-session");
        return;
      }

      for (const role of acceptedRoles) {
        const { data: allowed, error } = await supabase.rpc("has_role", {
          _user_id: userData.user.id,
          _role: role as any,
        });
        if (!active) return;
        if (!error && allowed) {
          setStatus("admin");
          return;
        }
      }
      setStatus("denied");
    };

    void validate();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void validate();
    });
    const revalidate = () => void validate();
    window.addEventListener("focus", revalidate);

    return () => {
      active = false;
      listener.subscription.unsubscribe();
      window.removeEventListener("focus", revalidate);
    };
  }, [rolesKey]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  // Redirect to auth with ?next= preserving the deep-linked admin path so
  // the user returns exactly where they tried to go after signing in.
  if (status === "no-session") {
    const target = `${location.pathname}${location.search}${location.hash}` || "/admin/overview";
    const next = target.startsWith("/admin") ? target : "/admin/overview";
    return <Navigate to={`/auth?next=${encodeURIComponent(next)}`} replace />;
  }

  // Show access denied page instead of silent redirect
  if (status === "denied") {
    return <AdminAccessDenied />;
  }

  return <Outlet />;
};
