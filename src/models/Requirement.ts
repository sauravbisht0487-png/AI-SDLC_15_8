import mongoose, { Schema, Document, Types } from "mongoose";

export interface IRequirement extends Document {
  title: string;
  description: string;
  project: Types.ObjectId;
  createdBy: Types.ObjectId;
  status: "draft" | "approved" | "in_progress" | "done";
  createdAt: Date;
  updatedAt: Date;
}

const requirementSchema = new Schema<IRequirement>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "approved", "in_progress", "done"],
      default: "draft",
    },
  },
  { timestamps: true }
);

export default mongoose.model<IRequirement>("Requirement", requirementSchema);