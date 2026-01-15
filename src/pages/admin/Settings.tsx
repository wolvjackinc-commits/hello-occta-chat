import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const roles = ["admin", "user", "billing", "support", "provisioning", "read_only"] as const;

export const AdminSettings = () => {
  const { toast } = useToast();
  const [configKey, setConfigKey] = useState("");
  const [configValue, setConfigValue] = useState("");

  const { data, refetch } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const [rolesData, configData] = await Promise.all([
        supabase.from("user_roles").select("id, user_id, role").order("created_at", { ascending: false }),
        supabase.from("app_config").select("*").order("created_at", { ascending: false }),
      ]);
      return { roles: rolesData.data ?? [], config: configData.data ?? [] };
    },
  });

  const handleRoleChange = async (roleId: string, role: string) => {
    const { error } = await supabase.from("user_roles").update({ role }).eq("id", roleId);
    if (error) {
      toast({ title: "Failed to update role", variant: "destructive" });
      return;
    }
    toast({ title: "Role updated" });
    refetch();
  };

  const handleAddConfig = async () => {
    const { error } = await supabase.from("app_config").insert({
      key: configKey,
      value: { value: configValue },
    });
    if (error) {
      toast({ title: "Failed to add config", variant: "destructive" });
      return;
    }
    toast({ title: "Config saved" });
    setConfigKey("");
    setConfigValue("");
    refetch();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display">Settings</h1>
        <p className="text-muted-foreground">Manage roles and feature flags.</p>
      </div>

      <Card className="border-2 border-foreground p-4">
        <h2 className="mb-3 font-display text-lg">Role management</h2>
        <div className="space-y-3">
          {data?.roles.map((role) => (
            <div key={role.id} className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-muted-foreground">User {role.user_id}</div>
              <Select value={role.role} onValueChange={(value) => handleRoleChange(role.id, value)}>
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
        </div>
      </Card>

      <Card className="border-2 border-foreground p-4">
        <h2 className="mb-3 font-display text-lg">Feature flags & config</h2>
        <div className="space-y-3">
          <Input placeholder="Config key" value={configKey} onChange={(event) => setConfigKey(event.target.value)} />
          <Input
            placeholder="Config value"
            value={configValue}
            onChange={(event) => setConfigValue(event.target.value)}
          />
          <Button onClick={handleAddConfig}>Save config</Button>
        </div>
        <div className="mt-4 space-y-3">
          {data?.config.map((config) => (
            <div key={config.id} className="rounded-md border border-border p-3">
              <div className="text-sm font-medium">{config.key}</div>
              <div className="text-xs text-muted-foreground">{JSON.stringify(config.value)}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
