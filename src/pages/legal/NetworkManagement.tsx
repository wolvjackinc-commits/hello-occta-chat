import LegalPage from "./LegalPage";

export default function NetworkManagement() {
  return (
    <LegalPage
      title="Traffic management and network policy"
      description="OCCTA's traffic management and open internet policy: no commercial blocking or throttling, when reasonable network management may apply, speeds, data allowances, security and maintenance."
      canonical="/legal/network-management"
      lastUpdated="28 October 2026"
    >
      <p>
        OCCTA delivers broadband and Digital Voice over wholesale access networks operated by regulated UK network providers, and mobile services over the O2,
        Vodafone and EE networks. We operate on an open-internet basis in line with the Open Internet rules retained in UK law and Ofcom's guidance.
      </p>

      <h2>Our open internet commitment</h2>
      <ul>
        <li>We don't intentionally block, slow down or prioritise lawful applications, services or content for commercial reasons.</li>
        <li>We don't sell "fast lanes" or treat traffic differently based on who provides it.</li>
        <li>Standard residential fixed broadband has no monthly data-usage cap unless your order says otherwise. Any fair-use or traffic-volume limit for a particular service is stated before you accept.</li>
      </ul>

      <h2>When reasonable network management may apply</h2>
      <p>We may take reasonable, proportionate and temporary measures only where necessary to:</p>
      <ul>
        <li>preserve the security and integrity of the network, services or customers' equipment — for example blocking malware, botnet or denial-of-service traffic;</li>
        <li>comply with the law or a court order;</li>
        <li>prevent impending congestion or manage exceptional or temporary congestion, treating equivalent traffic equally; or</li>
        <li>apply a feature you've chosen, such as a parental-control filter.</li>
      </ul>
      <p>While such measures operate they can affect throughput, latency or availability. We apply them for no longer than necessary.</p>

      <h2>Speeds and performance</h2>
      <ul>
        <li>Your Contract Summary shows address-specific speed estimates from the network and, where available, a minimum guaranteed speed. We don't present an "up to" figure as a guarantee.</li>
        <li>Real-world speeds depend on your line, in-home wiring, router position, Wi-Fi interference, the devices you use, the number of people online and the service you're connecting to.</li>
        <li>If your speed is significantly, continuously or regularly below what your contract states, contact us. We'll investigate with the network and set out the remedies available, which can include repair, a price reduction or the right to end the affected service without penalty.</li>
        <li>We don't offer a separate consumer guarantee for latency, jitter or packet loss unless your order says so, but we investigate material quality faults.</li>
      </ul>

      <h2>Maintenance and incidents</h2>
      <p>
        Planned and urgent maintenance can interrupt service. Where reasonably practicable we give advance notice of planned work likely to cause a material
        interruption. Incidents and planned maintenance are published on our <a href="/status">service status page</a>.
      </p>

      <h2>Privacy and lawful interception</h2>
      <p>
        We don't monitor the content of your traffic. We process limited network and security data needed to run, secure and bill the service, as described in
        our <a href="/privacy">Privacy Policy</a>. We disclose data to authorities only where legally required, for example under the Investigatory Powers Act 2016.
      </p>

      <h2>Security and abuse</h2>
      <p>
        Keep your router firmware up to date and change default Wi-Fi and admin passwords. Report suspected abuse of OCCTA services to{" "}
        <a href="mailto:abuse@occta.co.uk">abuse@occta.co.uk</a>. See also our <a href="/legal/acceptable-use">Acceptable Use Policy</a>.
      </p>
    </LegalPage>
  );
}
