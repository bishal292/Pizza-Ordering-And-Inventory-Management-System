import Razorpay from "razorpay";
import crypto from "crypto";
import { User } from "../db/models/UserModel.js";
import { Order } from "../db/models/Orders.js";
import { updateOrderPaymentStatus } from "./OrderWorkflowService.js";

// Razor-Pay instances
export const instance = new Razorpay({
  key_id: process.env.RAZORPAY_API_KEY,
  key_secret: process.env.RAZORPAY_API_SECRET,
});

/**
 * Verify Payment -> User Accessing this controller must be authenticated.
 * @param {Request} req -> orderId, paymentId, signature in req.body
 * @param {Response} res -> Response with status and message
 * @param {NextFunction} next
 */
export const verifyPayment = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);
    if (!user) return res.status(404).send("Your user account not found");
    const { orderId, paymentId, signature } = req.body;
    if (
      typeof orderId !== "string" ||
      typeof paymentId !== "string" ||
      typeof signature !== "string" ||
      !orderId ||
      !paymentId ||
      !signature
    ) {
      return res.status(400).json({
        message: "Invalid Request",
        reason: "Missing orderId, paymentId or signature",
      });
    }
    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_API_SECRET)
      .update(body.toString())
      .digest("hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const signatureBuffer = Buffer.from(signature, "hex");
    if (
      signatureBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
    ) {
      const order = await Order.findOne({ orderId, userId });
      if (!order) return res.status(404).send("Order not found");
      if (
        order.status === "placed" &&
        order.paymentId === paymentId &&
        order.paymentStatus === "paid"
      ) {
        return res.status(200).json({
          message: "Payment was already verified",
          order,
        });
      }
      if (order.status !== "pending") {
        return res.status(409).send("Order is not awaiting payment");
      }
      const payment = await instance.payments.fetch(paymentId);
      if (
        payment.order_id !== orderId ||
        payment.status !== "captured" ||
        payment.amount !== Math.round(order.totalPrice * 100) ||
        payment.currency !== "INR"
      ) {
        return res.status(400).json({ message: "Payment details do not match this order" });
      }

      const updatedOrder = await updateOrderPaymentStatus(
        order._id,
        paymentId,
        userId,
        orderId
      );
      if (!updatedOrder) {
        return res.status(409).send("Order payment has already been processed");
      }
      res.status(200).json({
        message: "Payment Successful",
        order: updatedOrder,
      });
    } else {
      res.status(400).json({ message: "Invalid Payment" });
    }
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

/**
 *
 * @param {number} amount
 * @param {string} dailyOrderId
 * @param {string} currency -> Default: INR
 * @returns
 */
export const createPayment = async (amount,dailyOrderId, currency = "INR") => {
  try {
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, message: "Payment amount must be greater than zero." };
    }
    const razorpayOrder = await instance.orders.create({
      amount: Math.round(amount * 100), // Amount in paise (₹1 = 100 paise)
      currency: currency,
      receipt: dailyOrderId.toString(),
      payment_capture: 1, // Auto-capture payment
      notes: {
        description: "Pizza Delivery System Payment",
      },
    });
    return { success: true, order: razorpayOrder };
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    return {
      success: false,
      message: "Failed to create payment order.",
      error,
    };
  }
};

/**
 *
 * @param {string} razorpayOrderId
 * @returns
 */
export const refundOrder = async (razorpayOrderId, paymentId) => {
  try {
    const order = await instance.orders.fetch(razorpayOrderId);

    if (order.status !== "paid") {
      return {
        success: false,
        message: "Order is not paid, no refund needed.",
      };
    }

    const payments = await instance.orders.fetchPayments(razorpayOrderId);

    if (payments.items.length === 0) {
      return { success: false, message: "No payments found." };
    }

    const payment = payments.items.find(
      (item) => item.id === paymentId && item.status === "captured"
    ) || (!paymentId ? payments.items.find((item) => item.status === "captured") : null);
    if (!payment) {
      return { success: false, message: "No captured payment found." };
    }

    // Create the refund
    const refund = await instance.payments.refund(payment.id, {
      amount: payment.amount,
      speed: "normal",
      notes: {
        reason: "Order cancelled",
        order_id: razorpayOrderId,
      },
    });

    return { success: true, message: "Refund processed successfully.", refund };
  } catch (error) {
    console.error("Error processing refund:", error);
    return { success: false, message: "Refund failed.", error };
  }
};

