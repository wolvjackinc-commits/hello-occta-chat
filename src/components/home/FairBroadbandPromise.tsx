import { Router, Lock, Receipt, Calendar, LifeBuoy } from "lucide-react";

const promises = [
  {
    icon: Router,
    title: "No forced router",
    body: "Use your own compatible router for £0, or add one only if you need it.",
  },
  {
    icon: Lock,
    title: "No confusing annual rises on Price Lock",
    body: "Choose a Price Lock plan and your monthly broadband price stays fixed for the agreed term.",
  },
  {
    icon: Receipt,
    title: "No hidden first bill",
    body: "We show your monthly price, router, setup and add-ons before you order.",
  },
  {
    icon: Calendar,
    title: "No long contract if you choose Flex 30",
    body: "Prefer freedom? Choose a 30-day rolling plan where available.",
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
            Bring your own router and save. Choose Price Lock or Flex 30. See your first bill before you order.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 border-4 border-foreground">
          {promises.map((p, i) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className={`p-6 md:p-7 border-foreground bg-background ${i % 3 !== 2 ? "lg:border-r-4" : ""} ${i < promises.length - (promises.length % 3 || 3) ? "lg:border-b-4" : ""} ${i % 2 !== 1 ? "sm:border-r-4 lg:border-r-4" : ""} border-b-4 last:border-b-0`}
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