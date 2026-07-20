import { Shield, Clock, Users, PoundSterling, HeadphonesIcon } from "lucide-react";

export const BusinessTrustBar = () => (
  <div className="border-y-4 border-foreground bg-secondary">
    <div className="container mx-auto px-4 py-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-primary" /> <span><strong>4-hour</strong> fix target on Fibre 500+</span></div>
        <div className="flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> <span>Named UK account managers</span></div>
        <div className="flex items-center gap-2"><PoundSterling className="w-5 h-5 text-primary" /> <span>Ex-VAT pricing, no surprises</span></div>
        <div className="flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> <span>Ofcom-regulated UK provider</span></div>
      </div>
    </div>
  </div>
);

export default BusinessTrustBar;