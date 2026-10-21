import { Link } from "react-router-dom";

/**
 * The order journey's opening Terms/Privacy acknowledgement. Shown on the
 * address screen, or on the plan screen when the address was confirmed
 * automatically from the homepage checker, so every customer sees it before
 * continuing. Wording is unchanged from the original address screen.
 */
export default function JourneyTermsNote() {
  return (
    <p className="text-xs text-muted-foreground">
      By continuing, you acknowledge OCCTA's <Link to="/terms" className="underline hover:text-foreground">Terms of Service</Link> and{" "}
      <Link to="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>. Entering the order journey does not allow OCCTA to substitute a different broadband plan or price without your agreement.
    </p>
  );
}
