import LegalPage from "./LegalPage";

export default function Accessibility() {
  return (
    <LegalPage
      title="Accessibility Statement"
      description="OCCTA's accessibility statement covering this website and the support options available to disabled customers."
      canonical="/legal/accessibility"
      lastUpdated="June 2026"
    >
      <p>We want everyone to be able to use OCCTA, regardless of ability. We aim to meet WCAG 2.1 AA across our customer-facing pages and continue to improve.</p>
      <h2>Website</h2>
      <ul>
        <li>Keyboard navigation across all primary actions.</li>
        <li>Visible focus styles and high-contrast colour palette.</li>
        <li>Semantic HTML and labelled form controls.</li>
      </ul>
      <h2>Support options</h2>
      <ul>
        <li>Email support at <a href="mailto:hello@occta.co.uk">hello@occta.co.uk</a>.</li>
        <li>UK Relay support via Text Relay (dial 18001 before our number).</li>
        <li>Large-print or alternative format bills on request.</li>
      </ul>
      <h2>Reporting issues</h2>
      <p>If something on this site isn't accessible, please tell us at <a href="mailto:hello@occta.co.uk">hello@occta.co.uk</a> and we'll prioritise the fix.</p>
    </LegalPage>
  );
}