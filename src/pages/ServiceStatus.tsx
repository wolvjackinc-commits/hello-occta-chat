import Layout from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, Clock, Mail, MessageSquare, Radio, Wrench } from "lucide-react";

const statusStyles: Record<string, string> = {
  operational: "bg-emerald-500/10 text-emerald-700 border-emerald-500",
  degraded: "bg-amber-500/10 text-amber-700 border-amber-500",
  outage: "bg-rose-500/10 text-rose-700 border-rose-500",
  maintenance: "bg-blue-500/10 text-blue-700 border-blue-500",
};

const ServiceStatus = () => {
  const overallStatus = {
    label: "All systems operational",
    status: "operational",
    updated: "Updated 8 minutes ago",
  };

  const services = [
    {
      name: "Broadband & Fibre",
      status: "operational",
      detail: "Backhaul and edge nodes are healthy.",
    },
    {
      name: "SIM & Mobile Data",
      status: "degraded",
      detail: "Elevated latency in a small number of UK regions.",
    },
    {
      name: "Landline Voice",
      status: "operational",
      detail: "Voice routing is stable across the region.",
    },
    {
      name: "Customer Portal",
      status: "operational",
      detail: "Account login and billing are running normally.",
    },
    {
      name: "Support Channels",
      status: "operational",
      detail: "Phone, chat, and email queues are clear.",
    },
  ];

  const incidents = [
    {
      title: "SIM data latency in limited areas",
      status: "Monitoring",
      time: "Today · 09:12",
      description: "We applied a routing adjustment and are monitoring recovery for lingering latency spikes.",
    },
  ];

  const maintenance = [
    {
      title: "Planned backbone upgrade",
      time: "Tomorrow · 02:00-04:00",
      description: "Short interruptions possible for fibre customers during a capacity upgrade.",
    },
    {
      title: "Self-serve portal polish",
      time: "Friday · 22:00-23:00",
      description: "Minor UI updates. No downtime expected.",
    },
  ];

  const statusLabel = (status: string) => {
    if (status === "operational") return "Operational";
    if (status === "degraded") return "Degraded";
    if (status === "outage") return "Outage";
    if (status === "maintenance") return "Maintenance";
    return status;
  };

  return (
    <Layout>
      <section className="bg-secondary/30 py-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Service status</p>
              <h1 className="text-4xl sm:text-5xl font-display uppercase mt-3">Network health & updates</h1>
              <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
                Real-time updates across broadband, mobile, landline, and support. Bookmark this page to stay in the loop.
              </p>
            </div>
            <Card className="w-full max-w-md border-4 border-foreground">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg font-display uppercase">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  {overallStatus.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge className={`border uppercase ${statusStyles[overallStatus.status]}`}>
                  {statusLabel(overallStatus.status)}
                </Badge>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {overallStatus.updated}
                </div>
                <Button variant="outline" className="w-full border-2 border-foreground">
                  <Radio className="mr-2 h-4 w-4" />
                  Subscribe to updates
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-6 lg:grid-cols-2">
            {services.map((service) => (
              <Card key={service.name} className="border-4 border-foreground">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-display uppercase">{service.name}</CardTitle>
                    <p className="mt-2 text-sm text-muted-foreground">{service.detail}</p>
                  </div>
                  <Badge className={`border uppercase ${statusStyles[service.status]}`}>
                    {statusLabel(service.status)}
                  </Badge>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-secondary/30 py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <h2 className="text-2xl font-display uppercase">Active incidents</h2>
              </div>
              <div className="mt-4 space-y-4">
                {incidents.map((incident) => (
                  <Card key={incident.title} className="border-4 border-foreground">
                    <CardHeader className="space-y-2">
                      <CardTitle className="text-lg font-display uppercase">{incident.title}</CardTitle>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <Badge className="border border-foreground bg-warning text-foreground uppercase">{incident.status}</Badge>
                        <span>{incident.time}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      {incident.description}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-blue-500" />
                <h2 className="text-2xl font-display uppercase">Planned maintenance</h2>
              </div>
              <div className="mt-4 space-y-4">
                {maintenance.map((item) => (
                  <Card key={item.title} className="border-4 border-foreground">
                    <CardHeader className="space-y-2">
                      <CardTitle className="text-lg font-display uppercase">{item.title}</CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge className={`border uppercase ${statusStyles.maintenance}`}>
                          Scheduled
                        </Badge>
                        <span>{item.time}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      {item.description}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-4">
          <Card className="border-4 border-foreground">
            <CardContent className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-display uppercase">Need help right now?</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Check your account, report an issue, or chat with the team for live assistance.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="hero">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Start live chat
                </Button>
                <Button variant="outline" className="border-2 border-foreground">
                  <Mail className="mr-2 h-4 w-4" />
                  Email status report
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </Layout>
  );
};

export default ServiceStatus;
