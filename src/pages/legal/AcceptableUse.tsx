import LegalPage from "./LegalPage";

export default function AcceptableUse() {
  return (
    <LegalPage
      title="Acceptable Use Policy"
      description="OCCTA Acceptable Use Policy — how our broadband, voice and SIM services may be used and the activities that are not permitted."
      canonical="/legal/acceptable-use"
      lastUpdated="June 2026"
    >
      <p>This Acceptable Use Policy (AUP) governs use of OCCTA broadband, voice and SIM services.</p>
      <h2>Prohibited activity</h2>
      <ul>
        <li>Illegal activity, including distribution of unlawful content.</li>
        <li>Network abuse: spam, denial-of-service activity, port scanning of third parties.</li>
        <li>Activity that materially degrades service for other customers.</li>
        <li>Operating services that breach UK law or our supplier terms.</li>
      </ul>
      <h2>Enforcement</h2>
      <p>Where reasonable, we will contact you before taking action. Serious or repeated breaches may result in suspension or termination, as set out in our Terms of Service.</p>
      <h2>Reporting abuse</h2>
      <p>Report suspected abuse of OCCTA services to <a href="mailto:abuse@occta.co.uk">abuse@occta.co.uk</a>.</p>
    </LegalPage>
  );
}