/**
 *
 * @param {string} razorpayOrderId
 * @returns { success: boolean, isPaid: boolean }
 */
export const checkOrderStatus = async (razorpayOrderId) => {
  try {
    // Fetch the order from Razorpay
    const razorpayOrder = await instance.orders.fetch(razorpayOrderId);

    if (!razorpayOrder) {
      return { success: false, message: "Order not found in Razorpay." };
    }
    return {
      success: true,
      isPaid: razorpayOrder?.status === "paid" ,
      razorpayOrder,
    };
  } catch (error) {
    console.error("Error checking Razorpay order status:", error);
    return { success: false, message: "Failed to fetch order status.", error };
  }
};

/**
 *
 * @param {string} orderId
 * @returns
 */

export async function checkPayment(razorpayOrderId) {
  try {

    const payments = await instance.orders.fetchPayments(razorpayOrderId);

    const capturedPayment = payments.items.find(
      (payment) => payment.status === "captured"
    );
    return{
      success:true,
      isPaid:Boolean(capturedPayment),
      payment: capturedPayment,
      payments
    }
  } catch (error) {
    console.error("Error checking Razorpay order status:", error);
    return { success: false, message: "Failed to fetch order status.", error };
  }
}

export async function findCapturedPayment(razorpayOrderId, expectedAmount) {
  const result = await checkPayment(razorpayOrderId);
  if (!result.success) return result;

  const payment = result.payments.items.find(
    (item) =>
      item.status === "captured" &&
      item.order_id === razorpayOrderId &&
      item.amount === Math.round(expectedAmount * 100) &&
      item.currency === "INR"
  );
  return { success: true, isPaid: Boolean(payment), payment };
}

/**
 *
 * @param {string} fromDate - Start date in ISO format (e.g., "2023-01-01T00:00:00Z")
 * @param {string} toDate - End date in ISO format (e.g., "2023-01-31T23:59:59Z")
 * @returns { success: boolean, totalEarnings: number }
 */
export const getTotalEarnings = async (type = "today") => {
  try {
    let fromDate, toDate;

    if (type === "today") {
      fromDate = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);   // Start of today
      toDate = Math.floor(new Date().setHours(23, 59, 59, 999) / 1000); // End of today
    } else if (type === "lifetime") {
      fromDate = 946684800;  // Jan 1, 2000 (minimum allowed by Razorpay)
      toDate = Math.floor(Date.now() / 1000);  // Current timestamp
    } else {
      throw new Error("Invalid type. Use 'today' or 'lifetime'.");
    }

    let totalEarnings = 0;
    let skip = 0;
    const limit = 100; // Max payments per request
    let hasMore = true;

    while (hasMore) {
      const query = {
        from: fromDate,
        to: toDate,
        skip,
        count: limit, 
      };

      const response = await instance.payments.all(query);
      const payments = response.items;

      if (payments.length < limit) {
        hasMore = false;
      }

      // Sum up the payments
      totalEarnings += payments
        .filter((payment) => payment.status === "captured")
        .reduce((sum, payment) => sum + payment.amount, 0);

      // Check if there are more pages
      hasMore = payments.length === limit;
      skip += limit;
    }

    return {
      success: true,
      type,
      totalEarnings: totalEarnings / 100, // Convert from paise to rupees
    };
  } catch (error) {
    console.error(`Error fetching ${type} earnings:`, error);
    return { success: false, message: `Failed to fetch ${type} earnings.`, error };
  }
};
