import mongoose from "mongoose";
import { sendEmailToAdmins } from "../../Services/EmailService.js";
import { io } from "../../utils/Socket.js"; // Import the socket instance

const inventorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    category: {
      type: String,
      enum: ["cheese", "sauce", "base", "topping", "baseSize"],
      required: true,
    },
    type: {
      type: String,
      enum: ["veg", "non-veg"],
      required: true,
    },
    price: { type: Number, required: true, min: 0 },
    stock: {
      type: Number,
      required: true,
      min: [0, "Stock cannot be below 0"],
      validate: Number.isInteger,
    },
    threshold: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
    },
    status: {
      type: String,
      enum: ["available", "out of stock"],
      default: "available",
    },
  },
  { timestamps: true }
);

// Whenever the stock is updated, the status will be updated as well
inventorySchema.pre("save", function (next) {
  this.status = this.stock <= 0 ? "out of stock" : "available";
  next();
});


inventorySchema.post("save", async function (doc, next) {
  try {
    const Pizza = mongoose.model("Pizza");
    const affectedPizzas = await Pizza.find({
      $or: [
        { base: doc._id },
        { sauce: doc._id },
        { cheese: doc._id },
        { toppings: doc._id },
      ],
    }).populate("base sauce cheese toppings");
    const bulkOps = affectedPizzas.map((pizza) => {
      const ingredients = [
        pizza.base,
        ...(pizza.sauce || []),
        ...(pizza.cheese || []),
        ...(pizza.toppings || []),
      ];
      const available =
        ingredients.length > 0 &&
        ingredients.every((ingredient) => ingredient && ingredient.stock > 0);
      return {
        updateOne: {
          filter: { _id: pizza._id },
          update: { $set: { status: available ? "available" : "unavailable" } },
        },
      };
    });
    if (bulkOps.length > 0) {
      await Pizza.bulkWrite(bulkOps);
    }

    // Check if stock is below the threshold
    if (doc.stock > 0 && doc.stock <= doc.threshold) {
      // Send email to admins
      const lowStockItem = {
        name: doc.name,
        category: doc.category,
        stock: doc.stock,
        threshold: doc.threshold,
      };

      const emailResult = await sendEmailToAdmins({
        subject: "Low Stock Alert",
        message: `The following item is running low on stock:\n\n${JSON.stringify(
          lowStockItem,
          null,
          2
        )}`,
      });

      if (!emailResult) {
        console.warn(`No recipients defined for low stock alert email for item '${doc.name}'`);
      }

      // Emit socket event to admins
      if (io.adminSocketMap && typeof io.adminSocketMap.values === "function") {
        const adminSocketIds = [...io.adminSocketMap.values()]; // Get all admin socket IDs
        adminSocketIds.forEach((socketId) => {
          io.to(socketId).emit("lowStockAlert", lowStockItem);
        });
      } else {
        console.warn("Socket map is not initialized or invalid");
      }
    }

    next();
  } catch (error) {
    console.error("Error in inventory post-save middleware:", error);
    next(error);
  }
});

inventorySchema.post("findOneAndUpdate", async function (doc, next) {
  try {
    if (doc && doc.stock <= doc.threshold) {
      // Send email to admins
      const lowStockItem = {
        name: doc.name,
        category: doc.category,
        stock: doc.stock,
        threshold: doc.threshold,
      };

      const emailResult = await sendEmailToAdmins({
        subject: "Low Stock Alert",
        message: `The following item is running low on stock:\n\n${JSON.stringify(
          lowStockItem,
          null,
          2
        )}`,
      });
      if (!emailResult) {
        console.warn(`No recipients defined for low stock alert email for item '${doc.name}'`);
      }
    }

    next();
  } catch (error) {
    console.error("Error in inventory post-update middleware:", error);
    next(error);
  }
});

export const Inventory = mongoose.model("Inventory", inventorySchema);
