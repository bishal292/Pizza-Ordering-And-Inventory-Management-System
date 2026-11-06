import { Pizza } from "../../db/models/PizzaModels.js";
import { Cart } from "../../db/models/CartModel.js";
import { User } from "../../db/models/UserModel.js";
import { Inventory } from "../../db/models/InventoryModel.js";
import { isValidObjectId } from "mongoose";
import { calculatePrice } from "../../utils/pizza-pricing.js";
import {
  checkOrderStatus,
  createPayment,
  findCapturedPayment,
  refundOrder,
} from "../../Services/RazorPay.js";
import { Order } from "../../db/models/Orders.js";
import {
  cancelOrderAndReleaseInventory,
  createReservedOrder,
  formatOrderWithSnapshots,
  markOrderRefunded,
  notifyNewOrder,
  updateOrderPaymentStatus,
} from "../../Services/OrderWorkflowService.js";

export const getPizzas = async (req, res, next) => {
  try {
    const pizzas = await Pizza.find({ status: "available" })
      .sort({ updatedAt: -1 })
      .populate("base sauce cheese toppings size", "name price");
    if (!pizzas) {
      return res.status(404).send("No Pizzas found");
    }
    res.status(200).send(pizzas);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

/**
  ----------------------------------------------------------------------------------------
  ---------------------------------- Cart Management ----------------------------------
  ----------------------------------------------------------------------------------------
  */

export const addToCart = async (req, res, next) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send("User not found");
    }

    const { item } = req.body;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return res.status(400).send("Item is required");
    }

    const { pizzaId, customizations = {} } = item;
    if (
      !customizations ||
      typeof customizations !== "object" ||
      Array.isArray(customizations) ||
      !["sauce", "cheese", "toppings"].every(
        (category) =>
          customizations[category] === undefined ||
          Array.isArray(customizations[category])
      )
    ) {
      return res.status(400).send("Invalid customizations");
    }
    if (typeof pizzaId !== "string" || !isValidObjectId(pizzaId)) {
      return res.status(400).send("Pizza ID is required and must be valid");
    }

    const pizza = await Pizza.findById(pizzaId).populate(
      "base",
      "name price category status"
    );
    if (!pizza) {
      return res.status(404).send("Pizza not found");
    }

    // Ensure customizations object has required structure
    customizations.sauce = customizations.sauce || [];
    customizations.cheese = customizations.cheese || [];
    customizations.toppings = customizations.toppings || [];

    // Sort customizations arrays
    customizations.sauce.sort();
    customizations.cheese.sort();
    customizations.toppings.sort();

    // Remove base from customizations if it matches the default pizza base
    if (
      customizations.base &&
      customizations.base === pizza.base._id.toString()
    ) {
      delete customizations.base;
    }

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    // Check if the item already exists in the cart with the same customizations
    const existingItem = cart.items.find(
      (cartItem) =>
        cartItem.pizza.toString() === pizzaId &&
        JSON.stringify(cartItem.customizations) ===
          JSON.stringify(customizations)
    );

    if (existingItem) {
      if (existingItem.quantity < 10) {
        existingItem.quantity += 1;
        existingItem.finalPrice += existingItem.price;
        await cart.save();
        return res.status(201).send("Quantity updated in cart");
      } else {
        return res.status(400).send("Maximum quantity reached");
      }
    }
    if (cart.items.length >= 10) {
      return res.status(400).send("Maximum 10 items allowed in cart");
    }
    // Calculate price based on base pizza and customizations
    const price = await calculatePrice(pizza, customizations);

    cart.items.push({ pizza: pizzaId, quantity: 1, customizations, price });
    await cart.save();

    res.status(201).send("Pizza added to cart");
  } catch (error) {
    console.error(error.message);
    res.status(error.statusCode || 500).send(
      error.statusCode ? error.message : "Internal Server Error"
    );
  }
};
// Helper function to compare arrays regardless of order

