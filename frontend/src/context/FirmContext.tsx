/**
 * FirmContext — stub for dev mode.
 *
 * In dev mode (DEV_MODE=True on backend), the middleware auto-injects
 * the dev user/firm, so the frontend never needs to log in.
 *
 * When merging into fakturuj si: replace this context with fakturuj si's
 * ActiveFirmContext which provides the real firm ID from JWT.
 */
import React, { createContext, useContext } from "react";

interface FirmContextValue {
  /** Firm is always present in dev mode. Null = not yet resolved (merged mode). */
  firmId: string | null;
  firmName: string | null;
}

const FirmContext = createContext<FirmContextValue>({
  firmId: null,
  firmName: null,
});

export function FirmProvider({ children }: { children: React.ReactNode }) {
  // Dev mode: firm is injected by middleware; frontend doesn't need to know the ID
  // for API calls (all endpoints are already scoped by the backend via wh_firm).
  // We fetch it from the dashboard or a /me endpoint if needed for display.
  return (
    <FirmContext.Provider value={{ firmId: null, firmName: null }}>
      {children}
    </FirmContext.Provider>
  );
}

export const useFirm = () => useContext(FirmContext);
