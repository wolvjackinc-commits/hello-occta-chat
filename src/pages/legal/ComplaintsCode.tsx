import LegalPage from "./LegalPage";

export default function ComplaintsCode() {
  return (
    <LegalPage
      title="Complaints Code of Practice"
      description="OCCTA's Complaints Code of Practice: how to complain, our response targets, internal escalation, deadlock letters and free referral to Alternative Dispute Resolution after 6 weeks."
      canonical="/legal/complaints-code"
      lastUpdated="28 October 2026"
    >
      <p>
        This Code explains how OCCTA LIMITED handles complaints from residential and small-business customers, what you can expect from us at each stage,
        and how to take your complaint to an independent Alternative Dispute Resolution (ADR) scheme if we can't resolve it. Making a complaint is free and
        will never affect the service you receive.
      </p>

      <h2>What counts as a complaint</h2>
      <p>
        A complaint is any expression of dissatisfaction about our products, services, billing, sales, communications or how we've handled an earlier issue,
        where a response or resolution is expected. You don't need to use the word "complaint" — if you tell us you're unhappy, we'll treat it as one.
      </p>

      <h2>How to complain</h2>
      <ul>
        <li>Online: use our <a href="/complaints">complaints page</a> or raise a ticket from your account.</li>
        <li>Email: <a href="mailto:complaints@occta.co.uk">complaints@occta.co.uk</a> or <a href="mailto:hello@occta.co.uk">hello@occta.co.uk</a>.</li>
        <li>Phone: 0800 260 6626, Monday to Friday, 8am to 6pm (excluding bank holidays).</li>
        <li>Post: OCCTA LIMITED, 22 Pavilion View, Huddersfield, HD3 3WU.</li>
      </ul>
      <p>
        Please include your name, account number, the service concerned, what went wrong, and what you'd like us to do to put it right. If you'd like someone
        else — a relative, carer or advice service — to complain on your behalf, that's fine with your consent.
      </p>

      <h2>What we will do</h2>
      <table>
        <thead><tr><th>Stage</th><th>Our commitment</th></tr></thead>
        <tbody>
          <tr><td>Acknowledgement</td><td>Within 2 working days, with a complaint reference and the name of the team handling it.</td></tr>
          <tr><td>Investigation</td><td>We review your account, service records, calls and correspondence, and contact the network or suppliers where needed.</td></tr>
          <tr><td>Resolution</td><td>We aim to resolve complaints within 10 working days. If it will take longer, we tell you why and when to expect an update.</td></tr>
          <tr><td>Written outcome</td><td>We explain what we found, what we will do, and your right to escalate.</td></tr>
        </tbody>
      </table>
      <p>
        Remedies can include fixing the underlying problem, correcting your bill, a refund or credit, a goodwill gesture where appropriate, changes to how we work,
        or allowing you to leave without penalty where the law or your contract gives you that right.
      </p>

      <h2>Internal escalation</h2>
      <p>
        If you're not satisfied with our response, ask for your complaint to be escalated. A senior member of the team who wasn't involved in the original
        handling will review it and give you a final position in writing.
      </p>

      <h2>Deadlock and ADR</h2>
      <p>
        If we haven't resolved your complaint within <strong>6 weeks</strong> of you first raising it, or if we've reached a point where we can't agree
        (a "deadlock") and issue you a deadlock letter sooner, you have the right to refer the complaint to our ADR scheme. ADR is independent, free for
        customers, and its decision isn't binding on you unless you accept it. Our deadlock letter and written outcome confirm the scheme's name and contact details,
        and you can ask us for them at any time.
      </p>
      <p>
        Ofcom regulates the communications sector and publishes guidance on your rights at ofcom.org.uk, but it does not normally decide individual disputes.
      </p>

      <h2>Customers who need extra support</h2>
      <p>
        Tell us if you need us to communicate in a particular way, need more time, or would like a nominated person to handle your complaint. Complaints
        involving telecare, health, safety or financial hardship are prioritised. See our <a href="/legal/vulnerable-customers">Vulnerable Customers Policy</a>.
      </p>

      <h2>Records</h2>
      <p>
        We keep records of complaints and their outcome for at least 2 years from closure, and use them to find and fix the causes of recurring problems.
        Personal data is handled under our <a href="/privacy">Privacy Policy</a>.
      </p>
    </LegalPage>
  );
}