export const getCart = async (req, res, next) => {
  try {
    const userId = req.userId;
    const userFound = await User.findById(userId);
    if (!userFound) {
      return res.status(404).json({ message: "User not found" });
    }

    const cart = await Cart.findOne({ user: userId })
      .populate({
        path: "items.pizza",
        model: Pizza,
        populate: [
          {path: "size", model: Inventory, select: "name -_id"},
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
    if (!cart) {
      return res.status(200).json({ items: [] });
    }
    res.status(200).json(cart);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const removeFromCart = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { id: pizzaId, idx: index, csm: customizations } = req.query;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).send("Cart not found");
    }
    if (!pizzaId || !isValidObjectId(pizzaId)) {
      return res.status(400).send("Pizza ID is required and must be valid");
    }

    if (!index && !customizations) {
      res
        .status(400)
        .send("Index or customizations are required to remove item from cart");
    }
    if (index) {
      if (index < 0 || index >= cart.items.length) {
        return res.status(400).send("Invalid index");
      }
      if (cart.items[index].pizza._id.toString() === pizzaId) {
        cart.items.splice(index, 1);
        await cart.save();
        return res.status(200).send("Pizza removed from cart");
      } else {
        return res.status(400).send("NO item found at given index");
      }
    }

    const removed = cart.items.remove({
      pizza: pizzaId,
      customizations,
    });
    if (removed) {
      await cart.save();
      return res.status(200).send("Pizza removed from cart");
    } else {
      return res.status(404).send("Item not found in cart");
    }
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

export const clearCart = async (req, res, next) => {
  try {
    const userId = req.userId;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).send("Cart not found");
    }

    await Cart.findOneAndDelete({ user: userId });

    res.status(200).json({ message: "Cart cleared" });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

export const getOptions = async (req, res, next) => {
  try {
    const bases = await Inventory.find(
      { category: "base", status: "available" },
      "name price"
    );
    const sauces = await Inventory.find(
      { category: "sauce", status: "available" },
      "name price"
    );
    const cheeses = await Inventory.find(
      { category: "cheese", status: "available" },
      "name price"
    );
    const toppings = await Inventory.find(
      { category: "topping", status: "available" },
      "name price"
    );

    res.status(200).json({ bases, sauces, cheeses, toppings });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

/**
  ----------------------------------------------------------------------------------------
  ---------------------------------- Order Management ----------------------------------
  ----------------------------------------------------------------------------------------
*/

export const placeOrder = async (req, res, next) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send("User not found");
    }

    const tableNo = Number(req.body.tableNo);
    if (!Number.isInteger(tableNo) || tableNo < 1) {
      return res.status(400).send("A valid table number is required");
    }

    const { order, emptyCart } = await createReservedOrder({ userId, tableNo });
    if (emptyCart) {
      return res.status(200).json({ message: "Cart is empty", order: [] });
    }

    const order_Razor = await createPayment(order.totalPrice, order.dailyOrderId);
    if (!order_Razor.success) {
      return res.status(502).json({
        message:
          "Your order is reserved, but payment could not be initialized. Open order history to retry payment.",
        orderId: order._id,
      });
    }

    const updatedOrder = await Order.findOneAndUpdate(
      { _id: order._id, userId, status: "pending" },
      { $set: { orderId: order_Razor.order.id } },
      { new: true, runValidators: true }
    );
    if (!updatedOrder) {
      return res.status(409).send("Order changed while payment was being created");
    }
    notifyNewOrder(order);

    res.status(201).json({
      _id: order._id,
      message: "Order placed successfully",
      order: order_Razor.order,
    });
  } catch (error) {
    console.error(error.message);
    if (error.outOfStockItems) {
      return res.status(error.statusCode).json({
        message: error.message,
        outOfStockItems: error.outOfStockItems,
      });
    }
    if (error.orderId) {
      return res.status(error.statusCode || 500).json({
        message:
          "Checkout could not finish cleanup. Check your order history before trying again.",
        orderId: error.orderId,
      });
    }
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Internal Server Error",
    });
  }
};

export const getOrders = async (req, res, next) => {
  try {
    const userId = req.userId;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send("User not found");
    }

    const statusOrder = {
      "prepared": 1,
      "preparing": 2,
      "placed": 3,
      "pending": 4,
      "completed": 5,
      "cancelled": 6
    };

    const orders = await Order.aggregate([
      { $match: { userId: user._id } },
      {
        $addFields: {
          statusPriority: {
            $switch: {
              branches: [
                { case: { $eq: ["$status", "prepared"] }, then: statusOrder["prepared"] },
                { case: { $eq: ["$status", "preparing"] }, then: statusOrder["preparing"] },
                { case: { $eq: ["$status", "placed"] }, then: statusOrder["placed"] },
                { case: { $eq: ["$status", "pending"] }, then: statusOrder["pending"] },
                { case: { $eq: ["$status", "completed"] }, then: statusOrder["completed"] },
                { case: { $eq: ["$status", "cancelled"] }, then: statusOrder["cancelled"] }
              ],
              default: 10
            }
          }
        }
      },
      {
        $sort: {
          statusPriority: 1,         // Sort by status priority (ascending)
          updatedAt: -1               // Then sort by updatedAt (descending)
        }
      }
    ]);

    if (!orders || orders.length === 0) {
      return res.status(200).json([]);
    }

    // Fetch order details and populate items
    const populatedOrders = await Order.populate(orders, { path: "items.pizza" });

    // Format the response
    const formattedOrders = populatedOrders.map((rawOrder) => {
      const order = formatOrderWithSnapshots(rawOrder);
      return {
        _id: order._id,
        totalPrice: order.totalPrice,
        totalQuantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
        image: order.items[0]?.pizza?.image || null,
        orderId: order.orderId || null,
        dailyOrderId: order.dailyOrderId,
        status: order.status,
        tableNo: order.tableNo,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      };
    });

    res.status(200).json(formattedOrders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).send("Failed to fetch orders");
  }
};


