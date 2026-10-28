import LegalPage from "./LegalPage";

export default function Accessibility() {
  return (
    <LegalPage
      title="Accessibility Statement"
      description="OCCTA's accessibility statement: the standard we aim for, how the website supports keyboard and screen reader users, accessible bills and contact options, known limitations and how to report a problem."
      canonical="/legal/accessibility"
      lastUpdated="28 October 2026"
    >
      <p>
        OCCTA wants everyone to be able to find, buy and manage our services, whatever their ability or the technology they use. This statement covers
        www.occta.co.uk, our online customer account, and the ways you can contact us.
      </p>

      <h2>The standard we aim for</h2>
      <p>
        We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.1 at level AA across customer-facing pages, and we keep improving as we find
        issues. We also respect your device's reduced-motion setting, so animations are minimised if you've asked for that.
      </p>

      <h2>What our website is designed to let you do</h2>
      <ul>
        <li>Navigate and complete primary actions — address checks, orders, account tasks and support tickets — using a keyboard alone.</li>
        <li>See clear, visible focus outlines and high-contrast text and controls.</li>
        <li>Use a screen reader: pages use semantic headings, labelled form fields and descriptive link text.</li>
        <li>Zoom text up to 200% without losing content or functionality.</li>
        <li>Use our online assistant, which can be operated by keyboard and closed at any time.</li>
      </ul>

      <h2>Accessible formats and contact options</h2>
      <ul>
        <li>Bills, Contract Summaries and important letters in large print, braille or audio, free of charge.</li>
        <li>Relay UK: dial 18001 followed by 0800 260 6626.</li>
        <li>Email <a href="mailto:hello@occta.co.uk">hello@occta.co.uk</a>, online chat, support tickets or post if phone isn't right for you.</li>
        <li>A nominated person who can manage your account on your behalf, with your consent.</li>
        <li>More time and plain-English explanations — just ask.</li>
      </ul>

      <h2>Known limitations</h2>
      <ul>
        <li>Some older PDF documents may not be fully tagged for screen readers. Ask us and we'll provide an accessible version.</li>
        <li>Some third-party components, such as address lookup and payment-provider screens, are outside our direct control. We choose suppliers with accessibility in mind and report issues to them.</li>
      </ul>

      <h2>Reporting a problem</h2>
      <p>
        If anything on our website or in our communications isn't accessible to you, email <a href="mailto:hello@occta.co.uk">hello@occta.co.uk</a> with
        "Accessibility" in the subject, telling us the page and what happened. We'll offer an alternative way to get what you need straight away and prioritise
        a fix.
      </p>

      <h2>More support</h2>
      <p>
        If you need extra help because of your circumstances, see our <a href="/legal/vulnerable-customers">Vulnerable Customers Policy</a>. If you're unhappy
        with how we've responded, you can complain under our <a href="/legal/complaints-code">Complaints Code</a>.
      </p>
    </LegalPage>
  );
}
