import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, required: true },
    role: { type: String, enum: ["Owner", "Editor"], required: true },
    passwordHash: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    invoiceEmailTemplate: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
  },
  { timestamps: true },
);

export const UserModel =
  mongoose.models.User || mongoose.model("User", UserSchema);
