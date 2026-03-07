import mongoose, { Schema } from "mongoose";

const TeamInviteSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, index: true },
    name: { type: String, default: "" },
    role: { type: String, enum: ["Owner", "Admin", "Member", "Guest", "Editor"], required: true },
    token: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "revoked", "expired"],
      default: "pending",
      index: true,
    },
    invitedById: { type: String, required: true },
    invitedByEmail: { type: String, required: true },
    workspaceId: { type: String, required: true, index: true, default: "default" },
    expiresAt: { type: Date, required: true, index: true },
    acceptedAt: { type: Date },
    acceptedUserId: { type: String },
  },
  { timestamps: true },
);

TeamInviteSchema.index({ workspaceId: 1, email: 1, status: 1 });
TeamInviteSchema.index({ workspaceId: 1, createdAt: -1 });

export const TeamInviteModel =
  mongoose.models.TeamInvite || mongoose.model("TeamInvite", TeamInviteSchema);
