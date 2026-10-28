import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MotionConfig, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock,
  LayoutDashboard,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Wrench,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { companyConfig } from "@/lib/companyConfig";
import { BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage, Reveal, SectionEyebrow } from "@/components/brand/kit";
import { revealItem } from "@/components/brand/motion";
import {
  type Incident,
  type ServiceState,
  SERVICE_KEYS,
  SERVICE_LABELS,
  STATE_LABELS,
  STATUS_LABELS,
  isActiveIncident,
  isActiveMaintenance,
  isClosed,
  isUpcomingMaintenance,
  loadPublicStatus,
  overallState,
  serviceStates,
} from "@/lib/serviceStatus";

const openChat = () => window.dispatchEvent(new CustomEvent("open-ai-chat"));

const stateStyle: Record<ServiceState, { icon: LucideIcon; dot: string; text: string; banner: string }> = {
  operational: { icon: CheckCircle2, dot: "bg-[hsl(142_70%_40%)]", text: "text-[hsl(142_70%_32%)]", banner: "bg-[hsl(142_70%_40%)] text-white" },
  maintenance: { icon: Wrench, dot: "bg-[hsl(210_80%_50%)]", text: "text-[hsl(210_80%_42%)]", banner: "bg-[hsl(210_80%_45%)] text-white" },
  degraded: { icon: CircleAlert, dot: "bg-primary", text: "text-foreground", banner: "bg-primary text-black" },
  partial_outage: { icon: AlertTriangle, dot: "bg-[hsl(25_95%_53%)]", text: "text-[hsl(25_95%_40%)]", banner: "bg-[hsl(25_95%_50%)] text-black" },
  major_outage: { icon: XCircle, dot: "bg-destructive", text: "text-destructive", banner: "bg-destructive text-white" },
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

function IncidentCard({ i }: { i: Incident }) {
  const closed = isClosed(i);
  return (
    <article className="border-[3px] border-foreground bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b-[3px] border-foreground px-5 py-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {i.kind === "maintenance" ? "Planned maintenance" : "Incident"} · {STATUS_LABELS[i.status]}
          </p>
          <h3 className="mt-1 font-display text-2xl uppercase leading-tight">{i.title}</h3>
        </div>
        <span className={`shrink-0 border-2 border-foreground px-2.5 py-1 text-xs font-bold uppercase ${closed ? "bg-secondary" : "bg-primary text-black"}`}>
          {STATUS_LABELS[i.status]}
        </span>
      </header>
      <div className="space-y-3 px-5 py-4 text-sm">
        {i.summary && <p className="leading-relaxed text-foreground/80">{i.summary}</p>}
        <dl className="grid gap-x-6 gap-y-1 text-foreground/70 sm:grid-cols-2">
          <div><dt className="inline font-semibold text-foreground">Affects: </dt><dd className="inline">{i.affected_services.map((s) => SERVICE_LABELS[s].label).join(", ") || "—"}</dd></div>
          {i.affected_areas && <div><dt className="inline font-semibold text-foreground">Area: </dt><dd className="inline">{i.affected_areas}</dd></div>}
          <div><dt className="inline font-semibold text-foreground">{i.kind === "maintenance" ? "Window: " : "Started: "}</dt><dd className="inline">{fmt(i.starts_at)}{i.ends_at ? ` – ${fmt(i.ends_at)}` : ""}</dd></div>
          {i.resolved_at && <div><dt className="inline font-semibold text-foreground">Resolved: </dt><dd className="inline">{fmt(i.resolved_at)}</dd></div>}
        </dl>
        {i.updates && i.updates.length > 0 && (
          <ol className="mt-2 space-y-3 border-l-[3px] border-foreground/20 pl-4">
            {i.updates.map((u) => (
              <li key={u.id}>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{STATUS_LABELS[u.status]} · {fmt(u.created_at)}</p>
                <p className="mt-0.5 leading-relaxed text-foreground/80">{u.message}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </article>
  );
}

const ServiceStatus = () => {
  const [load, setLoad] = useState<{ state: "loading" } | { state: "ok"; incidents: Incident[]; at: Date } | { state: "error" }>({ state: "loading" });

  const refresh = async () => {
    setLoad({ state: "loading" });
    const res = await loadPublicStatus(30);
    setLoad(res.ok ? { state: "ok", incidents: res.incidents, at: new Date() } : { state: "error" });
  };

  useEffect(() => {
    refresh();
    const t = window.setInterval(refresh, 120_000);
    return () => window.clearInterval(t);
  }, []);

  const view = useMemo(() => {
    if (load.state !== "ok") return null;
    const now = new Date();
    const states = serviceStates(load.incidents, now);
    return {
      states,
      overall: overallState(states),
      active: load.incidents.filter((i) => isActiveIncident(i) || isActiveMaintenance(i, now)),
      upcoming: load.incidents.filter((i) => isUpcomingMaintenance(i, now)).sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
      history: load.incidents.filter((i) => isClosed(i)),
    };
  }, [load]);

  const routes = [
    { icon: LayoutDashboard, title: "Check your account", body: "See the services on your account, open tickets and their progress.", action: <Link to="/dashboard"><Button variant="hero" size="sm">Go to your account <ArrowRight className="ml-1 h-4 w-4" /></Button></Link> },
    { icon: MessageSquare, title: "Ask Ollie", body: "Router checks step by step, and a ticket raised with your conversation attached.", action: <Button variant="outline" size="sm" onClick={openChat}>Start chat</Button> },
    {
      icon: Phone,
      title: "Report a fault",
      body: `${companyConfig.phone.display} (${companyConfig.supportHours.phone}) or ${companyConfig.email.support}.`,
      action: (
        <div className="flex flex-wrap gap-2">
          <a href={companyConfig.phone.href}><Button variant="outline" size="sm"><Phone className="mr-1 h-4 w-4" /> Call</Button></a>
          <a href={`mailto:${companyConfig.email.support}`}><Button variant="outline" size="sm"><Mail className="mr-1 h-4 w-4" /> Email</Button></a>
          <Link to="/help/report-a-fault"><Button variant="outline" size="sm">How to report</Button></Link>
        </div>
      ),
    },
  ];

  const overall = view?.overall ?? null;
  const banner = overall ? stateStyle[overall] : null;

  return (
    <Layout>
      <SEO
        title="OCCTA service status"
        description="Current status of OCCTA broadband, Digital Voice, mobile, online account, billing and support, with active incidents, planned maintenance and the last 30 days of history."
        canonical="/status"
        noIndex
      />
      <MotionConfig reducedMotion="user">
        <PosterStage>
          <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "Service status" }]} />
          <div className="max-w-4xl">
            <HeroKicker>Service status</HeroKicker>
            <HeroTitle size="md">
              OCCTA
              {" "}<span className="text-primary">service status</span>
            </HeroTitle>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70">
              Network incidents and planned maintenance published by the OCCTA operations team. If your service isn't working and nothing is listed here, it's likely specific to your line — report it and we'll check.
            </p>
          </div>

          <div className="mt-10 max-w-4xl" aria-live="polite">
            {load.state === "loading" && (
              <div className="flex items-center gap-3 border-[3px] border-white/30 px-5 py-4 text-white/75">
                <Loader2 className="h-5 w-5 animate-spin" /> Checking service status…
              </div>
            )}
            {load.state === "error" && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-[3px] border-white/30 px-5 py-4 text-white">
                <span className="flex items-center gap-3"><CircleAlert className="h-5 w-5 text-primary" /> Live status is temporarily unavailable. If something isn't working, contact us below.</span>
                <Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="mr-1 h-4 w-4" /> Try again</Button>
              </div>
            )}
            {view && banner && overall && (
              <div className={`flex flex-wrap items-center justify-between gap-3 border-[3px] border-white px-5 py-4 ${banner.banner}`}>
                <span className="flex items-center gap-3 font-display text-2xl uppercase leading-none sm:text-3xl">
                  <banner.icon className="h-7 w-7" aria-hidden />
                  {overall === "operational" ? "All services operating normally" : view.active.length === 1 ? view.active[0].title : `${view.active.length} active issues`}
                </span>
                {load.state === "ok" && <span className="text-xs font-semibold opacity-80">Updated {load.at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>}
              </div>
            )}
          </div>
        </PosterStage>

        {view && (
          <>
            <BrandSection tone="paper">
              <Reveal>
                <SectionEyebrow index="01" label="Right now" />
                <h2 className="mt-5 font-display text-[2.5rem] uppercase leading-[0.9] sm:text-5xl">Services</h2>
              </Reveal>
              <Reveal stagger as="ul" className="mt-8 grid gap-[3px] border-[3px] border-foreground bg-foreground sm:grid-cols-2 lg:grid-cols-3">
                {SERVICE_KEYS.map((k) => {
                  const st = view.states[k];
                  const s = stateStyle[st];
                  return (
                    <motion.li key={k} variants={revealItem} className="flex items-start justify-between gap-4 bg-card p-5">
                      <div>
                        <p className="font-display text-xl uppercase leading-tight">{SERVICE_LABELS[k].label}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{SERVICE_LABELS[k].desc}</p>
                      </div>
                      <span className={`flex shrink-0 items-center gap-2 text-sm font-semibold ${s.text}`}>
                        <span className={`h-3 w-3 ${s.dot}`} aria-hidden />
                        {STATE_LABELS[st]}
                      </span>
                    </motion.li>
                  );
                })}
              </Reveal>

              {view.active.length > 0 && (
                <div className="mt-12">
                  <h3 className="flex items-center gap-2 font-display text-3xl uppercase leading-none"><AlertTriangle className="h-6 w-6" aria-hidden /> Active</h3>
                  <div className="mt-5 grid gap-5">{view.active.map((i) => <IncidentCard key={i.id} i={i} />)}</div>
                </div>
              )}
            </BrandSection>

            <BrandSection tone="light">
              <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
                <div>
                  <Reveal>
                    <SectionEyebrow index="02" label="Planned work" />
                    <h2 className="mt-5 flex items-center gap-3 font-display text-4xl uppercase leading-none"><CalendarClock className="h-8 w-8" aria-hidden /> Maintenance</h2>
                  </Reveal>
                  <div className="mt-6 grid gap-5">
                    {view.upcoming.length === 0 ? (
                      <p className="border-[3px] border-dashed border-foreground/30 bg-card p-5 text-sm text-muted-foreground">No planned maintenance is scheduled. Where planned work is likely to cause a material interruption, we list it here in advance.</p>
                    ) : (
                      view.upcoming.map((i) => <IncidentCard key={i.id} i={i} />)
                    )}
                  </div>
                </div>
                <div>
                  <Reveal>
                    <SectionEyebrow index="03" label="Last 30 days" />
                    <h2 className="mt-5 flex items-center gap-3 font-display text-4xl uppercase leading-none"><Clock className="h-8 w-8" aria-hidden /> History</h2>
                  </Reveal>
                  <div className="mt-6 grid gap-5">
                    {view.history.length === 0 ? (
                      <p className="border-[3px] border-dashed border-foreground/30 bg-card p-5 text-sm text-muted-foreground">No incidents or maintenance have been recorded in the last 30 days.</p>
                    ) : (
                      view.history.map((i) => <IncidentCard key={i.id} i={i} />)
                    )}
                  </div>
                </div>
              </div>
            </BrandSection>
          </>
        )}

        <BrandSection tone="dark">
          <Reveal>
            <SectionEyebrow index={view ? "04" : "01"} label="Your service not working?" tone="dark" />
            <h2 className="mt-5 font-display text-[2.5rem] uppercase leading-[0.9] sm:text-5xl">Get it sorted</h2>
            <p className="mt-4 max-w-2xl text-white/70">
              Restarting your router (off at the wall for 30 seconds) fixes many short drop-outs. Our <Link to="/help/no-internet-troubleshooting" className="font-semibold text-white underline decoration-primary decoration-2 underline-offset-4">No Internet checklist</Link> takes five minutes.
              If you rely on Digital Voice and it's down, use a mobile to call 999 or 112.
            </p>
          </Reveal>
          <Reveal stagger as="ol" className="mt-10 grid gap-[3px] border-[3px] border-white/25 bg-white/25 md:grid-cols-3">
            {routes.map((r, i) => (
              <motion.li key={r.title} variants={revealItem} className="flex flex-col bg-[hsl(0_0%_8%)] p-6">
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-10 w-10 items-center justify-center bg-primary text-black"><r.icon className="h-5 w-5" /></span>
                  <span className="font-display text-4xl leading-none text-white/20">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-5 font-display text-3xl uppercase leading-none text-white">{r.title}</h3>
                <p className="mt-3 mb-6 flex-1 text-sm leading-relaxed text-white/65">{r.body}</p>
                {r.action}
              </motion.li>
            ))}
          </Reveal>
        </BrandSection>
      </MotionConfig>
    </Layout>
  );
};

export default ServiceStatus;
