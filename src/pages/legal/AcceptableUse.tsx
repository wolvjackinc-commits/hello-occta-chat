import LegalPage from "./LegalPage";

export default function AcceptableUse() {
  return (
    <LegalPage
      title="Acceptable use of OCCTA services"
      description="OCCTA's Acceptable Use Policy for broadband, Digital Voice and SIM services: what's not allowed, your security responsibilities, how we enforce the policy and how to report abuse."
      canonical="/legal/acceptable-use"
      lastUpdated="28 October 2026"
    >
      <p>
        This Acceptable Use Policy (AUP) applies to everyone who uses an OCCTA broadband, Digital Voice or SIM service, including other people in your home or
        business. It forms part of your agreement with OCCTA LIMITED. The account holder is responsible for use of the service on their account.
      </p>

      <h2>You must not use the service to</h2>
      <ul>
        <li>break any UK law, or help anyone else to do so;</li>
        <li>create, store, share or access child sexual abuse material — we report this to the authorities;</li>
        <li>send unsolicited bulk email or messages (spam), or make nuisance or malicious calls;</li>
        <li>host, distribute or knowingly spread malware, or operate botnets;</li>
        <li>carry out denial-of-service attacks, port scanning or unauthorised access to other people's systems;</li>
        <li>infringe copyright or other intellectual property rights;</li>
        <li>harass, threaten or defraud others;</li>
        <li>use spoofed caller IDs or misleading sender details;</li>
        <li>resell the service or supply it to third parties without our written agreement; or</li>
        <li>use the service in a way that materially harms, disrupts or degrades the network or service for other customers.</li>
      </ul>

      <h2>Mobile and voice services</h2>
      <ul>
        <li>SIMs must not be used in SIM boxes, gateways or auto-dialling equipment, or for bulk messaging, unless agreed in writing.</li>
        <li>Calls and texts in bundles are for normal personal or business use. Any fair-use terms for your plan are shown before you accept.</li>
        <li>Report a lost or stolen SIM straight away so we can bar it.</li>
      </ul>

      <h2>Your security responsibilities</h2>
      <ul>
        <li>Keep your account password, PPPoE details and router admin password private, and change default passwords.</li>
        <li>Use WPA2 or WPA3 security on your Wi-Fi and keep router firmware and devices up to date.</li>
        <li>Tell us promptly if you think your service or account has been compromised.</li>
      </ul>

      <h2>How we enforce this policy</h2>
      <ul>
        <li>We don't actively monitor the content of your traffic. We may investigate where we receive a credible report, detect a security threat, or are required to by law.</li>
        <li>Where reasonable, we contact you first and give you a chance to put things right.</li>
        <li>For serious or repeated breaches, or where there's a risk to the network or others, we may restrict, suspend or end the service, as set out in our <a href="/terms">Terms of Service</a>. We provide notice where reasonably possible and consider particular risks to vulnerable users.</li>
        <li>We cooperate with law enforcement and regulators where legally required.</li>
      </ul>

      <h2>Reporting abuse</h2>
      <p>
        Report suspected abuse of OCCTA services — spam, attacks or illegal content — to <a href="mailto:abuse@occta.co.uk">abuse@occta.co.uk</a>, with as much
        detail as you can (dates, times in UTC, IP addresses or numbers, and headers or logs). For nuisance calls and scams, see our{" "}
        <a href="/help/nuisance-calls">nuisance calls</a> and <a href="/help/scams-and-phishing">scams</a> guides.
      </p>
    </LegalPage>
  );
}
