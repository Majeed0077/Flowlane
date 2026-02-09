import mongoose, { Schema } from "mongoose";

const NotificationSchema = new Schema(
  {
    _id: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    type: { type: String, required: true },
    entityType: { type: String },
    entityId: { type: String },
    createdAt: { type: String, required: true },
    readBy: { type: [String], default: [] },
  },
  { timestamps: false },
);

export const NotificationModel =
  mongoose.models.Notification || mongoose.model("Notification", NotificationSchema);
