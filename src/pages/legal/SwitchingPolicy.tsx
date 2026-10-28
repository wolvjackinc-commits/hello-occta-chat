import LegalPage from "./LegalPage";

export default function SwitchingPolicy() {
  return (
    <LegalPage
      title="OCCTA broadband switching policy"
      description="How OCCTA handles One Touch Switch for broadband and home phone, number porting and mobile text-to-switch: what happens before, during and after your switch, and your rights if it goes wrong."
      canonical="/legal/switching-policy"
      lastUpdated="28 October 2026"
    >
      <p>
        OCCTA LIMITED takes part in the UK telecoms One Touch Switch (OTS) process required by Ofcom General Condition C7 for residential broadband and home phone switches.
        This policy explains what that means whether you're switching to OCCTA or away from us, and how number porting works.
      </p>

      <h2>Switching to OCCTA</h2>
      <h3>Before you're bound</h3>
      <ul>
        <li>We check the services available at your address and give you a Contract Summary and Contract Information before you accept.</li>
        <li>As part of the switch, your current provider must tell you about anything that affects you — such as an early termination charge for the service you're leaving, or the impact on other services you have with them.</li>
        <li>Tell us if anyone relies on your phone line for telecare, health devices or alarms, so we can discuss compatibility and resilience before the switch.</li>
      </ul>
      <h3>During the switch</h3>
      <ul>
        <li>Where OTS applies, you don't need to contact your current provider. We coordinate the switch and confirm the switch date with you.</li>
        <li>Don't cancel your existing service yourself, particularly if you're keeping your phone number — you could lose the number.</li>
        <li>We tell you about any expected downtime. Switches can involve a short interruption on the day.</li>
      </ul>
      <h3>After the switch</h3>
      <ul>
        <li>Your old service ends when your OCCTA service goes live, and OCCTA billing starts only once your service is confirmed live.</li>
        <li>You normally have 14 days from accepting your order to cancel. If you asked us to start sooner and service or work has already been supplied, a proportionate charge applies as explained in your Contract Information.</li>
      </ul>

      <h2>Switching away from OCCTA</h2>
      <ul>
        <li>Contact your new provider. Where OTS applies, they coordinate the switch with us — you don't need to cancel with us separately.</li>
        <li>We provide the switching information required, including any valid Early Termination Charge, so you can decide before you proceed.</li>
        <li>Your OCCTA service ends on the completed switch date. We don't charge notice-period subscription fees beyond that date.</li>
        <li>If you've paid in advance for service beyond the switch date, we refund the unused portion.</li>
        <li>If you rent or borrowed equipment from us, we send return instructions; it should be returned within 14 days of those instructions.</li>
      </ul>

      <h2>Keeping your phone number</h2>
      <h3>Home phone (Digital Voice)</h3>
      <p>Most UK landline numbers can be ported to or from OCCTA, subject to technical availability. Porting is arranged by the provider you're moving to.</p>
      <h3>Mobile</h3>
      <ul>
        <li>To keep your number, text PAC to 65075. To leave and get a new number, text STAC to 75075. Both are free.</li>
        <li>Your provider must reply by text with the code (valid for 30 days) and any information about charges for ending your contract.</li>
        <li>Give the code to your new provider. Ports normally complete within one working day.</li>
      </ul>

      <h2>If something goes wrong</h2>
      <p>
        If a switch or number port is delayed or fails in circumstances where regulatory compensation is due, we provide it or explain how it's obtained.
        You can also raise a complaint under our <a href="/legal/complaints-code">Complaints Code</a>, including free referral to Alternative Dispute Resolution
        after 6 weeks or deadlock.
      </p>

      <h2>Business customers</h2>
      <p>
        Business switches, multi-site moves and number porting for business lines are planned with you as part of your written quote, including timings and any
        third-party charges.
      </p>
    </LegalPage>
  );
}
