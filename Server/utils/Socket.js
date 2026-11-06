import { Server as SocketIOServer } from "socket.io";
import { Cart } from "../db/models/CartModel.js";
import { Admin } from "../db/models/AdminModel.js";
import { User } from "../db/models/UserModel.js";
import BlockedCookies from "../db/models/BlockedCookies.js";
import mongoose from "mongoose"; // Import mongoose to validate ObjectId
import jwt from "jsonwebtoken";

let io; // Declare the io instance
export const adminSocketMap = new Map();
export const userSocketMap = new Map();

const setupSocket = (server) => {
  if (io) {
    // If io is already defined, return it without creating a new instance
    return io;
  }
  io = new SocketIOServer(server, {
    cors: {
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
      methods: ["GET", "POST", "PATCH"],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie || "";
      const token = cookieHeader
        .split(";")
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith("pds="))
        ?.slice(4);
      if (!token) return next(new Error("Authentication required"));

      const decoded = jwt.verify(decodeURIComponent(token), process.env.JWT_KEY);
      if (
        !decoded.userId ||
        !decoded.iat ||
        !mongoose.isValidObjectId(decoded.userId)
      ) {
        return next(new Error("Authentication required"));
      }
      if (await BlockedCookies.exists({ cookie: decodeURIComponent(token) })) {
        return next(new Error("Authentication required"));
      }

      const user = await User.findById(decoded.userId).select(
        "_id passwordChangedAt"
      );
      const admin = user
        ? null
        : await Admin.findById(decoded.userId).select("_id passwordChangedAt");
      if (!admin && !user) return next(new Error("Authentication required"));

      const account = user || admin;
      if (
        account.passwordChangedAt &&
        decoded.iat * 1000 < account.passwordChangedAt.getTime()
      ) {
        return next(new Error("Authentication required"));
      }

      socket.data.userId = decoded.userId;
      socket.data.role = user ? "user" : "admin";
      next();
    } catch (error) {
      console.error("Socket authentication failed:", error.message);
      next(new Error("Authentication required"));
    }
  });

  const disconnectUser = (socket) => {
    const userId = [...userSocketMap.entries()].find(
      ([key, value]) => value === socket.id
    )?.[0];
    if (userId) {
      userSocketMap.delete(userId);
      console.log(`User disconnected: ${userId}`);
    } else {
      const adminId = [...adminSocketMap.entries()].find(
        ([key, value]) => value === socket.id
      )?.[0];
      if (adminId) {
        adminSocketMap.delete(adminId);
        console.log(`Admin disconnected: ${adminId}`);
      }
    }
  };

  io.on("connection", async (socket) => {
    const userId = socket.data.userId;
    if (socket.data.role === "admin") {
      adminSocketMap.set(userId, socket.id);
      console.log(`Admin connected: ${userId} with socket ID: ${socket.id}`);
    } else {
      userSocketMap.set(userId, socket.id);
      console.log(`User connected: ${userId} with socket ID: ${socket.id}`);
    }

    socket.on("disconnect", () => {
      disconnectUser(socket);
    });

    socket.on("increase-quantity", async ({ pizzaId, index }, callback) => {
      try {
        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
          return callback({ status: "error", error: "Cart not found" });
        }
        if (index < 0 || index >= cart.items.length) {
          return callback({ status: "error", error: "Invalid index" });
        }
        const item = cart.items[index];
        if (item.pizza.toString() !== pizzaId) {
          return callback({ status: "error", error: "Pizza ID mismatch" });
        }
        if (item.quantity >= 10) {
          return callback({
            status: "error",
            error: "Maximum quantity reached",
          });
        }
        item.quantity += 1;
        item.finalPrice = item.price * item.quantity;
        await cart.save();
        callback({ status: "ok", data: { newQuantity: item.quantity } });
      } catch (error) {
        console.error(error.message);
        callback({ status: "error", error: "Internal Server Error" });
      }
    });

    socket.on("decrease-quantity", async ({ pizzaId, index }, callback) => {
      try {
        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
          return callback({ status: "error", error: "Cart not found" });
        }
        if (index < 0 || index >= cart.items.length) {
          return callback({ status: "error", error: "Invalid index" });
        }
        const item = cart.items[index];
        if (item.pizza.toString() !== pizzaId) {
          return callback({ status: "error", error: "Pizza ID mismatch" });
        }
        if (item.quantity <= 1) {
          return callback({
            status: "error",
            error: "Minimum quantity reached",
          });
        }
        item.quantity -= 1;
        item.finalPrice = item.price * item.quantity;
        await cart.save();
        callback({ status: "ok", data: { newQuantity: item.quantity } });
      } catch (error) {
        console.error(error.message);
        callback({ status: "error", error: "Internal Server Error" });
      }
    });
  });
};

export { setupSocket, io }; // Export both setupSocket and io
