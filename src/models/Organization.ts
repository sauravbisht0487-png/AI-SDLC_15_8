import mongoose, { Schema, Document, Types } from "mongoose";

export interface IOrganization extends Document {
  name: string;
  owner: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model<IOrganization>("Organization", organizationSchema);