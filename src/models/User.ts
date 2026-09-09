import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  createdAt: Date;
}

const userSchema = new Schema<IUser>({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    select: false, // excludes password from query results by default — you have to explicitly ask for it (.select('+password')) when you need it, e.g. during login
  },
}, { timestamps: true }); // auto-adds createdAt and updatedAt

const User = mongoose.model<IUser>("User", userSchema);//"Create a model called User ....using userSchema."
// "This Mongoose model represents a User having the structure defined by IUser."
export default User;