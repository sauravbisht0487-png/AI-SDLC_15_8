import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User, { IUser } from "../models/User";

const generateToken = (userId: string): string => {
  const JWT_SECRET = process.env.JWT_SECRET as string;
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: "7d" });
};

export const signupUser = async (name: string, email: string, password: string) => {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error("Email already registered");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
  });

  const token = generateToken(user._id.toString());

  return { user, token };
};

export const loginUser = async (email: string, password: string) => {
  // password has select: false in schema, so we explicitly ask for it here
  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    throw new Error("Invalid email or password");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error("Invalid email or password");
  }

  const token = generateToken(user._id.toString());

  return { user, token };
};

// const generateToken = (userId: string): string => {
//   return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
// };0