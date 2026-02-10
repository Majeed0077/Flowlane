import mongoose, { Schema } from "mongoose";

const SettingsSchema = new Schema(
  {
    _id: { type: String, required: true },
    orgName: { type: String, default: "Flowlane" },
    timezone: { type: String, default: "UTC" },
    logoUrl: { type: String, default: "" },
    updatedAt: { type: String, required: true },
  },
  { timestamps: false },
);

export const SettingsModel =
  mongoose.models.Settings || mongoose.model("Settings", SettingsSchema);
