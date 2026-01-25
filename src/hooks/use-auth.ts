"use client";

import { useAuthContext } from "@/components/auth/auth-provider";

export function useAuth() {
  return useAuthContext();
}
