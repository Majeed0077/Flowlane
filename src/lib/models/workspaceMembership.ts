import mongoose, { Schema } from "mongoose";

const WorkspaceMembershipSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    workspaceId: { type: String, required: true, index: true },
    role: { type: String, enum: ["owner", "admin", "member", "guest", "editor"], required: true },
    isActive: { type: Boolean, default: true },
    invitedById: { type: String, default: "" },
  },
  { timestamps: true },
);

WorkspaceMembershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
WorkspaceMembershipSchema.index({ userId: 1, isActive: 1 });

export const WorkspaceMembershipModel =
  mongoose.models.WorkspaceMembership ||
  mongoose.model("WorkspaceMembership", WorkspaceMembershipSchema);
