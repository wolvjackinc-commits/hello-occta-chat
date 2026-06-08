import { ReactNode, useEffect } from "react";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Link } from "react-router-dom";
import { logClientEvent } from "@/lib/activityLog";

interface Props {
  title: string;
  description: string;
  canonical: string;
  lastUpdated: string;
  children: ReactNode;
}

export default function LegalPage({ title, description, canonical, lastUpdated, children }: Props) {
  useEffect(() => {
    logClientEvent({ event_type: "legal_view", title, source_module: "legal" });
  }, [title]);

  return (
    <Layout>
      <SEO title={title} description={description} canonical={canonical} />
      <article className="container mx-auto px-4 py-12 max-w-3xl">
        <p className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
          OCCTA Legal &amp; Compliance
        </p>
        <h1 className="font-display uppercase text-3xl md:text-5xl leading-[0.95] tracking-tight mb-3">
          {title}
        </h1>
        <p className="text-xs text-muted-foreground mb-8">Last updated: {lastUpdated}</p>
        <div className="prose prose-sm max-w-none text-foreground [&_h2]:font-display [&_h2]:uppercase [&_h2]:mt-8 [&_h2]:mb-3 [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_a]:underline">
          {children}
        </div>
        <div className="mt-12 pt-6 border-t-2 border-foreground/10 text-sm text-muted-foreground">
          Need to raise something? See our <Link to="/complaints" className="underline">complaints process</Link> or
          contact <a href="mailto:hello@occta.co.uk" className="underline">hello@occta.co.uk</a>.
        </div>
      </article>
    </Layout>
  );
}