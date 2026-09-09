import mongoose, { Schema, Document, Types } from "mongoose";

interface ICodeFile {
  filename: string;
  language: string;
  code: string;
}

export interface IGeneratedCode extends Document {
  userStory: Types.ObjectId;
  files: ICodeFile[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const codeFileSchema = new Schema<ICodeFile>(
  {
    filename: { type: String, required: true },
    language: { type: String, required: true },
    code: { type: String, required: true },
  },
  { _id: false } // these are sub-documents, don't need their own _id
);

const generatedCodeSchema = new Schema<IGeneratedCode>(
  {
    userStory: { type: Schema.Types.ObjectId, ref: "UserStory", required: true },
    files: { type: [codeFileSchema], required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IGeneratedCode>("GeneratedCode", generatedCodeSchema);