import { Navigate, useLocation } from "react-router-dom";
import { normalizePublicPath } from "@/lib/seo/normalizePath";

/** Sends uppercase and trailing-slash variants to the canonical path in the browser. */
export default function CanonicalPath() {
  const location = useLocation();
  const next = normalizePublicPath(location.pathname);
  if (next === location.pathname) return null;
  return <Navigate to={`${next}${location.search}${location.hash}`} replace />;
}
