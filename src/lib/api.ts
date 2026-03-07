import { apiFetch } from "@/lib/apiClient";
import type { Activity, Contact, Invoice, Project, Milestone, AdminSettings, Notification } from "@/types";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: unknown;
};

export type AuditEvent = {
  id: string;
  actorId?: string;
  actorRole?: string;
  actorEmail?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: string;
  createdAt: string;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Admin" | "Member" | "Guest";
  isActive: boolean;
  isDirect?: boolean;
  isSelf?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminInvite = {
  id: string;
  email: string;
  name?: string;
  role: "Owner" | "Admin" | "Member" | "Guest";
  status: "pending" | "accepted" | "revoked" | "expired";
  invitedByEmail: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string | null;
  acceptedUserId?: string | null;
  inviteUrl: string;
};

export type WorkspaceInfo = {
  id: string;
  name: string;
  logoUrl?: string;
  role: "owner" | "admin" | "member" | "guest";
  isPersonal: boolean;
  isActive: boolean;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch<ApiResponse<T>>(path, {
    ...options,
    headers: {
      ...(options?.headers ?? {}),
    },
  });

  if (!response.success) {
    throw new Error(String(response.error ?? "Request failed"));
  }

  return response.data as T;
}

export const api = {
  getContacts: () => request<Contact[]>("/api/contacts"),
  getProjects: () => request<Project[]>("/api/projects"),
  getMilestones: () => request<Milestone[]>("/api/milestones"),
  getInvoices: () => request<Invoice[]>("/api/invoices"),
  getActivities: () => request<Activity[]>("/api/activities"),

  createContact: (payload: Partial<Contact>) =>
    request<Contact>("/api/contacts", { method: "POST", body: JSON.stringify(payload) }),
  updateContact: (id: string, payload: Partial<Contact>) =>
    request<Contact>(`/api/contacts/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteContact: (id: string) => request<{ id: string }>(`/api/contacts/${id}`, { method: "DELETE" }),

  createProject: (payload: Partial<Project>) =>
    request<Project>("/api/projects", { method: "POST", body: JSON.stringify(payload) }),
  updateProject: (id: string, payload: Partial<Project>) =>
    request<Project>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteProject: (id: string) => request<{ id: string }>(`/api/projects/${id}`, { method: "DELETE" }),

  createMilestone: (payload: Partial<Milestone>) =>
    request<Milestone>("/api/milestones", { method: "POST", body: JSON.stringify(payload) }),
  updateMilestone: (id: string, payload: Partial<Milestone>) =>
    request<Milestone>(`/api/milestones/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteMilestone: (id: string) => request<{ id: string }>(`/api/milestones/${id}`, { method: "DELETE" }),

  createInvoice: (payload: Partial<Invoice>) =>
    request<Invoice>("/api/invoices", { method: "POST", body: JSON.stringify(payload) }),
  updateInvoice: (id: string, payload: Partial<Invoice>) =>
    request<Invoice>(`/api/invoices/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteInvoice: (id: string) => request<{ id: string }>(`/api/invoices/${id}`, { method: "DELETE" }),

  createActivity: (payload: Partial<Activity>) =>
    request<Activity>("/api/activities", { method: "POST", body: JSON.stringify(payload) }),

  getAudit: () => request<AuditEvent[]>("/api/audit"),
  createAudit: (payload: Partial<AuditEvent>) =>
    request<AuditEvent>("/api/audit", { method: "POST", body: JSON.stringify(payload) }),

  getUsers: () => request<AdminUser[]>("/api/admin/users"),
  createUser: (payload: { name: string; email: string; role: "Owner" | "Admin" | "Member" | "Guest"; password: string }) =>
    request<AdminUser>("/api/admin/users", { method: "POST", body: JSON.stringify(payload) }),
  updateUser: (id: string, payload: Partial<AdminUser> & { password?: string }) =>
    request<AdminUser>(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  removeUserFromWorkspace: (id: string) =>
    request<{ id: string }>(`/api/admin/users/${id}`, { method: "DELETE" }),

  getInvites: () => request<AdminInvite[]>("/api/admin/invites"),
  createInvite: (payload: { name?: string; email: string; role: "Owner" | "Admin" | "Member" | "Guest" }) =>
    request<AdminInvite>("/api/admin/invites", { method: "POST", body: JSON.stringify(payload) }),
  revokeInvite: (id: string) =>
    request<{ id: string; status: string }>(`/api/admin/invites/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "revoked" }),
    }),

  getSettings: () => request<AdminSettings>("/api/admin/settings"),
  updateSettings: (payload: AdminSettings) =>
    request<AdminSettings>("/api/admin/settings", { method: "PUT", body: JSON.stringify(payload) }),

  exportBackup: () => request<unknown>("/api/admin/backup/export"),
  importBackup: (payload: unknown) =>
    request<unknown>("/api/admin/backup/import", { method: "POST", body: JSON.stringify(payload) }),

  getEmailTemplate: () => request<{ template: string }>("/api/users/me/template"),
  saveEmailTemplate: (template: string) =>
    request<{ template: string }>("/api/users/me/template", {
      method: "PUT",
      body: JSON.stringify({ template }),
    }),

  getNotifications: () => request<{ items: Notification[]; unread: number }>("/api/notifications"),
  createNotification: (payload: {
    title: string;
    body: string;
    type: string;
    entityType?: string;
    entityId?: string;
  }) => request<Notification>("/api/notifications", { method: "POST", body: JSON.stringify(payload) }),
  markNotificationsRead: () => request<{ ok: true }>("/api/notifications/mark-read", { method: "POST" }),

  getWorkspaces: () => request<WorkspaceInfo[]>("/api/workspaces"),
  deleteWorkspace: (id: string) =>
    request<{ id: string; switchedWorkspaceId: string }>(`/api/workspaces/${id}`, { method: "DELETE" }),
  updateWorkspace: (id: string, payload: { name?: string; logoUrl?: string }) =>
    request<{ id: string; name: string; logoUrl?: string }>(`/api/workspaces/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
};


