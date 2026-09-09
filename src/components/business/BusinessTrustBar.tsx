import { Clock, MapPinned, PoundSterling, ShieldCheck } from "lucide-react";

export const BusinessTrustBar = () => (
  <div className="border-y-4 border-foreground bg-secondary">
    <div className="container mx-auto px-4 py-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="flex items-center gap-2"><MapPinned className="w-5 h-5 text-primary" /> <span><strong>Address-led</strong> service qualification</span></div>
        <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-primary" /> <span>Care target confirmed for the selected network</span></div>
        <div className="flex items-center gap-2"><PoundSterling className="w-5 h-5 text-primary" /> <span>Ex-VAT + inc-VAT pricing shown</span></div>
        <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> <span>Supplier economics checked before contract</span></div>
      </div>
    </div>
  </div>
);

export default BusinessTrustBar;