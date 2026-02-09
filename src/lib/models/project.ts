import mongoose, { Schema } from "mongoose";

const AttachmentSchema = new Schema(
  {
    id: String,
    name: String,
    url: String,
    type: String,
    size: Number,
  },
  { _id: false },
);

const ProjectSchema = new Schema(
  {
    _id: { type: String, required: true },
    contactId: { type: String, required: false, default: undefined },
    clientName: { type: String },
    title: { type: String, required: true },
    name: { type: String },
    status: { type: String, default: "planning" },
    pipelineStage: { type: String },
    notes: { type: String },
    attachments: {
      type: [AttachmentSchema],
      default: [],
    },
    startDate: { type: String },
    dueDate: { type: String },
    budgetAmount: { type: Number, default: 0 },
    currency: { type: String, default: "USD" },
    links: { type: [String], default: [] },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

if (mongoose.models.Project) {
  mongoose.deleteModel("Project");
}

export const ProjectModel =
  mongoose.models.Project || mongoose.model("Project", ProjectSchema);
