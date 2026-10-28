import LegalPage from "./LegalPage";
import { CHARGED_PRICES } from "@/lib/pricing/chargedPrices";

const BANDS = [
  { key: "essential", name: "Essential Fibre", speed: "up to 80Mbps" },
  { key: "superfast", name: "Superfast Fibre", speed: "up to 330Mbps" },
  { key: "ultrafast", name: "Ultrafast Fibre", speed: "up to 550Mbps" },
  { key: "gigabit", name: "Gigabit Fibre", speed: "up to 1000Mbps" },
] as const;

export default function PriceTransparency() {
  return (
    <LegalPage
      title="OCCTA price transparency policy"
      description="How OCCTA prices broadband: current residential prices, no CPI or inflation-linked rises, one-off and exit charges, late payment, VAT and how your Contract Summary confirms the final price."
      canonical="/legal/price-transparency"
      lastUpdated="28 October 2026"
    >
      <p>
        OCCTA is committed to clear, honest pricing in line with Ofcom's expectations and UK consumer law. This policy explains how our prices are set out,
        what can and can't change, and which other charges may apply.
      </p>

      <h2>Current residential broadband prices</h2>
      <p>Monthly prices from, including VAT at 20%. The price for your address is confirmed in your Contract Summary.</p>
      <table>
        <thead><tr><th>Speed band</th><th>Price Lock 24</th><th>Flex 30</th></tr></thead>
        <tbody>
          {BANDS.map((b) => (
            <tr key={b.key}>
              <td>{b.name} ({b.speed})</td>
              <td>£{CHARGED_PRICES[b.key].lock24.toFixed(2)}</td>
              <td>£{CHARGED_PRICES[b.key].flex30.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Indicative vs confirmed pricing</h2>
      <p>
        Prices on marketing pages are the starting price for each band. Your final monthly price, minimum term, speed information and every one-off charge are
        confirmed in your <strong>Contract Summary</strong> and Contract Information before you're asked to accept. Customer-specific prices in those documents
        take priority over general website information.
      </p>

      <h2>No mid-contract inflation rises</h2>
      <p>
        OCCTA does not include any scheduled CPI-, RPI-, inflation-linked or percentage-based increase in its residential consumer agreement (contract version 2026.10.1).
        For Price Lock 24, the recurring broadband price stays fixed for the 24-month minimum term except where a change is required or permitted by law.
        If a contract change gives you a right to leave without penalty, we give the required notice on a durable medium — normally at least one month — and explain the right and the deadline.
        Statutory changes outside our control, such as a change in the VAT rate, are passed through and itemised.
      </p>

      <h2>One-off charges</h2>
      <ul>
        <li>Setup, installation, router or other equipment charges are shown in your Contract Summary before you order. Bringing your own compatible router costs £0.</li>
        <li>Where an engineer visit is needed, any charge that can reasonably be known is disclosed before you agree. Missed-appointment, no-access or customer-caused work charges are limited to the actual network charge we incur, and only where the basis was disclosed and the charge is fair.</li>
        <li>If you move home and your service can move without new network work, there's no home-move fee.</li>
      </ul>

      <h2>Leaving early and network charges</h2>
      <ul>
        <li><strong>Flex 30:</strong> no remaining-month Early Termination Charge.</li>
        <li><strong>Price Lock 24:</strong> if you leave during the minimum term and no penalty-free exit right applies, an Early Termination Charge may apply. It starts with the recurring charges remaining, deducts VAT no longer due and costs we avoid, and never exceeds the remaining recurring charges.</li>
        <li><strong>Network cease/migration charge:</strong> separate from an ETC, applied only where lawful and actually incurred, and capped at £114 inc VAT within 12 months of going live and £60 inc VAT after that.</li>
        <li>When you switch away under One Touch Switch, notice-period charges don't continue beyond the completed switch date.</li>
      </ul>

      <h2>Late payment</h2>
      <p>
        If a payment fails or becomes overdue, we notify you and give you a reasonable opportunity to pay. A £10 late-payment administration charge may be applied
        only after an overdue notice, only where lawful, and never repeatedly on the same invoice. We won't take action over an amount that's genuinely disputed.
      </p>

      <h2>How you pay</h2>
      <p>
        Invoices are paid by Direct Debit, protected by the Direct Debit Guarantee, or by bank transfer to OCCTA LIMITED, Lloyds Bank, sort code 30-98-97,
        account number 61499362, quoting your account number. We don't take card payments or payments over the phone.
      </p>

      <h2>VAT</h2>
      <p>
        OCCTA LIMITED is VAT registered (VAT No. 520 6072 30) with effect from 1 July 2026. Residential prices include VAT at the standard rate (currently 20%).
        Business prices are shown ex-VAT, with VAT applied on the invoice. Every invoice shows the net amount, VAT amount and gross total.
      </p>
    </LegalPage>
  );
}
