import { isValidObjectId } from "mongoose";
import { Admin } from "../../db/models/AdminModel.js";
import { Inventory } from "../../db/models/InventoryModel.js";
import { Pizza } from "../../db/models/PizzaModels.js";
import { User } from "../../db/models/UserModel.js";
import { Cart } from "../../db/models/CartModel.js";
import { Order } from "../../db/models/Orders.js";
import { deleteImage, upload } from "../../Services/ImageStorage.js";
import { getFormattedCartItems } from "../../utils/cart-formatting.js";
import { compare } from "bcrypt";
import {
  cancelOrderAndReleaseInventory,
  formatOrderWithSnapshots,
  markOrderRefunded,
  notifyOrderStatus,
  updateOrderPaymentStatus,
} from "../../Services/OrderWorkflowService.js";
import {
  findCapturedPayment,
  refundOrder,
} from "../../Services/RazorPay.js";

const revenueOrderMatch = {
  $and: [
    {
      $or: [
        { status: { $in: ["placed", "preparing", "prepared", "completed"] } },
        { paymentStatus: "refund_pending" },
      ],
    },
    { paymentStatus: { $ne: "refunded" } },
  ],
};

async function validateInventoryItems(items, category) {
  if (!Array.isArray(items) || !items.every(isValidObjectId)) return false;
  const distinctIds = new Set(items.map(String));
  if (distinctIds.size === 0) return true;
  const matches = await Inventory.find({
    _id: { $in: [...distinctIds] },
    category,
  }).select("_id");
  return matches.length === distinctIds.size;
}

function isValidNumericInput(value) {
  return (
    (typeof value === "number" ||
      (typeof value === "string" && value.trim() !== "")) &&
    Number.isFinite(Number(value))
  );
}

async function hasPizzaOrderHistory(pizzaId) {
  const id = pizzaId.toString();
  return Boolean(
    await Order.collection.findOne(
      {
        $or: [
          { "items.pizza": { $in: [pizzaId, id] } },
          { "items.pizza._id": { $in: [pizzaId, id] } },
          { "items.pizzaId": { $in: [pizzaId, id] } },
          { "items.pizzaSnapshot.pizzaId": id },
        ],
      },
      { projection: { _id: 1 } }
    )
  );
}

