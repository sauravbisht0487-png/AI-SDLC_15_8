import mongoose, { Schema, Document, Types } from "mongoose";

export interface IProject extends Document {
  name: string;
  description?: string;
  organization: Types.ObjectId;
  createdBy: Types.ObjectId;
  githubRepoName?: string;
  githubRepoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    organization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
      githubRepoName: { type: String },
    githubRepoUrl: { type: String },
  },
  { timestamps: true }
);


export default mongoose.model<IProject>("Project", projectSchema);