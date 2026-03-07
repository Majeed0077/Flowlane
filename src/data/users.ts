import type { User } from "@/types";

// Legacy static users kept only for local fallback/testing.
// Runtime auth uses MongoDB users + JWT session.
export const users: User[] = [
  {
    id: "u-001",
    name: "ScopeBoard Owner",
    email: "owner@flowlane.local",
    passwordHash: "<seeded-in-db>",
    role: "owner",
    active: true,
  },
  {
    id: "u-002",
    name: "ScopeBoard Member",
    email: "member@flowlane.local",
    passwordHash: "<seeded-in-db>",
    role: "member",
    active: true,
  },
];
