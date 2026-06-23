import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import notificationRoutes from "./routes/notificationRoutes.js";
import {Log} from "./utils/logger.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000; // backend running port no.

app.use(cors()); // allows form all origins
app.use(express.json());

app.use("/api/notifications", notificationRoutes);

// test api
app.get("/", (req, res) => {
  res.json({ message: "Notification API running" });
});

app.use((err, req, res, next) => {
  Log("backend", "error", "handler", `Unhandled error: ${err.message}`);
  res.status(500).json({success: false,error: "Something went wrong"});
});

app.listen(PORT, async () => {
  await Log("backend", "info", "config", `Server Running on port ${PORT}`);
  console.log(`Server running on port ${PORT}`);
});

export default app;