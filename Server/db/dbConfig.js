import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

// export const connectDB = async () => {
//     const connection_String = process.env.DB_URL;
//     try {
//         await mongoose.connect(connection_String);
//         console.log("MongoDB Connected Successfully");
//     } catch (error) {
//         console.error("Error Connecting with MongoDB:", error);
//     }
// };


let connectionPromise = null;
mongoose.connection.on("disconnected", () => {
  connectionPromise = null;
});

export async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectionPromise) return connectionPromise;
  if (!process.env.DB_URL) {
    throw new Error("DB_URL is not defined in environment variables.");
  }

  connectionPromise = mongoose
    .connect(process.env.DB_URL, {
      serverSelectionTimeoutMS: 10000,
    })
    .then((connection) => {
      console.log("MongoDB connected");
      return connection;
    })
    .catch((error) => {
      console.error("MongoDB connection error:", error.message);
      connectionPromise = null;
      throw error;
    });

  return connectionPromise;
}

export async function getDBConnection() {
  if (mongoose.connection.readyState !== 1) {
    return connectDB();
  }
  return mongoose.connection;
}