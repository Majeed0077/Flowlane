import bcrypt from "bcryptjs";
import type { User } from "@/types";

export const users: User[] = [
  {
    id: "u-001",
    name: "Flowlane Owner",
    email: "owner@example.com",
    passwordHash: bcrypt.hashSync("owner123", 10),
    role: "owner",
    active: true,
  },
  {
    id: "u-002",
    name: "Flowlane Editor",
    email: "editor@example.com",
    passwordHash: bcrypt.hashSync("editor123", 10),
    role: "editor",
    active: true,
  },
];
