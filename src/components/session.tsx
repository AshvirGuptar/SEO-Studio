"use client";

import { createContext, useContext } from "react";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: "admin" | "member" | "client";
  /** Signed in but not approved yet (only shown in the sidebar). */
  pending?: boolean;
}

interface SessionValue {
  /** True when accounts (database + BETTER_AUTH_SECRET) are configured. */
  authEnabled: boolean;
  user: SessionUser | null;
}

const SessionContext = createContext<SessionValue>({ authEnabled: false, user: null });

export function SessionProvider({ value, children }: { value: SessionValue; children: React.ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  return useContext(SessionContext);
}
