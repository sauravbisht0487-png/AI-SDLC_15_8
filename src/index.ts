import express from "express";
import dotenv from "dotenv";
dotenv.config();

import cors from "cors";

import connectDB from "./config/db";

const app = express();


const PORT = Number(process.env.PORT) || 3000;





import authRoutes from "./routes/authRoutes";
import organizationRoutes from "./routes/organizationRoutes";

app.use(cors({
  origin: "http://localhost:5173", // my Vite dev server
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
