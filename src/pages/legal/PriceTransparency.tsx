import LegalPage from "./LegalPage";

export default function PriceTransparency() {
  return (
    <LegalPage
      title="Price Transparency"
      description="OCCTA's approach to price transparency, including how indicative pricing, your Contract Summary and any supplier charges are communicated before you pay."
      canonical="/legal/price-transparency"
      lastUpdated="June 2026"
    >
      <p>OCCTA is committed to clear, honest pricing in line with Ofcom expectations and consumer law.</p>
      <h2>Indicative vs confirmed pricing</h2>
      <p>Prices shown on marketing pages are indicative. Final price, contract length, fees, speed and key terms will be confirmed in your <strong>Contract Summary</strong> before you pay.</p>
      <h2>Mid-contract price rises</h2>
      <p>OCCTA does not apply automatic inflation-linked (CPI) or annual price rises on residential telecom services. If we ever need to change a price, you'll be told in writing and given the right to leave penalty-free, as required by the General Conditions.</p>
      <h2>One-off charges</h2>
      <ul>
        <li>Any setup, equipment, installation or supplier charges are shown in your Contract Summary.</li>
        <li>Early termination charges (where applicable to Contract Saver plans) are shown in your Contract Summary.</li>
      </ul>
      <h2>VAT</h2>
      <p>Residential prices include VAT where chargeable. Business prices are shown ex-VAT with VAT applied at checkout and on the invoice. See our <a href="/legal/code-of-practice">Code of Practice</a> for more.</p>
    </LegalPage>
  );
}