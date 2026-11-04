"use client";

import { createContext, useContext } from "react";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: "admin" | "member";
}

interface SessionValue {
  /** True when Google sign-in + database are configured. Saving features need this. */
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
