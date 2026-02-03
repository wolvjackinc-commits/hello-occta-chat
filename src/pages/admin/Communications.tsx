import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Send } from "lucide-react";
import { TemplatesTab } from "@/components/admin/communications/TemplatesTab";
import { CampaignsTab } from "@/components/admin/communications/CampaignsTab";

export const AdminCommunications = () => {
  const [activeTab, setActiveTab] = useState("templates");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Communications</h1>
          <p className="text-muted-foreground">
            Manage email templates and send campaigns to customers
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="border-2 border-foreground">
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-2">
            <Send className="h-4 w-4" />
            Campaigns
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <TemplatesTab />
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <CampaignsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminCommunications;
