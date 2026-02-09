import mongoose, { Schema } from "mongoose";

const ChatMessageSchema = new Schema(
  {
    _id: { type: String, required: true },
    entityType: { type: String, enum: ["contact", "project", "global"], required: true },
    entityId: { type: String, required: true },
    body: { type: String, required: true },
    senderId: { type: String, required: true },
    senderName: { type: String, required: true },
    senderRole: { type: String, required: true },
    createdAt: { type: String, required: true },
    pinnedAt: { type: String },
    readBy: { type: [String], default: [] },
  },
  { timestamps: false },
);

if (mongoose.models.ChatMessage) {
  mongoose.deleteModel("ChatMessage");
}

export const ChatMessageModel =
  mongoose.models.ChatMessage || mongoose.model("ChatMessage", ChatMessageSchema);
