import { z } from "zod";

export const contactCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  company: z.string().optional().or(z.literal("")),
  source: z.string().optional(),
  sourceLabel: z.string().optional(),
  stage: z.string().optional(),
  nextFollowUpAt: z.string().optional(),
  followUpCadence: z.enum(["none", "weekly", "monthly", "custom"]).optional(),
  followUpIntervalDays: z.number().optional(),
  tags: z.array(z.string()).optional(),
  notes: z
    .array(
      z.object({
        id: z.string(),
        body: z.string(),
        createdAt: z.string(),
      }),
    )
    .optional(),
  archived: z.boolean().optional(),
});

export const contactUpdateSchema = contactCreateSchema.partial();

export const projectCreateSchema = z.object({
  title: z.string().min(1),
  name: z.string().optional(),
  contactId: z.string().min(1).optional(),
  clientName: z.string().optional(),
  status: z.string().optional(),
  pipelineStage: z.string().optional(),
  notes: z.string().optional(),
  attachments: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1),
        url: z.string().min(1),
        type: z.string().optional().default(""),
        size: z.number().nonnegative(),
      }),
    )
    .optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  budgetAmount: z.number().optional(),
  currency: z.string().optional(),
  links: z.array(z.string().url()).optional(),
  archived: z.boolean().optional(),
});

export const projectUpdateSchema = projectCreateSchema.partial();
export const projectUpdateWithRemovalsSchema = projectUpdateSchema.extend({
  removeAttachmentUrls: z.array(z.string().min(1)).optional(),
});

export const invoiceCreateSchema = z.object({
  invoiceNo: z.string().min(1),
  projectId: z.string().min(1),
  contactId: z.string().min(1),
  status: z.string().optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  paidDate: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  lineItems: z
    .array(
      z.object({
        title: z.string(),
        qty: z.number(),
        rate: z.number(),
      }),
    )
    .optional(),
  payments: z
    .array(
      z.object({
        amount: z.number(),
        method: z.string(),
        paidAt: z.string(),
        note: z.string().optional(),
      }),
    )
    .optional(),
  archived: z.boolean().optional(),
});

export const invoiceUpdateSchema = invoiceCreateSchema.partial();

export const activityCreateSchema = z.object({
  entityType: z.enum(["contact", "project", "invoice", "milestone"]),
  entityId: z.string().min(1),
  action: z.string().min(1),
  message: z.string().optional(),
  userRole: z.string().optional(),
});

export const activityUpdateSchema = activityCreateSchema.partial();

export const milestoneCreateSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  status: z.string().optional(),
  dueDate: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  order: z.number().optional(),
});

export const milestoneUpdateSchema = milestoneCreateSchema.partial();

export const auditCreateSchema = z.object({
  action: z.string().min(1),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  meta: z.string().optional(),
});

export const adminUserCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["Owner", "Editor"]),
  password: z.string().min(8),
});

export const adminUserUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["Owner", "Editor"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

export const adminSettingsSchema = z.object({
  orgName: z.string().min(1),
  timezone: z.string().min(1),
  logoUrl: z.string().optional(),
});

export const userProfileUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  avatarUrl: z.string().min(1).optional().or(z.literal("")),
});
