import LegalPage from "./LegalPage";

export default function CodeOfPractice() {
  return (
    <LegalPage
      title="Code of Practice"
      description="OCCTA's general Code of Practice for residential and small-business customers, covering sales, service, billing, complaints and the rights you have as an OCCTA customer."
      canonical="/legal/code-of-practice"
      lastUpdated="June 2026"
    >
      <p>This Code of Practice summarises how OCCTA conducts itself with residential and small-business customers and the standards you can expect from us.</p>
      <h2>Sales and signup</h2>
      <ul>
        <li>All sales are quote-led. You'll receive a Contract Summary covering price, contract length, fees, indicative speed and key terms before any payment is taken.</li>
        <li>We do not use cold-call doorstep selling.</li>
      </ul>
      <h2>Service and switching</h2>
      <ul>
        <li>Residential broadband switches use One Touch Switch.</li>
        <li>We will tell you if a Digital Home Phone migration could affect telecare or healthcare devices.</li>
      </ul>
      <h2>Billing</h2>
      <ul>
        <li>Residential prices are shown VAT inclusive. Business prices are shown VAT exclusive with VAT applied separately.</li>
        <li>Itemised invoices are available in your dashboard.</li>
      </ul>
      <h2>Complaints</h2>
      <p>See our <a href="/legal/complaints-code">Complaints Code of Practice</a> — including escalation to ADR after 6 weeks.</p>
      <h2>Vulnerable customers</h2>
      <p>See our <a href="/legal/vulnerable-customers">Vulnerable Customers Policy</a>.</p>
    </LegalPage>
  );
}