// Consent + analytics loader.
// Strictly opt-in. Nothing loads until the visitor clicks Accept.

const STORAGE_KEY = "occta.cookie-consent.v1";
const GA_ID = "G-T5376TR31J";
const ADS_ID = "AW-18222446720";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export type ConsentState = "granted" | "denied" | null;

export function getConsent(): ConsentState {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "granted" || v === "denied") return v;
  } catch { /* SSR / privacy mode */ }
  return null;
}

export function setConsent(state: "granted" | "denied") {
  try { localStorage.setItem(STORAGE_KEY, state); } catch { /* ignore */ }
  if (state === "granted") loadAnalytics();
  else disableAnalytics();
  window.dispatchEvent(new CustomEvent("occta:consent-change", { detail: state }));
}

let loaded = false;
export function loadAnalytics() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  const s1 = document.createElement("script");
  s1.async = true;
  s1.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s1);
  const s2 = document.createElement("script");
  s2.text = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('consent','default',{ad_storage:'granted',analytics_storage:'granted'});
gtag('config','${GA_ID}',{anonymize_ip:true});
gtag('config','${ADS_ID}');`;
  document.head.appendChild(s2);
  const s3 = document.createElement("script");
  s3.async = true;
  s3.src = `https://www.googletagmanager.com/gtag/js?id=${ADS_ID}`;
  document.head.appendChild(s3);
}

export function disableAnalytics() {
  // Set denial flag; do not attempt to unload already-loaded scripts.
  try {
    (window as unknown as { [k: string]: unknown })[`ga-disable-${GA_ID}`] = true;
    (window as unknown as { [k: string]: unknown })[`ga-disable-${ADS_ID}`] = true;
  } catch { /* ignore */ }
}

export function initConsent() {
  const state = getConsent();
  if (state === "granted") loadAnalytics();
  else disableAnalytics();
}