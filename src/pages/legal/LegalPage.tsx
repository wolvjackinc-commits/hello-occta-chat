import { ReactNode, useEffect } from "react";
import Layout from "@/components/layout/Layout";
import { SEO } from "@/components/seo";
import { Link } from "react-router-dom";
import { logClientEvent } from "@/lib/activityLog";
import { BrandSection, HeroKicker, HeroTitle, PosterBreadcrumb, PosterStage } from "@/components/brand/kit";

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
      <article>
        <PosterStage>
          <PosterBreadcrumb items={[{ label: "Home", to: "/" }, { label: "Legal" }, { label: title }]} />
          <HeroKicker>OCCTA Legal &amp; Compliance</HeroKicker>
          <HeroTitle size="sm" className="max-w-4xl">{title}</HeroTitle>
          <p className="mt-6 inline-block border-l-[3px] border-primary pl-3 font-sans text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
            Last updated: {lastUpdated}
          </p>
        </PosterStage>

        <BrandSection tone="paper">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-20">
            <div className="prose prose-base max-w-3xl text-foreground [&_a]:font-medium [&_a]:underline [&_a]:decoration-primary [&_a]:decoration-2 [&_a]:underline-offset-4 [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:border-t-[3px] [&_h2]:border-foreground [&_h2]:pt-6 [&_h2]:font-display [&_h2]:text-3xl [&_h2]:uppercase [&_h2]:leading-none [&_h2:first-child]:mt-0 [&_li]:text-foreground/75 [&_p]:text-foreground/75 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
              {children}
            </div>

            <aside className="lg:sticky lg:top-28 lg:self-start">
              <div className="border-[3px] border-foreground bg-card">
                <p className="border-b-[3px] border-foreground bg-primary px-5 py-2.5 font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-black">
                  Need to raise something?
                </p>
                <p className="p-5 text-sm leading-relaxed text-muted-foreground">
                  See our <Link to="/complaints" className="font-medium text-foreground underline decoration-primary decoration-2 underline-offset-4">complaints process</Link> or
                  contact <a href="mailto:hello@occta.co.uk" className="font-medium text-foreground underline decoration-primary decoration-2 underline-offset-4">hello@occta.co.uk</a>.
                </p>
              </div>
            </aside>
          </div>
        </BrandSection>
      </article>
    </Layout>
  );
}
