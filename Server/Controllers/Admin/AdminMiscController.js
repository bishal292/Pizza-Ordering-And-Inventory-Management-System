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

// Admin Dashboard
// SUGGESTION: Razorpay method to get total revenue for lifetime and today's can be used for actual earning's data via online
export const dashboard = async (req, res, next) => {
  try {
    const userId = req.userId;
    const admin = await Admin.findById(userId);
    if (!admin) return res.status(404).send("No Such Admin Found");

    const totalPizzas = await Pizza.countDocuments();
    const totalOrders = await Order.countDocuments();
    const revenue = await Order.aggregate([
      {
        $match: {
          status: { $nin: ["pending", "cancelled"] }, // Exclude pending and cancelled orders
        },
      },
      {
        $group: {
          _id: {
            isToday: {
              $eq: [
                { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                new Date().toISOString().split("T")[0],
              ],
            },
          },
          totalRevenue: { $sum: "$totalPrice" },
          todayRevenue: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    {
                      $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                    },
                    new Date().toISOString().split("T")[0],
                  ],
                },
                "$totalPrice",
                0,
              ],
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalRevenue" }, // Total revenue across all records
          today: { $sum: "$todayRevenue" }, // Sum today's revenue
        },
      },
    ]);
    const totalUser = await User.countDocuments();
    const lowStock = await Inventory.find({
      $expr: { $lte: ["$stock", "$threshold"] },
    }).countDocuments();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayOrderCancelled = await Order.find({
      status: "cancelled",
      createdAt: { $gte: startOfDay },
    }).countDocuments();

    const todayOrderCount = await Order.find({
      createdAt: { $gte: startOfDay },
    }).countDocuments();

    res.status(200).json({
      "Total Orders": totalOrders,
      "Today's Orders": todayOrderCount,
      "Total Revenue": revenue[0]?.total || 0,
      "Today's Revenue": revenue[0]?.today || 0,
      "Total Pizzas": totalPizzas,
      "Total Users": totalUser,
      "Out Of Stock Items": lowStock,
      "Today's Orders Cancelled": todayOrderCancelled,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

export const revenueData = async (req, res, next) => {};

export const orderData = async (req, res, next) => {};

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
    if (!name || !category || !type || !price || !stock || !threshold) {
      return res.status(400).send("Please fill all fields");
    }
    const product = await Inventory.findOne({
      name,
    });
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
      name,
      category,
      type,
      price,
      stock,
      threshold,
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
      (category && product.category != category) ||
      (name && product.name != name)
    ) {
      return res.status(400).send("Name And Category cannot be updated");
    }
    if (!type && !price && !stock && !threshold) {
      return res
        .status(400)
        .send(
          "Some fields are required to update among type, price, stock, threshold."
        );
    }

    if (type && !["veg", "non-veg"].includes(type)) {
      return res.status(400).send("Invalid Type");
    }

    if (price && price < 7) {
      return res.status(400).send("Price cannot be less than 7.");
    }

    const updatedFields = {};
    if (type) updatedFields.type = type;
    if (price) updatedFields.price = price;
    if (stock) updatedFields.stock = stock;
    if (threshold) updatedFields.threshold = threshold;

    const updatedProduct = await Inventory.findByIdAndUpdate(
      id,
      updatedFields,
      { new: true }
    );
    if (!updatedProduct) {
      return res.status(500).send("Error updating product");
    }
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

    res.status(200).json(pizza);
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

    if (!name || !image || !description || !baseSize || !base || !price) {
      return res
        .status(400)
        .send(
          "Please fill all required fields : name, image, description, size, base, price"
        );
    }
    if (isNaN(price)) {
      return res.status(400).send("Price must be a number");
    }

    const validateInventoryItems = async (items, category) => {
      if (!Array.isArray(items)) return false;
      for (const item of items) {
        if (!isValidObjectId(item)) return false;
        const inventoryItem = await Inventory.findOne({ _id: item, category });
        if (!inventoryItem) return false;
      }
      return true;
    };

    if (!(await validateInventoryItems([baseSize], "baseSize"))) {
      return res.status(400).send("Invalid Base");
    }
    if (!(await validateInventoryItems([base], "base"))) {
      return res.status(400).send("Invalid Base");
    }
    if (sauce && !(await validateInventoryItems(sauce, "sauce"))) {
      return res.status(400).send("Invalid Sauce");
    }
    if (cheese && !(await validateInventoryItems(cheese, "cheese"))) {
      return res.status(400).send("Invalid Cheese");
    }
    if (toppings && !(await validateInventoryItems(toppings, "topping"))) {
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
      price,
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

    if (
      !name &&
      !base &&
      !size &&
      !price &&
      !image &&
      !description &&
      !sauce &&
      !cheese &&
      !toppings
    ) {
      return res
        .status(400)
        .send("Some changes in any fields are required to perform updation");
    }

    if (price && isNaN(price)) {
      return res.status(400).send("Price must be a number");
    }

    const validateInventoryItems = async (items, category) => {
      if (!Array.isArray(items)) return false;
      for (const item of items) {
        if (!isValidObjectId(item)) return false;
        const inventoryItem = await Inventory.findOne({ _id: item, category });
        if (!inventoryItem) return false;
      }
      return true;
    };

    if (size && !(await validateInventoryItems([size], "baseSize"))) {
      return res.status(400).send("Invalid Base");
    }
    if (base && !(await validateInventoryItems([base], "base"))) {
      return res.status(400).send("Invalid Base");
    }
    if (sauce && !(await validateInventoryItems(sauce, "sauce"))) {
      return res.status(400).send("Invalid Sauce");
    }
    if (cheese && !(await validateInventoryItems(cheese, "cheese"))) {
      return res.status(400).send("Invalid Cheese");
    }
    if (toppings && !(await validateInventoryItems(toppings, "topping"))) {
      return res.status(400).send("Invalid Toppings");
    }

    const updatedFields = {};
    if (name) updatedFields.name = name;
    if (base) updatedFields.base = base;
    if (size) updatedFields.size = size;
    if (price) updatedFields.price = price;
    if (image) {
      updatedFields.image = image;
      // If the image is being updated, delete the old image from the server
      await deleteImage(pizza.image);
    }
    if (description) updatedFields.description = description;
    if (sauce) updatedFields.sauce = sauce;
    if (cheese) updatedFields.cheese = cheese;
    if (toppings) updatedFields.toppings = toppings;

    const updatedPizza = await Pizza.findByIdAndUpdate(id, updatedFields, {
      new: true,
    }).populate("size", "name");
    if (!updatedPizza) {
      return res.status(500).send("Error updating pizza");
    }
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
    await deleteImage(pizza.image);
    const deletedPizza = await Pizza.findByIdAndDelete(id);
    if (!deletedPizza) {
      return res.status(500).send("Error deleting pizza");
    }
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
      return res.status(204).send("No Users found");
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
      delivered: 5,
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
                  case: { $eq: ["$status", "delivered"] },
                  then: statusOrder.delivered,
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
      return res.status(204).send("No Orders found");
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
    const admin = Admin.findById(userId);
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
      return res.status(204).send("No Orders found with status: " + status);
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
    const admin = Admin.findById(userId);
    if (!admin) return res.status(400).send("Your Admin Account Not Found");

    const { id } = req.query;

    if (!id || !isValidObjectId(id)) {
      return res.status(400).send("id is required and must be valid object id");
    }

    const user = await User.findById(id);

    const statusOrder = {
      prepared: 1,
      preparing: 2,
      placed: 3,
      pending: 4,
      delivered: 5,
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
                  case: { $eq: ["$status", "delivered"] },
                  then: statusOrder["delivered"],
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
      return res.status(204).send("No orders found");
    }

    // Fetch order details and populate items
    const populatedOrders = await Order.populate(orders, {
      path: "items.pizza",
    });

    const formattedOrders = populatedOrders.map((order) => ({
      _id: order._id,
      totalPrice: order.totalPrice,
      totalQuantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
      image: order.items[0]?.pizza?.image || null,
      orderId: order.orderId || null,
      status: order.status,
      tableNo: order.tableNo,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));

    res.status(200).json({
      user: {
        name: user.name,
        email: user.email,
        id: user._id,
      },
      orders: formattedOrders,
    });
  } catch (error) {}
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

    if (!order) {
      return res.status(204).json({ message: "Order not found" });
    }
    order.user = order.userId;
    order.userId = undefined;

    res.status(200).json(order);
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
    const order = await Order.findById(orderId);
    if (!order) return res.status(400).send("Order Not Found with given id");
    const { status } = req.body;
    const validStatus = [
      "placed",
      "preparing",
      "prepared",
      "completed",
      "cancelled",
    ];
    if (!status || !validStatus.includes(status)) {
      return res
        .status(400)
        .send("Status is required and must be valid to update");
    }
    if (order.status === "completed" || order.status === "cancelled") {
      return res
        .status(400)
        .send("Cannot update the status of a completed or cancelled order.");
    }
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { status },
      { new: true }
    );
    if (!updatedOrder) return res.status(500).send("Error updating order");
    res.status(200).json({
      message: "Order status updated successfully",
      newStatus: updatedOrder.status,
    });
  } catch (error) {}
};
