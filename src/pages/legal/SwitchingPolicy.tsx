import LegalPage from "./LegalPage";

export default function SwitchingPolicy() {
  return (
    <LegalPage
      title="Switching Policy"
      description="How OCCTA handles One Touch Switch and what happens before, during and after your switch."
      canonical="/legal/switching-policy"
      lastUpdated="June 2026"
    >
      <p>OCCTA participates in the UK telecoms One Touch Switch process for residential broadband and landline switches. This page summarises what that means for you.</p>
      <h2>Before you switch</h2>
      <ul>
        <li>You'll receive a Contract Summary with provisional switch date, expected downtime window and any charges from your current provider.</li>
        <li>You can cancel free of charge during the 14-day cooling-off period from acceptance.</li>
      </ul>
      <h2>During the switch</h2>
      <ul>
        <li>You don't need to call your current provider — we coordinate the switch through One Touch Switch.</li>
        <li>We will tell you about any expected downtime; brief outages can happen.</li>
      </ul>
      <h2>After the switch</h2>
      <ul>
        <li>Your first OCCTA invoice will be available in your dashboard.</li>
        <li>If something goes wrong, raise it via our <a href="/legal/complaints-code">Complaints Code of Practice</a>.</li>
      </ul>
    </LegalPage>
  );
}