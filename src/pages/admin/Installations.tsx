import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InstallationSlotsManager } from "@/components/admin/InstallationSlotsManager";
import { TechnicianManager } from "@/components/admin/TechnicianManager";
import { InstallationScheduleView } from "@/components/admin/InstallationScheduleView";

export const AdminInstallations = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display">Installations</h1>
        <p className="text-muted-foreground">Manage slots, technicians, and bookings.</p>
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
