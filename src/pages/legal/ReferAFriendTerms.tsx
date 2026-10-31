import LegalPage from "./LegalPage";
import { REFERRAL_TERMS, REFERRAL_TERMS_SUMMARY, REFERRAL_TERMS_VERSION, REFERRAL_TERMS_EFFECTIVE } from "@/lib/referral/terms";

export default function ReferAFriendTerms() {
  return (
    <LegalPage
      title="Refer a friend terms"
      description="Terms for the OCCTA Refer a Friend scheme: who can refer, when bill credit is earned, limits, expiry, withdrawal and how to dispute a decision."
      canonical="/legal/refer-a-friend-terms"
      lastUpdated={REFERRAL_TERMS_EFFECTIVE}
    >
      <p><strong>Version {REFERRAL_TERMS_VERSION}</strong>, in force from {REFERRAL_TERMS_EFFECTIVE}.</p>
      <p><strong>In short:</strong> {REFERRAL_TERMS_SUMMARY}</p>
      {REFERRAL_TERMS.map((s) => (
        <section key={s.heading}>
          <h2>{s.heading}</h2>
          <ul>{s.points.map((p) => <li key={p}>{p}</li>)}</ul>
        </section>
      ))}
      <h2>Earlier versions</h2>
      <p>
        This is the first version of the scheme. If we change it, earlier versions stay listed here, and every referral keeps the
        version that was in force when the friend placed their order.
      </p>
    </LegalPage>
  );
}
