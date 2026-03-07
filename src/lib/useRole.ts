"use client";

import { useEffect, useState } from "react";
import type { Role } from "@/lib/rbac";

type UserPayload = {
  role: Role;
  name: string;
  email: string;
  id: string;
};

let cachedRole: Role | null = null;

function readRoleFromDom(): Role | null {
  if (typeof document === "undefined") return null;
  const container = document.querySelector("[data-vf-role]");
  const raw = container?.getAttribute("data-vf-role");
  if (raw === "owner" || raw === "admin" || raw === "member" || raw === "guest") return raw;
  return null;
}

export function useRole() {
  // Keep initial render deterministic between server and client.
  const [role, setRole] = useState<Role>(() => cachedRole ?? "member");

  useEffect(() => {
    const domRole = readRoleFromDom();
    if (domRole) {
      cachedRole = domRole;
      setRole(domRole);
      return;
    }

    if (cachedRole) {
      setRole(cachedRole);
      return;
    }

    let mounted = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { success?: boolean; data?: UserPayload | null } | null) => {
        if (!mounted || !data?.success || !data.data) return;
        cachedRole = data.data.role;
        setRole(data.data.role);
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  return role;
}
