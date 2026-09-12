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
  'http://localhost:5173',              // local dev
 'https://ai-sdlc-frontend-one.vercel.app',   // your actual Vercel URL
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // needed if you're sending cookies/auth headers
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
