import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet } from "react-router-dom";
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

export const ProtectedAdminRoute = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-access"],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        return { status: "no-session" } as const;
      }
      const { data: hasAdminRole } = await supabase.rpc("has_role", {
        _user_id: sessionData.session.user.id,
        _role: "admin",
      });
      return { status: hasAdminRole ? "admin" : "denied" } as const;
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  // Redirect to auth with ?next= for returning after login
  if (data?.status === "no-session") {
    return <Navigate to="/auth?next=/admin/overview" replace />;
  }

  // Show access denied page instead of silent redirect
  if (data?.status === "denied") {
    return <AdminAccessDenied />;
  }

  return <Outlet />;
};
