import mongoose, { Schema, Document, Types } from "mongoose";

export interface IUserStory extends Document {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  requirement: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const userStorySchema = new Schema<IUserStory>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    acceptanceCriteria: { type: [String], default: [] },
    requirement: { type: Schema.Types.ObjectId, ref: "Requirement", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IUserStory>("UserStory", userStorySchema);