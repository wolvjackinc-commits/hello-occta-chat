import { Link } from "react-router-dom";
import { ArrowRight, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { companyConfig } from "@/lib/companyConfig";

/**
 * What a signed-out visitor sees on a business portal page: how the service
 * works, how to get in, and how to reach the team without an account.
 */
export function BusinessPortalSignedOut({
  next,
  heading,
  intro,
  points,
  links,
}: {
  next: string;
  heading: string;
  intro: string;
  points: { title: string; body: string }[];
  links: { to: string; label: string }[];
}) {
  return (
    <div className="space-y-8">
      <div className="grid gap-6 border-[3px] border-foreground bg-card p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <h2 className="font-display text-2xl uppercase leading-none">{heading}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{intro}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to={`/auth?next=${encodeURIComponent(next)}`}><Button variant="hero">Sign in</Button></Link>
          <Link to="/business/contact-sales"><Button variant="outline">Become a customer</Button></Link>
        </div>
      </div>

      <ol className="grid gap-[3px] border-[3px] border-foreground bg-foreground md:grid-cols-2 lg:grid-cols-4">
        {points.map((p, i) => (
          <li key={p.title} className="bg-card p-5">
            <span className="font-display text-3xl leading-none text-foreground/25">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="mt-3 font-display text-lg uppercase leading-tight">{p.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground/70">{p.body}</p>
          </li>
        ))}
      </ol>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="border-[3px] border-foreground bg-secondary p-5 text-sm">
          <p className="font-display text-lg uppercase leading-none">Business team</p>
          <p className="mt-3 flex items-center gap-2"><Phone className="h-4 w-4" aria-hidden /> <a href={companyConfig.phone.href} className="font-semibold hover:underline">{companyConfig.phone.display}</a> · {companyConfig.supportHours.weekday}</p>
          <p className="mt-1.5 flex items-center gap-2"><Mail className="h-4 w-4" aria-hidden /> <a href="mailto:business@occta.co.uk" className="font-semibold hover:underline">business@occta.co.uk</a></p>
          <p className="mt-3 text-muted-foreground">Have your company name and account number ready so we can verify you quickly.</p>
        </div>
        <div className="border-[3px] border-foreground bg-card p-5 text-sm">
          <p className="font-display text-lg uppercase leading-none">Useful links</p>
          <ul className="mt-3 space-y-1.5">
            {links.map((l) => (
              <li key={l.to}><Link to={l.to} className="inline-flex items-center gap-1.5 font-semibold hover:underline">{l.label} <ArrowRight className="h-3.5 w-3.5" /></Link></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
