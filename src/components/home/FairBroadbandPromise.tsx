import { Router, Lock, Receipt, Calendar, LifeBuoy, CheckCircle2 } from "lucide-react";

const promises = [
  {
    icon: Lock,
    title: "No confusing mid-contract price rises",
    body: "Choose Price Lock 24 and your monthly broadband price stays fixed for the agreed term.",
  },
  {
    icon: Calendar,
    title: "Price Lock or Flex 30",
    body: "Pick a fixed Price Lock plan or a 30-day rolling option where available.",
  },
  {
    icon: Receipt,
    title: "No hidden first bill",
    body: "We show your monthly price, router, setup and add-ons before you order.",
  },
  {
    icon: CheckCircle2,
    title: "Final price confirmed before order",
    body: "Availability, speed, setup and final price are confirmed before you proceed.",
  },
  {
    icon: Router,
    title: "Router choice",
    body: "Use your own compatible router for £0, or choose a router only if you need one.",
  },
  {
    icon: LifeBuoy,
    title: "No support black hole",
    body: "Track support tickets, complaints and documents in your OCCTA dashboard.",
  },
];

export default function FairBroadbandPromise() {
  return (
    <section className="border-y-4 border-foreground bg-background py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className="mb-10 max-w-3xl">
          <p className="font-display text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
            The OCCTA Fair Broadband Promise
          </p>
          <h2 className="font-display text-3xl md:text-5xl uppercase leading-tight">
            Broadband built around you.
          </h2>
          <p className="mt-4 text-base md:text-lg text-foreground/80 max-w-2xl">
            Choose the plan style that suits you. Price Lock 24 keeps your monthly broadband price fixed for the agreed term. Flex 30 gives you a rolling option where available. We show your first bill before you order.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 border-4 border-foreground">
          {promises.map((p, i) => {
            const Icon = p.icon;
            const isLastRowLg = i >= 3; // 6 items, 3-col grid → second row
            const isLastRowSm = i >= 4; // 6 items, 2-col grid → last row
            return (
              <div
                key={p.title}
                className={[
                  "p-6 md:p-7 border-foreground bg-background",
                  // right border (lg: every col except 3rd)
                  i % 3 !== 2 ? "lg:border-r-4" : "",
                  // right border (sm: every col except 2nd)
                  i % 2 !== 1 ? "sm:border-r-4" : "",
                  // bottom border (lg: not last row)
                  !isLastRowLg ? "lg:border-b-4" : "lg:border-b-0",
                  // bottom border (sm: not last row)
                  !isLastRowSm ? "sm:border-b-4" : "sm:border-b-0",
                  // mobile single column borders
                  i < promises.length - 1 ? "border-b-4" : "",
                ].filter(Boolean).join(" ")}
              >
                <Icon className="w-7 h-7 mb-4" strokeWidth={2.5} />
                <h3 className="font-display text-lg uppercase tracking-wide mb-2 leading-tight">
                  {p.title}
                </h3>
                <p className="text-sm text-foreground/75 leading-relaxed">{p.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}