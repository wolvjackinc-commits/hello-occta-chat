import React from "react";
import {createRoot} from "react-dom/client";
import "../../src/index.css";
import {Switch50PayoutPanel} from "../../src/components/campaigns/Switch50PayoutPanel";
import {Switch50RewardStatus} from "../../src/components/campaigns/Switch50RewardStatus";
createRoot(document.getElementById("root")!).render(<main className="max-w-7xl mx-auto p-6 space-y-6"><p className="text-sm">Isolated verification · synthetic records · no payments or messages are sent</p><Switch50PayoutPanel/><Switch50RewardStatus amount={50} reward={{status:"pending",eligibility_due_at:"2026-10-08T12:00:00Z"}}/></main>);
