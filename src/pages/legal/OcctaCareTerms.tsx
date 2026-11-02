import LegalPage from "./LegalPage";
import { CARE_TERMS, CARE_TERMS_EFFECTIVE, CARE_TERMS_SUMMARY, CARE_TERMS_VERSION } from "../../../supabase/functions/_shared/careTerms.ts";

export default function OcctaCareTerms() {
  return (
    <LegalPage
      title="OCCTA Care terms"
      description="Terms for OCCTA Care, OCCTA's home tech support subscription: plans and prices, Direct Debit, cooling-off, cancelling any time, reminders, price changes, missed payments and complaints. Not insurance."
      canonical="/legal/occta-care-terms"
      lastUpdated={CARE_TERMS_EFFECTIVE}
    >
      <p><strong>Version {CARE_TERMS_VERSION}</strong>, in force from {CARE_TERMS_EFFECTIVE}.</p>
      <p><strong>In short:</strong> {CARE_TERMS_SUMMARY}</p>
      {CARE_TERMS.map((s) => (
        <section key={s.heading}>
          <h2>{s.heading}</h2>
          <ul>{s.points.map((p) => <li key={p}>{p}</li>)}</ul>
        </section>
      ))}
      <h2>Earlier versions</h2>
      <p>
        This is the first version of the OCCTA Care terms. If we change them, earlier versions stay listed here, and every member's
        sign-up record keeps the exact version and wording they agreed to.
      </p>
    </LegalPage>
  );
}
