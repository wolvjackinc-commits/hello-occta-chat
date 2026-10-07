import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──

export interface AvailabilityAddress {
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
  | "fallback"
  | "error";

export interface AvailabilityResult {
  available: boolean;
  networkValidationPending: boolean;
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
  addresses: AvailabilityAddress[];
  selectedAddress: AvailabilityAddress | null;
  result: AvailabilityResult | null;
  errorType: AvailabilityErrorType | null;
  errorMessage: string;
}

interface AvailabilityActions {
  checkPostcode: (pc: string) => Promise<void>;
  selectAddress: (addr: AvailabilityAddress) => Promise<void>;
  triggerFallback: (pc?: string) => void;
  reset: () => void;
}

type AvailabilityContextValue = AvailabilityState & AvailabilityActions;

const SESSION_KEY = "occta_availability";
const ADDRESS_LOOKUP_TIMEOUT_MS = 3000;
const ADDRESS_LOOKUP_TIMEOUT = "address_lookup_timeout";

// ── Postcode validation ──

function isValidPostcode(pc: string): boolean {
  return /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i.test(pc.trim());
}

function isPostcodeOnlyAddress(addr: AvailabilityAddress): boolean {
  if (addr.source === "postcode_only") return true;
  const formatted = typeof addr.formatted_address === "string" ? addr.formatted_address : "";
  return /^use this postcode\s*\(/i.test(formatted.trim());
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => reject(new Error(ADDRESS_LOOKUP_TIMEOUT)), ms);
    promise.then(
      (value) => {
        globalThis.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        globalThis.clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

// ── Address label helper ──

export function getAddressLabel(addr: AvailabilityAddress): string {
  if (typeof addr.formatted_address === "string" && addr.formatted_address.length > 0) {
    return addr.formatted_address;
  }
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

export function getShortAddress(addr: AvailabilityAddress): string {
  if (typeof addr.formatted_address === "string" && addr.formatted_address.length > 0) {
    return addr.formatted_address;
  }
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
  } catch { /* session storage unavailable */ }
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
  } catch { /* session storage unavailable */ }
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
      // Do not let a slow provider leave the homepage spinner hanging. The
      // underlying request may finish later, but this customer interaction can
      // move straight to the full-address search instead.
      const { data, error } = await withTimeout(
        supabase.functions.invoke("check-address", {
          body: { postcode: trimmed },
        }),
        ADDRESS_LOOKUP_TIMEOUT_MS
      );

      if (error) throw error;

      const addresses = Array.isArray(data?.addresses)
        ? (data.addresses as AvailabilityAddress[]).filter((addr) => !isPostcodeOnlyAddress(addr))
        : [];

      if (addresses.length === 0) {
        setState((s) => ({
          ...s,
          status: "error",
          addresses: [],
          errorType: "no-addresses",
          errorMessage: "We couldn't list individual properties for that postcode. Search for your full address instead.",
        }));
        return;
      }

      setState((s) => ({
        ...s,
        status: "addresses",
        addresses,
      }));
    } catch (err) {
      console.error("Address lookup error:", err);
      const timedOut = err instanceof Error && err.message === ADDRESS_LOOKUP_TIMEOUT;
      setState((s) => ({
        ...s,
        status: "error",
        addresses: [],
        errorType: timedOut ? "no-addresses" : "backend-unavailable",
        errorMessage: timedOut
          ? "The postcode list is taking longer than expected. Search for your full address instead."
          : "Something went wrong looking up your address. Search for your full address instead.",
      }));
    }
  }, []);

  const selectAddress = useCallback(async (addr: AvailabilityAddress) => {
    // Address selection is deliberately supplier-neutral. We let customers
    // browse OCCTA's public retail bands immediately, then validate exact
    // network availability and contractual speeds before any agreement is
    // issued for acceptance.
    const result: AvailabilityResult = {
      available: false,
      networkValidationPending: true,
      primaryTechnology: "",
      maxDownload: 0,
      maxUpload: 0,
      eligibleOcctaPlans: ["essential", "superfast", "ultrafast"],
      recommendedPlan: "",
      message: "Address saved. Exact network availability and contractual speeds will be validated before you are asked to accept an agreement.",
    };
    setState((s) => {
      const next = {
        ...s,
        status: "success" as AvailabilityStatus,
        selectedAddress: addr,
        result,
        errorType: null,
        errorMessage: "",
      };
      saveToSession(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setState(defaultState);
  }, []);

  const triggerFallback = useCallback((pc?: string) => {
    setState((s) => ({
      ...s,
      status: "fallback",
      postcode: pc || s.postcode,
      errorType: null,
      errorMessage: "",
    }));
  }, []);

  return (
    <AvailabilityContext.Provider
      value={{ ...state, checkPostcode, selectAddress, reset, triggerFallback }}
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
