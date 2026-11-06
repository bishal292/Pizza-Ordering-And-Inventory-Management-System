import mongoose from "mongoose";
import DailyOrderSequence from "./DailyOrderSequence.js";

const inventoryMovementSchema = new mongoose.Schema(
  {
    inventoryItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      required: true,
    },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [
      {
        pizza: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Pizza",
          required: true,
        },
        customizations: {
          base: { type: mongoose.Schema.Types.ObjectId, ref: "Inventory" },
          sauce: [{ type: mongoose.Schema.Types.ObjectId, ref: "Inventory" }],
          cheese: [{ type: mongoose.Schema.Types.ObjectId, ref: "Inventory" }],
          toppings: [
            { type: mongoose.Schema.Types.ObjectId, ref: "Inventory" },
          ],
        },
        pizzaSnapshot: {
          pizzaId: String,
          name: String,
          image: String,
          description: String,
          size: { name: String },
          base: { name: String },
          sauce: [{ name: String }],
          cheese: [{ name: String }],
          toppings: [{ name: String }],
        },
        customizationsSnapshot: {
          base: { name: String },
          sauce: [{ name: String }],
          cheese: [{ name: String }],
          toppings: [{ name: String }],
        },
        quantity: { type: Number, required: true, default: 1 },
        price: { type: Number, required: true }, // Price based on the pizza and customizations
        finalPrice: {
          type: Number,
          required: true,
          default: function () {
            return this.price * this.quantity;
          },
        },
      },
    ],
    totalPrice: { type: Number, required: true },
    orderId: { type: String, required: true, unique: true },
    paymentId: { type: String }, // Removed `unique` constraint
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "refund_pending", "refunded"],
      default: "unpaid",
    },
    refundId: { type: String },
    paidAt: { type: Date },
    refundedAt: { type: Date },
    inventoryMovements: {
      type: [inventoryMovementSchema],
      default: undefined,
    },
    stockReserved: { type: Boolean, select: false },
    status: {
      type: String,
      enum: [
        "pending",
        "placed",
        "preparing",
        "prepared",
        "completed",
        "cancelled",
      ],
      default: "pending",
    },
    isStockDecrement: { type: Boolean, default: false, select: false },
    tableNo: { type: Number, required: true },
    dailyOrderId: { type: Number, required: true, unique: true },
  },
  { timestamps: true }
);

orderSchema.statics.generateDailyOrderId = async function () {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = String(now.getFullYear()).slice(-2);
  const dateKey = `${year}${month}${day}`;
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const latestOrder = await this.findOne({
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  }).sort({ dailyOrderId: -1 });
  const datePrefix = `${day}${month}${year}`;
  const legacySequence = latestOrder
    ? Number(String(latestOrder.dailyOrderId).slice(datePrefix.length)) || 0
    : 0;
  try {
    await DailyOrderSequence.updateOne(
      { _id: dateKey },
      { $setOnInsert: { sequence: legacySequence } },
      { upsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  await DailyOrderSequence.updateOne(
    { _id: dateKey },
    { $max: { sequence: legacySequence } }
  );
  const sequence = await DailyOrderSequence.findOneAndUpdate(
    { _id: dateKey },
    { $inc: { sequence: 1 } },
    { new: true }
  );
  return Number(`${day}${month}${year}${String(sequence.sequence).padStart(4, "0")}`);
};

export const Order = mongoose.model("Order", orderSchema);
