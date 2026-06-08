import LegalPage from "./LegalPage";

export default function NetworkManagement() {
  return (
    <LegalPage
      title="Traffic Management &amp; Network Policy"
      description="OCCTA's approach to traffic management, net neutrality and the wholesale networks we use to deliver broadband and voice services."
      canonical="/legal/network-management"
      lastUpdated="June 2026"
    >
      <p>OCCTA delivers connectivity over wholesale networks operated by regulated UK partners (including Openreach for residential broadband). We aim to operate in line with the UK net neutrality framework.</p>
      <h2>Traffic management</h2>
      <ul>
        <li>We do not throttle, prioritise or block lawful internet traffic by application or service.</li>
        <li>We may apply reasonable measures to protect network integrity, prevent abuse or comply with court orders.</li>
      </ul>
      <h2>Speeds</h2>
      <ul>
        <li>Actual speeds depend on line quality, equipment, time of day and the wholesale product available at your address.</li>
        <li>Indicative speeds are shown on marketing pages; confirmed estimated speeds appear in your Contract Summary.</li>
      </ul>
      <h2>Security and abuse</h2>
      <p>Report suspected abuse to <a href="mailto:abuse@occta.co.uk">abuse@occta.co.uk</a>. See also our <a href="/legal/acceptable-use">Acceptable Use Policy</a>.</p>
    </LegalPage>
  );
}