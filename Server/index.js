import express from "express";
import dotenv from "dotenv";
import { connectDB, getDBConnection } from "./db/dbConfig.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import AdminRouter from "./Routes/Admin/AdminRoutes.js";
import UserRouter from "./Routes/User/UserRoutes.js";
import { getUserInfo, verifyToken } from "./Middlewares/AuthMiddleware.js";
import http from "http";
import { setupSocket } from "./utils/Socket.js";

dotenv.config();

connectDB().catch((error) => {
  console.error("Initial MongoDB connection failed; API requests will retry:", error.message);
});
const port = process.env.PORT || 3000;
const app = express();

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());

// Cors for cross connection between frontend and backend.
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = process.env.CLIENT_URLS
        ? process.env.CLIENT_URLS.split(",").map((url) => url.trim())
        : []; // Handle undefined or improperly formatted CLIENT_URLS

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE"],
  })
);
app.use("/pizza-image", express.static("uploads"));

// Middleware to verify Database Connection
// This middleware will run for every request to the API
app.use("/api/v1",async (req, res, next) => {
  try {
    await getDBConnection();
    return next();
  } catch (error) {
    console.error("Database unavailable for API request:", error.message);
    return res.status(503).json({
      message: "The service is temporarily unavailable. Please retry shortly.",
    });
  }
});

app.get("/api/v1/auth/get-user-info", verifyToken, getUserInfo);

app.use("/api/v1/admin/", AdminRouter);
app.use("/api/v1/user/", UserRouter);

app.get("/", (req, res, next) => {
  res.send("Hello World");
  next();
});

export const server = http.createServer(app);

server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});


setupSocket(server);

export default app;