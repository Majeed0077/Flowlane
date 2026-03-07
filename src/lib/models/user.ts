import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true },
    name: { type: String, required: true },
    role: { type: String, enum: ["Owner", "Admin", "Member", "Guest", "Editor"], required: true },
    passwordHash: { type: String, required: true },
    workspaceId: { type: String, required: true, index: true, default: "default" },
    tokenVersion: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, default: true },
    invoiceEmailTemplate: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
    timezone: { type: String, default: "UTC" },
    language: { type: String, default: "en" },
    defaultLandingPage: { type: String, enum: ["today", "dashboard"], default: "today" },
    compactMode: { type: Boolean, default: false },
    keyboardShortcuts: { type: Boolean, default: true },
    signature: { type: String, default: "" },
    notificationPrefs: {
      inviteEmail: { type: Boolean, default: true },
      inviteInApp: { type: Boolean, default: true },
      taskDueEmail: { type: Boolean, default: true },
      taskDueInApp: { type: Boolean, default: true },
      mentionEmail: { type: Boolean, default: true },
      mentionInApp: { type: Boolean, default: true },
      invoiceEmail: { type: Boolean, default: true },
      invoiceInApp: { type: Boolean, default: true },
    },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ workspaceId: 1, role: 1 });
UserSchema.index({ workspaceId: 1, isActive: 1 });

export const UserModel =
  mongoose.models.User || mongoose.model("User", UserSchema);
