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

const ProjectCommentSchema = new Schema(
  {
    id: String,
    body: String,
    authorId: String,
    authorName: String,
    createdAt: String,
  },
  { _id: false },
);

const ProjectChecklistItemSchema = new Schema(
  {
    id: String,
    title: String,
    done: Boolean,
  },
  { _id: false },
);

const ProjectSchema = new Schema(
  {
    _id: { type: String, required: true },
    workspaceId: { type: String, required: true, index: true, default: "default" },
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
    logos: {
      type: [AttachmentSchema],
      default: [],
    },
    assigneeIds: {
      type: [String],
      default: [],
    },
    comments: {
      type: [ProjectCommentSchema],
      default: [],
    },
    checklist: {
      type: [ProjectChecklistItemSchema],
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

ProjectSchema.index({ workspaceId: 1, status: 1, archived: 1 });
ProjectSchema.index({ workspaceId: 1, contactId: 1 });
ProjectSchema.index({ workspaceId: 1, dueDate: 1 });
ProjectSchema.index({ workspaceId: 1, updatedAt: -1 });

if (mongoose.models.Project) {
  mongoose.deleteModel("Project");
}

export const ProjectModel =
  mongoose.models.Project || mongoose.model("Project", ProjectSchema);
