import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const roles = ["admin", "user"] as const;

export const AdminSettings = () => {
  const { toast } = useToast();

  const { data, refetch } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("id, user_id, role")
        .order("created_at", { ascending: false });
      return { roles: rolesData ?? [] };
    },
  });

  const handleRoleChange = async (roleId: string, role: "admin" | "user") => {
    const { error } = await supabase.from("user_roles").update({ role }).eq("id", roleId);
    if (error) {
      toast({ title: "Failed to update role", variant: "destructive" });
      return;
    }
    toast({ title: "Role updated" });
    refetch();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display">Settings</h1>
        <p className="text-muted-foreground">Manage user roles and permissions.</p>
      </div>

      <Card className="border-2 border-foreground p-4">
        <h2 className="mb-3 font-display text-lg">Role management</h2>
        <div className="space-y-3">
          {data?.roles.map((role) => (
            <div key={role.id} className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-muted-foreground">User {role.user_id}</div>
              <Select 
                value={role.role} 
                onValueChange={(value: "admin" | "user") => handleRoleChange(role.id, value)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          {(!data?.roles || data.roles.length === 0) && (
            <p className="text-sm text-muted-foreground">No user roles found.</p>
          )}
        </div>
      </Card>
    </div>
  );
};