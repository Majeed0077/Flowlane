export type Role = "owner" | "admin" | "member" | "guest";

export type Permission =
  | "contacts:create"
  | "contacts:edit"
  | "contacts:archive"
  | "contacts:restore"
  | "contacts:delete"
  | "projects:create"
  | "projects:edit"
  | "projects:archive"
  | "projects:restore"
  | "projects:delete"
  | "milestones:update"
  | "crm:move_stage"
  | "invoices:create"
  | "invoices:edit_draft"
  | "invoices:view_basic"
  | "invoices:view_amounts"
  | "invoices:archive"
  | "invoices:restore"
  | "invoices:mark_paid"
  | "invoices:delete"
  | "followups:update"
  | "finance:view_sensitive"
  | "system:reset"
  | "users:manage";

const allPermissions: Permission[] = [
  "contacts:create",
  "contacts:edit",
  "contacts:archive",
  "contacts:restore",
  "contacts:delete",
  "projects:create",
  "projects:edit",
  "projects:archive",
  "projects:restore",
  "projects:delete",
  "milestones:update",
  "crm:move_stage",
  "invoices:create",
  "invoices:edit_draft",
  "invoices:view_basic",
  "invoices:view_amounts",
  "invoices:archive",
  "invoices:restore",
  "invoices:mark_paid",
  "invoices:delete",
  "followups:update",
  "finance:view_sensitive",
  "system:reset",
  "users:manage",
];

export const rolePermissions: Record<Role, Permission[]> = {
  owner: allPermissions,
  admin: [
    "contacts:create",
    "contacts:edit",
    "contacts:archive",
    "contacts:restore",
    "projects:create",
    "projects:edit",
    "projects:archive",
    "projects:restore",
    "milestones:update",
    "crm:move_stage",
    "invoices:create",
    "invoices:edit_draft",
    "invoices:view_basic",
    "invoices:archive",
    "invoices:restore",
    "followups:update",
    "users:manage",
  ],
  member: [
    "contacts:create",
    "contacts:edit",
    "contacts:archive",
    "contacts:restore",
    "projects:create",
    "projects:edit",
    "projects:archive",
    "projects:restore",
    "milestones:update",
    "crm:move_stage",
    "invoices:create",
    "invoices:edit_draft",
    "invoices:view_basic",
    "invoices:archive",
    "invoices:restore",
    "followups:update",
  ],
  guest: ["invoices:view_basic"],
};

export function hasPermission(role: Role | null | undefined, permission: Permission) {
  if (!role) return false;
  if (role === "owner") return true;
  return rolePermissions[role].includes(permission);
}

export function isRole(value: string | undefined | null): value is Role {
  return value === "owner" || value === "admin" || value === "member" || value === "guest";
}

export function normalizeRole(value: string | undefined | null): Role {
  const role = value?.toLowerCase();
  if (role === "owner") return "owner";
  if (role === "admin") return "admin";
  if (role === "guest" || role === "viewer") return "guest";
  if (role === "editor") return "member";
  return "member";
}

export function toDisplayRole(role: Role): "Owner" | "Admin" | "Member" | "Guest" {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "guest") return "Guest";
  return "Member";
}

export function getRole(req: Request): Role {
  return normalizeRole(req.headers.get("x-user-role"));
}

export function sanitizeInvoiceForRole<T extends Record<string, unknown>>(invoice: T, role: Role) {
  if (role === "owner" || role === "admin") return invoice;
  const {
    amount,
    currency,
    paidDate,
    lineItems,
    payments,
    ...rest
  } = invoice;
  return rest;
}

export function assertCanWriteInvoiceFields(payload: Record<string, unknown>, role: Role) {
  if (role === "owner" || role === "admin") return;
  const blocked = ["amount", "currency", "paidDate", "lineItems", "payments", "status"];
  const hasBlocked = blocked.some((field) => field in payload);
  if (hasBlocked) {
    throw new Error("Your role cannot modify finance fields.");
  }
}

export function sanitizeProjectForRole<T extends Record<string, unknown>>(project: T, role: Role) {
  if (role === "owner" || role === "admin") return project;
  const { budgetAmount, currency, ...rest } = project;
  return rest;
}

export function assertCanWriteProjectFinanceFields(payload: Record<string, unknown>, role: Role) {
  if (role === "owner" || role === "admin") return;
  const blocked = ["budgetAmount", "currency", "budget"];
  const hasBlocked = blocked.some((field) => field in payload);
  if (hasBlocked) {
    throw new Error("Your role cannot modify budget fields.");
  }
}
