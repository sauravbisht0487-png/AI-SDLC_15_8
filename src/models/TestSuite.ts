import mongoose, { Schema, Document, Types } from "mongoose";

export interface ITestFile {
  filename: string;
  language: string;
  code: string;
}

export interface ITestSuite extends Document {
  generatedCode: Types.ObjectId;
  userStory: Types.ObjectId;
  framework: "vitest";
  files: ITestFile[];
  aiProvider: string;
  aiModel: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const testFileSchema = new Schema<ITestFile>(
  {
    filename: { type: String, required: true },
    language: { type: String, required: true },
    code: { type: String, required: true },
  },
  { _id: false },
);

const testSuiteSchema = new Schema<ITestSuite>(
  {
    generatedCode: { type: Schema.Types.ObjectId, ref: "GeneratedCode", required: true },
    userStory: { type: Schema.Types.ObjectId, ref: "UserStory", required: true },
    framework: { type: String, enum: ["vitest"], default: "vitest" },
    files: { type: [testFileSchema], required: true },
    aiProvider: { type: String, required: true },
    aiModel: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

// Main query: "latest test suite for this generated code"
testSuiteSchema.index({ generatedCode: 1, createdAt: -1 });

export default mongoose.model<ITestSuite>("TestSuite", testSuiteSchema);