// Admin Dashboard
export const dashboard = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const startOfNextDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const [
      totalPizzas,
      totalOrders,
      totalUser,
      lowStock,
      todayOrderCancelled,
      todayOrderCount,
      revenue,
      lowStockItems,
      recentOrders,
    ] = await Promise.all([
      Pizza.countDocuments(),
      Order.countDocuments(),
      User.countDocuments(),
      Inventory.countDocuments({
        $expr: { $lte: ["$stock", "$threshold"] },
      }),
      Order.countDocuments({
        status: "cancelled",
        createdAt: { $gte: startOfDay, $lt: startOfNextDay },
      }),
      Order.countDocuments({
        createdAt: { $gte: startOfDay, $lt: startOfNextDay },
      }),
      Order.aggregate([
        { $addFields: { revenueDate: { $ifNull: ["$paidAt", "$createdAt"] } } },
        { $match: revenueOrderMatch },
        {
          $group: {
            _id: null,
            total: { $sum: "$totalPrice" },
            today: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ["$revenueDate", startOfDay] },
                      { $lt: ["$revenueDate", startOfNextDay] },
                    ],
                  },
                  "$totalPrice",
                  0,
                ],
              },
            },
          },
        },
      ]),
      Inventory.find({ $expr: { $lte: ["$stock", "$threshold"] } })
        .sort({ stock: 1, name: 1 })
        .limit(6)
        .select("name category stock threshold"),
      Order.find()
        .sort({ createdAt: -1 })
        .limit(6)
        .select("dailyOrderId totalPrice status paymentStatus createdAt userId")
        .populate("userId", "name"),
    ]);

    res.status(200).json({
      "Total Orders": totalOrders,
      "Today's Orders": todayOrderCount,
      "Total Revenue": revenue[0]?.total ?? 0,
      "Today's Revenue": revenue[0]?.today ?? 0,
      "Total Pizzas": totalPizzas,
      "Total Users": totalUser,
      "Out Of Stock Items": lowStock,
      "Today's Orders Cancelled": todayOrderCancelled,
      lowStockItems,
      recentOrders,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

export const revenueData = async (req, res, next) => {
  try {
    const now = new Date();
    const firstMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1)
    );
    const firstMonthAfterRange = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
    );
    const monthlyRevenue = await Order.aggregate([
      { $addFields: { revenueDate: { $ifNull: ["$paidAt", "$createdAt"] } } },
      {
        $match: {
          ...revenueOrderMatch,
          revenueDate: { $gte: firstMonth, $lt: firstMonthAfterRange },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$revenueDate" },
            month: { $month: "$revenueDate" },
          },
          revenue: { $sum: "$totalPrice" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);
    const valuesByMonth = new Map(
      monthlyRevenue.map((entry) => [
        `${entry._id.year}-${entry._id.month}`,
        { revenue: entry.revenue, orders: entry.orders },
      ])
    );
    const months = Array.from({ length: 12 }, (_, index) => {
      const monthDate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + index, 1)
      );
      const key = `${monthDate.getUTCFullYear()}-${monthDate.getUTCMonth() + 1}`;
      return {
        month: monthDate.toLocaleString("en-US", {
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }),
        ...(valuesByMonth.get(key) || { revenue: 0, orders: 0 }),
      };
    });
    res.status(200).json(months);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

export const orderData = async (req, res, next) => {
  try {
    const counts = await Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const result = {
      pending: 0,
      placed: 0,
      preparing: 0,
      prepared: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const { _id, count } of counts) {
      if (Object.hasOwn(result, _id)) result[_id] = count;
    }
    res.status(200).json(result);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

/**
  ----------------------------------------------------------------------------------------
  ---------------------------------- Inventory Management ----------------------------------
  ----------------------------------------------------------------------------------------
  */

export const inventory = async (req, res, next) => {
  try {
    const userId = req.userId;
    const admin = await Admin.findById(userId);
    if (!admin) return res.status(404).send("No Such Admin Found");
    const inventory = await Inventory.aggregate([
      {
        $addFields: {
          stockThresholdDifference: { $subtract: ["$stock", "$threshold"] },
        },
      },
      {
        $sort: { stockThresholdDifference: 1 },
      },
    ]);
    if (!inventory) {
      return res.status(404).send("Inventory is empty, add some products");
    }
    res.status(200).send(inventory);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

export const addProduct = async (req, res, next) => {
  try {
    const userId = req.userId;
    const admin = await Admin.findById(userId);
    if (!admin) return res.status(404).send("Your Admin Account is not found");
    const { name, category, type, price, stock, threshold } = req.body;
    if (
      typeof name !== "string" ||
      !name.trim() ||
      !category ||
      !type ||
      price === undefined ||
      stock === undefined ||
      threshold === undefined
    ) {
      return res.status(400).send("Please fill all fields");
    }
    const numericPrice = Number(price);
    const numericStock = Number(stock);
    const numericThreshold = Number(threshold);
    if (
      !isValidNumericInput(price) ||
      !Number.isFinite(numericPrice) ||
      numericPrice < 0 ||
      !isValidNumericInput(stock) ||
      !Number.isInteger(numericStock) ||
      numericStock < 0 ||
      !isValidNumericInput(threshold) ||
      !Number.isInteger(numericThreshold) ||
      numericThreshold < 0
    ) {
      return res.status(400).send("Price, stock, and threshold must be valid non-negative values");
    }
    const product = await Inventory.findOne({ name: name.trim() });
    if (product) {
      return res.status(400).send("Product already exists, try updating it");
    }
    if (
      !["cheese", "sauce", "base", "topping", "baseSize"].includes(category)
    ) {
      return res.status(400).send("Invalid Category");
    }
    if (!["veg", "non-veg"].includes(type)) {
      return res.status(400).send("Invalid Type");
    }

    const newProduct = new Inventory({
      name: name.trim(),
      category,
      type,
      price: numericPrice,
      stock: numericStock,
      threshold: numericThreshold,
    });
    const savedProduct = await newProduct.save();
    if (!savedProduct) {
      return res.status(500).send("Error saving product");
    }
    res
      .status(201)
      .json({ message: "Product added successfully", product: savedProduct });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const userId = req.userId;
    const admin = await Admin.findById(userId);
    if (!admin) return res.status(404).send("Your Admin Account is not found");
    const { id } = req.query;
    if (!id || !isValidObjectId(id)) {
      return res.status(400).send("Invalid Product ID");
    }

    const product = await Inventory.findById(id);
    if (!product) {
      return res.status(404).send("Product not found");
    }
    const { name, type, price, stock, threshold, category } = req.body;
    if (
      (Object.hasOwn(req.body, "category") && product.category !== category) ||
      (Object.hasOwn(req.body, "name") && product.name !== name)
    ) {
      return res.status(400).send("Name And Category cannot be updated");
    }
    const fields = ["type", "price", "stock", "threshold"];
    if (!fields.some((field) => Object.hasOwn(req.body, field))) {
      return res
        .status(400)
        .send(
          "Some fields are required to update among type, price, stock, threshold."
        );
    }

    if (Object.hasOwn(req.body, "type") && !["veg", "non-veg"].includes(type)) {
      return res.status(400).send("Invalid Type");
    }

    if (Object.hasOwn(req.body, "price")) {
      const numericPrice = Number(price);
      if (!isValidNumericInput(price) || !Number.isFinite(numericPrice) || numericPrice < 0) {
        return res.status(400).send("Price must be a non-negative number.");
      }
      product.price = numericPrice;
    }
    if (Object.hasOwn(req.body, "stock")) {
      const numericStock = Number(stock);
      if (!isValidNumericInput(stock) || !Number.isInteger(numericStock) || numericStock < 0) {
        return res.status(400).send("Stock must be a non-negative integer.");
      }
      product.stock = numericStock;
    }
    if (Object.hasOwn(req.body, "threshold")) {
      const numericThreshold = Number(threshold);
      if (!isValidNumericInput(threshold) || !Number.isInteger(numericThreshold) || numericThreshold < 0) {
        return res.status(400).send("Threshold must be a non-negative integer.");
      }
      product.threshold = numericThreshold;
    }
    if (Object.hasOwn(req.body, "type")) product.type = type;
    const updatedProduct = await product.save();
    res.status(200).json({
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const userId = req.userId;
    const admin = await Admin.findById(userId);
    if (!admin) return res.status(404).send("Your Admin Account is not found");
    const { id } = req.query;
    if (!id || !isValidObjectId(id)) {
      return res.status(400).send("Invalid Product ID");
    }

    const product = await Inventory.findById(id);
    if (!product) {
      return res.status(404).send("Product not found");
    }
    const referenced = await Promise.all([
      Pizza.exists({
        $or: [
          { base: product._id },
          { sauce: product._id },
          { cheese: product._id },
          { toppings: product._id },
          { size: product._id },
        ],
      }),
      Order.exists({
        $or: [
          { "items.customizations.base": product._id },
          { "items.customizations.sauce": product._id },
          { "items.customizations.cheese": product._id },
          { "items.customizations.toppings": product._id },
          { "inventoryMovements.inventoryItem": product._id },
        ],
      }),
    ]);
    if (referenced.some(Boolean)) {
      return res.status(409).send(
        "Inventory items referenced by pizzas or order history cannot be deleted."
      );
    }
    const deletedProduct = await Inventory.findByIdAndDelete(id);
    if (!deletedProduct) {
      return res.status(500).send("Error deleting product");
    }
    res.status(200).json({
      message: "Product deleted successfully",
      product: deletedProduct,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

/**
  ----------------------------------------------------------------------------------------
  ---------------------------------- Pizza Management ----------------------------------
  ----------------------------------------------------------------------------------------
  */

export const getPizzas = async (req, res, next) => {
  try {
    const userId = req.userId;
    const admin = await Admin.findById(userId);
    if (!admin) return res.status(404).send("No Such Admin Found");

    const pizzas = await Pizza.find()
      .populate("size", "name")
      .sort({ updatedAt: -1 });
    if (!pizzas) {
      return res.status(404).send("No Pizzas found");
    }
    res.status(200).send(pizzas);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

export const getPizzaDetails = async (req, res, next) => {
  try {
    const userId = req.userId;
    const admin = await Admin.findById(userId);
    if (!admin) return res.send("Your Admin account not found");
    const { id } = req.query;
    if (!id || !isValidObjectId(id)) {
      return res.status(400).send("Invalid Pizza ID");
    }

    const pizza = await Pizza.findById(id).populate(
      "base size sauce cheese toppings",
      "name"
    );
    if (!pizza) {
      return res.status(404).send("Pizza not found");
    }

    res.status(200).json({
      ...pizza.toObject(),
      hasOrderHistory: await hasPizzaOrderHistory(pizza._id),
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

export const imageUpload = async (req, res, next) => {
  try {
    const userId = req.userId;
    const admin = await Admin.findById(userId);
    if (!admin) return res.status(404).send("Your Admin Account is not found");
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }
    res.status(200).json({
      message: "Image uploaded successfully",
      imageUrl: req.file.filename,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};
export const addPizza = async (req, res) => {
  try {
    const userId = req.userId;
    const admin = await Admin.findById(userId);
    if (!admin) return res.status(404).send("Your Admin Account is not found");
    const {
      name,
      image,
      description,
      size: baseSize,
      base,
      sauce,
      cheese,
      toppings,
      price,
    } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof image !== "string" ||
      !image.trim() ||
      typeof description !== "string" ||
      !description.trim() ||
      !baseSize ||
      !base ||
      price === undefined ||
      price === null ||
      price === ""
    ) {
      return res
        .status(400)
        .send(
          "Please fill all required fields : name, image, description, size, base, price"
        );
    }
    const numericPrice = Number(price);
    if (!isValidNumericInput(price) || !Number.isFinite(numericPrice) || numericPrice <= 0) {
      return res.status(400).send("Price must be a positive number");
    }

    if (!(await validateInventoryItems([baseSize], "baseSize"))) {
      return res.status(400).send("Invalid Base");
    }
    if (!(await validateInventoryItems([base], "base"))) {
      return res.status(400).send("Invalid Base");
    }
    if (sauce !== undefined && !(await validateInventoryItems(sauce, "sauce"))) {
      return res.status(400).send("Invalid Sauce");
    }
    if (cheese !== undefined && !(await validateInventoryItems(cheese, "cheese"))) {
      return res.status(400).send("Invalid Cheese");
    }
    if (toppings !== undefined && !(await validateInventoryItems(toppings, "topping"))) {
      return res.status(400).send("Invalid Toppings");
    }

    // Check if pizza with same name and identical base already exists
    const existingPizza = await Pizza.findOne({ name, size: baseSize, base });

    if (existingPizza) {
      return res
        .status(400)
        .send(
          "Pizza with the same name and base already exists try updating it"
        );
    }

    const newPizza = new Pizza({
      name,
      image,
      description,
      size: baseSize,
      base,
      sauce,
      cheese,
      toppings,
      price: numericPrice,
    });
    const savedPizza = await newPizza.save();
    if (!savedPizza) {
      return res.status(500).send("Error saving pizza");
    }
    const pizza = await Pizza.findById(savedPizza._id).populate("size", "name");
    res.status(201).json({ message: "Pizza added successfully", pizza });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

export const updatePizza = async (req, res, next) => {
  try {
    const userId = req.userId;
    const admin = await Admin.findById(userId);
    if (!admin) return res.status(404).send("Your Admin Account is not found");
    const { id } = req.query;
    if (!id || !isValidObjectId(id)) {
      return res.status(400).send("Invalid Pizza ID");
    }

    const pizza = await Pizza.findById(id);
    if (!pizza) {
      return res.status(404).send("Pizza not found");
    }

    const {
      name,
      size,
      base,
      sauce,
      cheese,
      toppings,
      price,
      image,
      description,
    } = req.body;

    const editableFields = [
      "name",
      "size",
      "base",
      "sauce",
      "cheese",
      "toppings",
      "price",
      "image",
      "description",
    ];
    if (!editableFields.some((field) => Object.hasOwn(req.body, field))) {
      return res
        .status(400)
        .send("Some changes in any fields are required to perform updation");
    }

    if (
      ["name", "image", "description"].some(
        (field) =>
          Object.hasOwn(req.body, field) &&
          (typeof req.body[field] !== "string" || !req.body[field].trim())
      )
    ) {
      return res.status(400).send("Name, image, and description must be non-empty strings.");
    }
    const numericPrice = Object.hasOwn(req.body, "price")
      ? Number(price)
      : undefined;
    if (
      Object.hasOwn(req.body, "price") &&
      (!isValidNumericInput(price) || !Number.isFinite(numericPrice) || numericPrice <= 0)
    ) {
      return res.status(400).send("Price must be a positive number.");
    }

    if (Object.hasOwn(req.body, "size") && !(await validateInventoryItems([size], "baseSize"))) {
      return res.status(400).send("Invalid Base");
    }
    if (Object.hasOwn(req.body, "base") && !(await validateInventoryItems([base], "base"))) {
      return res.status(400).send("Invalid Base");
    }
    if (Object.hasOwn(req.body, "sauce") && !(await validateInventoryItems(sauce, "sauce"))) {
      return res.status(400).send("Invalid Sauce");
    }
    if (Object.hasOwn(req.body, "cheese") && !(await validateInventoryItems(cheese, "cheese"))) {
      return res.status(400).send("Invalid Cheese");
    }
    if (Object.hasOwn(req.body, "toppings") && !(await validateInventoryItems(toppings, "topping"))) {
      return res.status(400).send("Invalid Toppings");
    }

    const previousImage = pizza.image;
    for (const field of editableFields) {
      if (!Object.hasOwn(req.body, field)) continue;
      pizza[field] = field === "price" ? numericPrice : req.body[field];
    }
    const updatedPizza = await pizza.save();
    if (image && image !== previousImage) await deleteImage(previousImage);
    await updatedPizza.populate("size", "name");
    res
      .status(200)
      .json({ message: "Pizza updated successfully", pizza: updatedPizza });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

export const deletePizza = async (req, res, next) => {
  try {
    const userId = req.userId;
    const admin = await Admin.findById(userId);
    if (!admin) return res.status(404).send("Your Admin Account is not found");
    const { id } = req.query;
    if (!id || !isValidObjectId(id)) {
      return res.status(400).send("Invalid Pizza ID");
    }

    const pizza = await Pizza.findById(id);
    if (!pizza) {
      return res.status(404).send("Pizza not found");
    }
    if (await hasPizzaOrderHistory(pizza._id)) {
      return res.status(409).send(
        "This pizza is part of order history and cannot be deleted."
      );
    }
    const deletedPizza = await Pizza.findByIdAndDelete(id);
    if (!deletedPizza) {
      return res.status(500).send("Error deleting pizza");
    }
    await deleteImage(pizza.image);
    res
      .status(200)
      .json({ message: "Pizza deleted successfully", pizza: deletedPizza });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

/**
  ----------------------------------------------------------------------------------------
  ---------------------------------- User Management ----------------------------------
  ----------------------------------------------------------------------------------------
 */

export const getAllUsers = async (req, res, next) => {
  try {
    const userId = req.userId;
    const admin = await Admin.findById(userId);
    if (!admin) return res.status(404).send("No Such Admin Found");

    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 50;

    const users = await User.find().skip(skip).limit(limit);

    if (!users.length) {
      return res.status(200).json([]);
    }

    // Fetching additional details for each user
    const usersWithDetails = await Promise.all(
      users.map(async (user) => {
        const orders = await Order.find({ userId: user._id });
        const totalOrders = orders.length;
        const cart = await Cart.findOne({ user: user._id });

        return {
          id: user._id,
          name: user.name,
          email: user.email,
          totalOrder: totalOrders,
          cart: cart ? cart._id : null,
        };
      })
    );

    res.status(200).send(usersWithDetails);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

export const getUserCart = async (req, res, next) => {
  try {
    const userId = req.userId;
    const admin = await Admin.findById(userId);
    if (!admin) return res.status(404).send("No Such Admin Found");
    let { id } = req.query;
    if (!id || !isValidObjectId(id)) {
      return res.status(400).send("Invalid User ID");
    }
    const cart = await Cart.findById(id).populate("items.pizza");
    if (!cart) {
      return res.status(404).send("Cart not found");
    }
    const user = await User.findById(cart.user);
    const formattedCart = await getFormattedCartItems({ cart });
    res.status(200).json({
      _id: cart._id,
      userName: user.name,
      items: formattedCart,
      totalPrice: cart.totalPrice,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

export const getUserWithNameOrEmail = async (req, res, next) => {
  try {
    const userId = req.userId;
    const admin = await Admin.findById(userId);
    if (!admin) return res.status(404).send("No Such Admin Found");
    let { q: query } = req.query;
    query = query.trim();
    if (!query || query.length < 3) {
      return res.status(400).send("Invalid User Name");
    }
    const users = await User.find({
      $or: [
        { name: new RegExp(query, "i") },
        { email: new RegExp(query, "i") },
      ],
    });

    if (!users.length) {
      return res.status(404).send("No Users found");
    }

    const usersWithDetails = await Promise.all(
      users.map(async (user) => {
        const orders = await Order.find({ userId: user._id });
        const totalOrders = orders.length;
        const cart = await Cart.findOne({ user: user._id });

        return {
          id: user._id,
          name: user.name,
          email: user.email,
          totalOrder: totalOrders,
          cart: cart ? cart._id : null,
        };
      })
    );

    res.status(200).send(usersWithDetails);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const userId = req.userId;
    const admin = await Admin.findById(userId);
    if (!admin) return res.status(404).send("Your Admin Account is not found");
    const { id } = req.query;
    if (!id || !isValidObjectId(id)) {
      return res.status(400).send("Invalid User ID");
    }

    const user = await User.findById(id).select("+password");
    if (!user) {
      return res.status(404).send("User not found");
    }
    const { name, email, password } = req.body;

    if (!name && !email && !password) {
      return res
        .status(400)
        .send("Any fields are required to update among name, email, password.");
    }

    if (name && (name.length < 3 || name === user.name)) {
      return res
        .status(400)
        .send(
          "Name must be at least 3 characters long and different than previous to be updated."
        );
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (
      email &&
      (email.length < 7 || !emailRegex.test(email) || email === user.email)
    ) {
      return res.status(400).send("Invalid Email");
    }
    if (password && (await compare(password, user.password))) {
      return res
        .status(400)
        .send("New password must be different from the old password");
    }
    const updatedFields = {};
    if (name) updatedFields.name = name;
    if (email) updatedFields.email = email;
    if (password) updatedFields.password = password;
    const updatedUser = await User.findByIdAndUpdate(id, updatedFields, {
      new: true,
    });
    res
      .status(200)
      .json({ message: "User updated successfully", user: updatedUser });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const userId = req.userId;
    const admin = await Admin.findById(userId);
    if (!admin) return res.status(404).send("Your Admin Account is not found");
    const { id } = req.query;
    if (!id || !isValidObjectId(id)) {
      return res.status(400).send("Invalid User ID");
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).send("User not found");
    }
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(500).send("Error deleting user");
    }
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

/**
  ----------------------------------------------------------------------------------------
  ---------------------------------- Orders Management ----------------------------------
  ----------------------------------------------------------------------------------------
 */

export const allOrders = async (req, res, next) => {
  try {
    const userId = req.userId;
    const admin = await Admin.findById(userId);
    if (!admin) return res.status(404).send("No Such Admin Found");

    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 25;

    const statusOrder = {
      placed: 1,
      preparing: 2,
      prepared: 3,
      pending: 4,
      completed: 5,
      cancelled: 6,
    };

    const orders = await Order.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      {
        $unwind: {
          path: "$userDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          statusPriority: {
            $switch: {
              branches: [
                {
                  case: { $eq: ["$status", "prepared"] },
                  then: statusOrder.prepared,
                },
                {
                  case: { $eq: ["$status", "preparing"] },
                  then: statusOrder.preparing,
                },
                {
                  case: { $eq: ["$status", "placed"] },
                  then: statusOrder.placed,
                },
                {
                  case: { $eq: ["$status", "pending"] },
                  then: statusOrder.pending,
                },
                {
                  case: { $eq: ["$status", "completed"] },
                  then: statusOrder.completed,
                },
                {
                  case: { $eq: ["$status", "cancelled"] },
                  then: statusOrder.cancelled,
                },
              ],
              default: 10,
            },
          },
        },
      },
      {
        $sort: {
          statusPriority: 1, // Sort by status priority (ascending)
          updatedAt: -1, // Then sort by updatedAt (descending)
        },
      },
      { $skip: skip },
      { $limit: limit },
    ]);

    if (!orders.length) {
      return res.status(200).json([]);
    }

    const formattedOrders = orders.map((order) => ({
      _id: order._id,
      userName: order.userDetails?.name,
      userEmail: order.userDetails?.email,
      tableNo: order.tableNo,
      totalPrice: order.totalPrice,
      totalQuantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
      status: order.status,
      dailyOrderId: order.dailyOrderId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));

    res.status(200).json(formattedOrders);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

export const getOrderAccStatus = async (req, res, next) => {
  try {
    const userId = req.userId;
    const admin = await Admin.findById(userId);
    if (!admin) return res.status(404).send("No Such Admin Found");
    const { status } = req.query;
    const validStatus = [
      "pending",
      "placed",
      "preparing",
      "prepared",
      "completed",
      "cancelled",
    ];
    if (!validStatus.includes(status)) {
      return res.status(400).send("Invalid Status provided  ");
    }
    const orders = await Order.find({
      status: status,
    }).populate("userId", "name email");

    if (!orders.length) {
      return res.status(200).json([]);
    }
    const formattedOrders = orders.map((order) => ({
      _id: order._id,
      userName: order.userId.name,
      userEmail: order.userId.email,
      tableNo: order.tableNo,
      totalPrice: order.totalPrice || 0,
      totalQuantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
      status: order.status,
      dailyOrderId: order.dailyOrderId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));
    res.status(200).json(formattedOrders);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};

export const userOrders = async (req, res, next) => {
  try {
    const userId = req.userId;
    const admin = await Admin.findById(userId);
    if (!admin) return res.status(400).send("Your Admin Account Not Found");

    const { id } = req.query;

    if (!id || !isValidObjectId(id)) {
      return res.status(400).send("id is required and must be valid object id");
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const statusOrder = {
      prepared: 1,
      preparing: 2,
      placed: 3,
      pending: 4,
      completed: 5,
      cancelled: 6,
    };

    const orders = await Order.aggregate([
      { $match: { userId: user._id } },
      {
        $addFields: {
          statusPriority: {
            $switch: {
              branches: [
                {
                  case: { $eq: ["$status", "prepared"] },
                  then: statusOrder["prepared"],
                },
                {
                  case: { $eq: ["$status", "preparing"] },
                  then: statusOrder["preparing"],
                },
                {
                  case: { $eq: ["$status", "placed"] },
                  then: statusOrder["placed"],
                },
                {
                  case: { $eq: ["$status", "pending"] },
                  then: statusOrder["pending"],
                },
                {
                  case: { $eq: ["$status", "completed"] },
                  then: statusOrder["completed"],
                },
                {
                  case: { $eq: ["$status", "cancelled"] },
                  then: statusOrder["cancelled"],
                },
              ],
              default: 10,
            },
          },
        },
      },
      {
        $sort: {
          statusPriority: 1, // Sort by status priority (ascending)
          updatedAt: -1, // Then sort by updatedAt (descending)
        },
      },
    ]);

    if (!orders || orders.length === 0) {
      return res.status(200).json({
        user: {
          name: user.name,
          email: user.email,
          id: user._id,
        },
        orders: [],
      });
    }

    // Fetch order details and populate items
    const populatedOrders = await Order.populate(orders, {
      path: "items.pizza",
    });

    const formattedOrders = populatedOrders.map((rawOrder) => {
      const order = formatOrderWithSnapshots(rawOrder);
      return {
        _id: order._id,
        totalPrice: order.totalPrice,
        totalQuantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
        image: order.items[0]?.pizza?.image || null,
        orderId: order.orderId || null,
        status: order.status,
        tableNo: order.tableNo,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      };
    });

    res.status(200).json({
      user: {
        name: user.name,
        email: user.email,
        id: user._id,
      },
      orders: formattedOrders,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

export const OrderDetails = async (req, res, next) => {
  try {
    const userId = req.userId;
    const userFound = await Admin.findById(userId);
    if (!userFound) {
      return res.status(404).json({ message: "Your Admin account not found." });
    }
    const { id: orderId } = req.query;
    if (!orderId || !isValidObjectId(orderId)) {
      return res.status(400).send("Order ID is required and must be valid");
    }

    const order = await Order.findById(orderId)
      .populate({
        path: "userId",
        model: User,
        select: "name email -_id",
      })
      .populate({
        path: "items.pizza",
        model: Pizza,
        populate: [
          { path: "size", model: Inventory, select: "name -_id" },
          { path: "base", model: Inventory, select: "name -_id" },
          { path: "sauce", model: Inventory, select: "name -_id" },
          { path: "cheese", model: Inventory, select: "name -_id" },
          { path: "toppings", model: Inventory, select: "name -_id" },
        ],
      })
      .populate({
        path: "items.customizations.base",
        model: Inventory,
        select: "name -_id",
      })
      .populate({
        path: "items.customizations.sauce",
        model: Inventory,
        select: "name -_id",
      })
      .populate({
        path: "items.customizations.cheese",
        model: Inventory,
        select: "name -_id",
      })
      .populate({
        path: "items.customizations.toppings",
        model: Inventory,
        select: "name -_id",
      });

    if (!order) return res.status(404).json({ message: "Order not found" });
    const formattedOrder = formatOrderWithSnapshots(order);
    formattedOrder.user = formattedOrder.userId;
    delete formattedOrder.userId;
    res.status(200).json(formattedOrder);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

export const updateOrderStatus = async (req, res, next) => {
  try {
    const userId = req.userId;
    const userFound = await Admin.findById(userId);
    if (!userFound)
      return res.status(400).send("Yoour Admin Account Not Found");
    const { id: orderId } = req.query;
    if (!orderId || !isValidObjectId(orderId)) {
      return res.status(400).send("Invalid Order ID");
    }
    let order = await Order.findById(orderId);
    if (!order) return res.status(400).send("Order Not Found with given id");
    const { status } = req.body;
    if (!status || !["preparing", "prepared", "completed", "cancelled"].includes(status)) {
      return res
        .status(400)
        .send("Status is required and must be valid to update");
    }
    if (status === "cancelled") {
      if (order.status === "pending" && order.orderId.startsWith("order_")) {
        const payment = await findCapturedPayment(
          order.orderId,
          order.totalPrice
        );
        if (!payment.success) {
          return res.status(502).send("Unable to confirm payment status. Please retry.");
        }
        if (payment.isPaid) {
          order = await updateOrderPaymentStatus(
            order._id,
            payment.payment.id,
            undefined,
            order.orderId
          );
          if (!order) {
            return res.status(409).send("Order status changed; reload and retry.");
          }
        }
      }
      const cancelledOrder = await cancelOrderAndReleaseInventory({ orderId });
      if (!cancelledOrder) {
        return res.status(409).send(
          "Only pending or placed orders can be cancelled from the admin panel."
        );
      }
      if (cancelledOrder.paymentStatus === "refund_pending") {
        const refund = await refundOrder(
          cancelledOrder.orderId,
          cancelledOrder.paymentId
        );
        if (!refund.success) {
          return res.status(202).json({
            message: "Order cancelled; refund is pending and requires support follow-up.",
            newStatus: cancelledOrder.status,
          });
        }
        try {
          const refundedOrder = await markOrderRefunded(
            cancelledOrder._id,
            refund.refund.id
          );
          if (!refundedOrder) {
            return res.status(202).json({
              message: "Refund was submitted, but its order status needs reconciliation.",
              newStatus: cancelledOrder.status,
            });
          }
        } catch (error) {
          console.error("Refund succeeded but order status could not be reconciled:", error);
          return res.status(202).json({
            message: "Refund was submitted, but its order status needs reconciliation.",
            newStatus: cancelledOrder.status,
          });
        }
      }
      return res.status(200).json({
        message: "Order cancelled successfully",
        newStatus: cancelledOrder.status,
      });
    }

    const allowedTransitions = {
      placed: ["preparing"],
      preparing: ["prepared"],
      prepared: ["completed"],
    };
    if (!allowedTransitions[order.status]?.includes(status)) {
      return res
        .status(409)
        .send(`Cannot transition order from ${order.status} to ${status}.`);
    }
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId, status: order.status },
      { $set: { status } },
      { new: true, runValidators: true }
    );
    if (!updatedOrder) return res.status(409).send("Order status changed; reload and retry.");
    notifyOrderStatus(updatedOrder);
    res.status(200).json({
      message: "Order status updated successfully",
      newStatus: updatedOrder.status,
    });
  } catch (error) {
    console.error(error.message);
    res.status(error.statusCode || 500).send(
      error.statusCode ? error.message : "Internal Server Error"
    );
  }
};
