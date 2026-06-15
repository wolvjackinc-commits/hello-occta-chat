import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InstallationSlotsManager } from "@/components/admin/InstallationSlotsManager";
import { TechnicianManager } from "@/components/admin/TechnicianManager";
import { InstallationScheduleView } from "@/components/admin/InstallationScheduleView";
import { ShieldAlert } from "lucide-react";

export const AdminInstallations = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display uppercase">Installations</h1>
        <p className="text-sm text-muted-foreground max-w-2xl mt-1">
          Manage installation slots, technicians, and scheduled bookings. This page is for
          internal scheduling only — it does not call any supplier API, create services, or
          send customer notifications automatically.
        </p>
      </div>

      <div className="border-2 border-foreground bg-warning/10 px-4 py-3 flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 mt-0.5 shrink-0" />
        <div className="text-sm">
          <strong>Manual scheduling only.</strong> Booking a slot here records an internal
          appointment. It does not provision the service, charge the customer, or update
          supplier systems.
        </div>
      </div>

      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="slots">Slots</TabsTrigger>
          <TabsTrigger value="technicians">Technicians</TabsTrigger>
        </TabsList>
        <TabsContent value="schedule" className="mt-4">
          <InstallationScheduleView />
        </TabsContent>
        <TabsContent value="slots" className="mt-4">
          <InstallationSlotsManager />
        </TabsContent>
        <TabsContent value="technicians" className="mt-4">
          <TechnicianManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};
