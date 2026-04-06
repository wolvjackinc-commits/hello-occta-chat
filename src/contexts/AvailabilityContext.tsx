import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──

export interface ICUKAddress {
  [key: string]: unknown;
}

export type AvailabilityErrorType =
  | "invalid-postcode"
  | "no-addresses"
  | "backend-unavailable"
  | "availability-failed";

export type AvailabilityStatus =
  | "idle"
  | "loading-postcode"
  | "addresses"
  | "checking-address"
  | "success"
  | "error";

export interface AvailabilityResult {
  available: boolean;
  primaryTechnology: string;
  maxDownload: number;
  maxUpload: number;
  eligibleOcctaPlans: string[];
  recommendedPlan: string;
  upgradePlan?: string;
  message?: string;
}

interface AvailabilityState {
  status: AvailabilityStatus;
  postcode: string;
  addresses: ICUKAddress[];
  selectedAddress: ICUKAddress | null;
  result: AvailabilityResult | null;
  errorType: AvailabilityErrorType | null;
  errorMessage: string;
}

interface AvailabilityActions {
  checkPostcode: (pc: string) => Promise<void>;
  selectAddress: (addr: ICUKAddress) => Promise<void>;
  reset: () => void;
}

type AvailabilityContextValue = AvailabilityState & AvailabilityActions;

const SESSION_KEY = "occta_availability";

// ── Recommendation logic ──

function computeRecommendation(
  primaryTechnology: string,
  maxDownload: number,
  eligiblePlans: string[]
): { recommendedPlan: string; upgradePlan?: string } {
  if (!eligiblePlans.length) return { recommendedPlan: "" };

  // FTTC only
  if (primaryTechnology !== "FTTP") {
    return { recommendedPlan: "essential" };
  }

  // FTTP
  const hasSuperfast = eligiblePlans.includes("superfast");
  const hasUltrafast = eligiblePlans.includes("ultrafast");

  if (maxDownload >= 550 && hasSuperfast && hasUltrafast) {
    return { recommendedPlan: "superfast", upgradePlan: "ultrafast" };
  }
  if (hasSuperfast) {
    return { recommendedPlan: "superfast" };
  }
  return { recommendedPlan: eligiblePlans[0] };
}

// ── Postcode validation ──

function isValidPostcode(pc: string): boolean {
  return /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i.test(pc.trim());
}

// ── Address label helper ──

export function getAddressLabel(addr: ICUKAddress): string {
  const parts = [
    addr.sub_premises,
    addr.premises_name,
    addr.thoroughfare_number,
    addr.thoroughfare_name,
    addr.locality,
    addr.post_town,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(", ") as string;
  const fallback = Object.values(addr).filter(
    (v) => typeof v === "string" && v.length > 0
  );
  return (fallback.slice(0, 4).join(", ") as string) || "Address";
}

export function getShortAddress(addr: ICUKAddress): string {
  const parts = [
    addr.sub_premises,
    addr.premises_name,
    addr.thoroughfare_number,
    addr.thoroughfare_name,
  ].filter(Boolean);
  return (parts.join(", ") as string) || "Your address";
}

// ── Session helpers ──

function saveToSession(state: AvailabilityState) {
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        postcode: state.postcode,
        selectedAddress: state.selectedAddress,
        result: state.result,
      })
    );
  } catch {}
}

function loadFromSession(): Partial<AvailabilityState> | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.result && parsed?.postcode) {
      return {
        status: "success" as AvailabilityStatus,
        postcode: parsed.postcode,
        selectedAddress: parsed.selectedAddress,
        result: parsed.result,
      };
    }
  } catch {}
  return null;
}

// ── Context ──

const AvailabilityContext = createContext<AvailabilityContextValue | null>(null);

const defaultState: AvailabilityState = {
  status: "idle",
  postcode: "",
  addresses: [],
  selectedAddress: null,
  result: null,
  errorType: null,
  errorMessage: "",
};

export function AvailabilityProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AvailabilityState>(() => {
    const cached = loadFromSession();
    if (cached) return { ...defaultState, ...cached };
    return defaultState;
  });

  const checkPostcode = useCallback(async (pc: string) => {
    const trimmed = pc.trim();
    if (!isValidPostcode(trimmed)) {
      setState((s) => ({
        ...s,
        status: "error",
        postcode: trimmed,
        errorType: "invalid-postcode",
        errorMessage: "That doesn't look like a proper postcode.",
        addresses: [],
        selectedAddress: null,
        result: null,
      }));
      return;
    }

    setState((s) => ({
      ...s,
      status: "loading-postcode",
      postcode: trimmed,
      addresses: [],
      selectedAddress: null,
      result: null,
      errorType: null,
      errorMessage: "",
    }));

    try {
      const { data, error } = await supabase.functions.invoke("check-address", {
        body: { postcode: trimmed },
      });

      if (error) throw error;

      if (!data?.addresses || data.addresses.length === 0) {
        setState((s) => ({
          ...s,
          status: "error",
          errorType: "no-addresses",
          errorMessage:
            data?.message ||
            "We couldn't find any addresses for that postcode.",
        }));
        return;
      }

      setState((s) => ({
        ...s,
        status: "addresses",
        addresses: data.addresses,
      }));
    } catch (err) {
      console.error("Address lookup error:", err);
      setState((s) => ({
        ...s,
        status: "error",
        errorType: "backend-unavailable",
        errorMessage: "Something went wrong looking up your address. Please try again.",
      }));
    }
  }, []);

  const selectAddress = useCallback(async (addr: ICUKAddress) => {
    setState((s) => ({
      ...s,
      status: "checking-address",
      selectedAddress: addr,
      result: null,
      errorType: null,
      errorMessage: "",
    }));

    try {
      const { data, error } = await supabase.functions.invoke(
        "check-availability",
        { body: { address: addr } }
      );

      if (error) throw error;

      if (data?.available && data?.eligibleOcctaPlans?.length > 0) {
        const { recommendedPlan, upgradePlan } = computeRecommendation(
          data.primaryTechnology,
          data.maxDownload,
          data.eligibleOcctaPlans
        );
        const result: AvailabilityResult = {
          available: true,
          primaryTechnology: data.primaryTechnology,
          maxDownload: data.maxDownload,
          maxUpload: data.maxUpload,
          eligibleOcctaPlans: data.eligibleOcctaPlans,
          recommendedPlan,
          upgradePlan,
        };
        setState((s) => {
          const next = { ...s, status: "success" as AvailabilityStatus, result };
          saveToSession(next);
          return next;
        });
      } else {
        setState((s) => ({
          ...s,
          status: "error",
          errorType: "availability-failed",
          errorMessage:
            data?.message ||
            "We couldn't confirm availability online.",
        }));
      }
    } catch (err) {
      console.error("Availability check error:", err);
      setState((s) => ({
        ...s,
        status: "error",
        errorType: "backend-unavailable",
        errorMessage: "Something went wrong checking availability. Please try again.",
      }));
    }
  }, []);

  const reset = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setState(defaultState);
  }, []);

  return (
    <AvailabilityContext.Provider
      value={{ ...state, checkPostcode, selectAddress, reset }}
    >
      {children}
    </AvailabilityContext.Provider>
  );
}

export function useAvailability() {
  const ctx = useContext(AvailabilityContext);
  if (!ctx) throw new Error("useAvailability must be used within AvailabilityProvider");
  return ctx;
}
