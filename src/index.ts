import express from "express";
import dotenv from "dotenv";
dotenv.config();

import cors from "cors";

import connectDB from "./config/db";

const app = express();


const PORT = Number(process.env.PORT) || 3000;


import authRoutes from "./routes/authRoutes";
import organizationRoutes from "./routes/organizationRoutes";

const allowedOrigins = [
  'http://localhost:5173',
  'https://ai-sdlc-frontend-one.vercel.app',
  'https://ai-sdlc-frontend.vercel.app', // your real stable domain, once you confirm it
];
   const brokenVar: number = "this is a string";
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Allow any Vercel preview URL for this project during development
    if (origin && /^https:\/\/ai-sdlc-frontend.*\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }
    callback(null, false); // reject cleanly, no thrown error, no 500
  },
  credentials: true,
}));


app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/organizations", organizationRoutes);

app.get("/", (req, res) => {
  res.send("AI-SDLC backend running");
});

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

app.use((req, res) => {
  console.log(`UNMATCHED REQUEST: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ message: "No route matched (custom catch-all)" });
});



startServer();
