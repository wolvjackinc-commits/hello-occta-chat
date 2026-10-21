import { Clock, MapPinned, PoundSterling, ShieldCheck } from "lucide-react";

const items = [
  { icon: MapPinned, label: <><strong className="text-white">Address-led</strong> service qualification</> },
  { icon: Clock, label: <>Care target confirmed for the selected network</> },
  { icon: PoundSterling, label: <>Ex-VAT + inc-VAT pricing shown</> },
  { icon: ShieldCheck, label: <>Supplier economics checked before contract</> },
];

export const BusinessTrustBar = () => (
  <div className="border-b-[3px] border-primary bg-[hsl(0_0%_5%)] text-white/75">
    <ul className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ icon: Icon, label }, i) => (
        <li key={i} className="flex items-center gap-3 bg-[hsl(0_0%_5%)] px-4 py-4 text-sm sm:px-6 md:px-8">
          <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center bg-primary text-black">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <span>{label}</span>
        </li>
      ))}
    </ul>
  </div>
);

export default BusinessTrustBar;