export const getOrderDetails = async (req, res, next) => {
  try {
    const userId = req.userId;
    const userFound = await User.findById(userId);
    if (!userFound) {
      return res.status(404).json({ message: "User not found" });
    }
    const { id: orderId } = req.query;
    if (typeof orderId !== "string" || !isValidObjectId(orderId)) {
      return res.status(400).send("Order ID is required and must be valid");
    }

    const order = await Order.findOne({ _id: orderId, userId })
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
    res.status(200).json(formatOrderWithSnapshots(order));
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

export const cancelOrder = async (req, res, next) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send("Your User Account not Found.");
    }
    const { id: orderId } = req.query;
    if (typeof orderId !== "string" || !isValidObjectId(orderId)) {
      return res.status(400).send("Order ID is required and must be valid");
    }
    let order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).send("Order not found");
    }

    if (order.status === "pending" && order.orderId.startsWith("order_")) {
      const payment = await findCapturedPayment(order.orderId, order.totalPrice);
      if (!payment.success) {
        return res.status(502).send("Unable to confirm payment status. Please retry.");
      }
      if (payment.isPaid) {
        order = await updateOrderPaymentStatus(
          order._id,
          payment.payment.id,
          userId,
          order.orderId
        );
        if (!order) {
          order = await Order.findOne({ _id: orderId, userId });
        }
      }
    }

    const cancelledOrder = await cancelOrderAndReleaseInventory({ orderId, userId });
    if (!cancelledOrder) {
      return res.status(409).send(
        "Order cannot be cancelled because its status has changed or preparation has started."
      );
    }

    if (cancelledOrder.paymentStatus === "refund_pending") {
      const refund = await refundOrder(
        cancelledOrder.orderId,
        cancelledOrder.paymentId
      );
      if (refund.success) {
        try {
          const refundedOrder = await markOrderRefunded(
            cancelledOrder._id,
            refund.refund.id
          );
          if (!refundedOrder) {
            return res.status(202).send(
              "Refund was submitted, but its order status needs reconciliation."
            );
          }
        } catch (error) {
          console.error("Refund succeeded but order status could not be reconciled:", error);
          return res.status(202).send(
            "Refund was submitted, but its order status needs reconciliation."
          );
        }
        return res.status(200).send("Order cancelled and refund initiated.");
      }
      return res.status(202).send(
        "Order cancelled; refund is pending and requires support follow-up."
      );
    }
    return res.status(200).send("Order cancelled successfully.");
  } catch (error) {
    console.error(error.message);
    res.status(error.statusCode || 500).send(
      error.statusCode ? error.message : "Internal Server Error"
    );
  }
};

export const completePayment = async (req, res, next) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send("User not found");
    }
    const { id: orderId } = req.query;
    if (typeof orderId !== "string" || !isValidObjectId(orderId)) {
      return res.status(400).send("Order ID is required and must be valid");
    }
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).send("Order not found");
    }
    if (order.status !== "pending") {
      return res.status(400).send("Payment already completed");
    }

    const orderStatus = await checkOrderStatus(order.orderId);

    if (!orderStatus?.success) {
      if (order.orderId.startsWith("order_")) {
        return res.status(502).send("Unable to confirm payment provider status. Please retry.");
      }
      const createorderpay = await createPayment(order.totalPrice, order.dailyOrderId);
      if (!createorderpay.success) {
        return res
          .status(500)
          .send("Failed to create payment order.Please try again later.");
      }
      const updatedOrder = await Order.findOneAndUpdate(
        { _id: orderId, userId, status: "pending" },
        { $set: { orderId: createorderpay.order.id } },
        { new: true, runValidators: true }
      );
      if (!updatedOrder) {
        return res.status(409).send("Order changed while payment was being created.");
      }
      return res.status(200).json({
        message: "Payment Order Created Successfully",
        order: createorderpay.order,
      });
    }
    if (orderStatus?.isPaid) {
      const payment = await findCapturedPayment(order.orderId, order.totalPrice);
      if (!payment.success) {
        return res.status(502).send("Unable to verify payment details.");
      }
      if (!payment.isPaid) {
        return res.status(409).send("Captured payment details do not match this order.");
      }
      const updatedOrder = await updateOrderPaymentStatus(
        order._id,
        payment.payment.id,
        userId,
        order.orderId
      );
      if (!updatedOrder) {
        return res.status(409).send("Order payment has already been processed.");
      }
      return res.status(200).json({
        message: "Order payment confirmed",
        order: updatedOrder,
      });
    }
    res.status(200).json({
      message: "Order Payment Details",
      order: orderStatus.razorpayOrder,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};
