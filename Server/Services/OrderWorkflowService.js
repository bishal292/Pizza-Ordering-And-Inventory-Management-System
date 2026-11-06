import { Cart } from "../db/models/CartModel.js";
import { Inventory } from "../db/models/InventoryModel.js";
import { Order } from "../db/models/Orders.js";
import { Pizza } from "../db/models/PizzaModels.js";
import { calculatePrice } from "../utils/pizza-pricing.js";
import { adminSocketMap, io, userSocketMap } from "../utils/Socket.js";

const idOf = (value) => value?._id?.toString() || value?.toString();

export function getInventoryRequirements(items) {
  const requirements = new Map();
  const add = (inventoryId, quantity) => {
    const id = idOf(inventoryId);
    if (!id) return;
    requirements.set(id, (requirements.get(id) || 0) + quantity);
  };

  for (const item of items) {
    const quantity = item.quantity;
    const pizza = item.pizza;
    const customizations = item.customizations || {};
    add(customizations.base || pizza.base, quantity);
    for (const id of [...(pizza.sauce || []), ...(customizations.sauce || [])]) {
      add(id, quantity * 5);
    }
    for (const id of [...(pizza.cheese || []), ...(customizations.cheese || [])]) {
      add(id, quantity * 5);
    }
    for (const id of [...(pizza.toppings || []), ...(customizations.toppings || [])]) {
      add(id, quantity * 10);
    }
  }

  return requirements;
}

function createPizzaSnapshot(pizza) {
  const names = (items) => (items || []).map(({ name }) => ({ name }));
  return {
    pizzaId: idOf(pizza),
    name: pizza.name,
    image: pizza.image,
    description: pizza.description,
    size: pizza.size ? { name: pizza.size.name } : undefined,
    base: pizza.base ? { name: pizza.base.name } : undefined,
    sauce: names(pizza.sauce),
    cheese: names(pizza.cheese),
    toppings: names(pizza.toppings),
  };
}

function createCustomizationsSnapshot(customizations, inventoryById) {
  const names = (ids) =>
    (ids || [])
      .map((id) => inventoryById.get(idOf(id))?.name)
      .filter(Boolean)
      .map((name) => ({ name }));
  const base = customizations.base
    ? inventoryById.get(idOf(customizations.base))?.name
    : undefined;
  return {
    base: base ? { name: base } : undefined,
    sauce: names(customizations.sauce),
    cheese: names(customizations.cheese),
    toppings: names(customizations.toppings),
  };
}

async function updateInventoryStock(inventoryId, quantity, direction) {
  const delta = direction === "decrement" ? -quantity : quantity;
  const result = await Inventory.updateOne(
    direction === "decrement"
      ? { _id: inventoryId, stock: { $gte: quantity } }
      : { _id: inventoryId },
    [
      { $set: { stock: { $add: ["$stock", delta] } } },
      {
        $set: {
          status: {
            $cond: [{ $lte: ["$stock", 0] }, "out of stock", "available"],
          },
        },
      },
    ]
  );
  return result.modifiedCount === 1;
}

async function synchronizePizzaAvailability(inventoryIds) {
  if (inventoryIds.length === 0) return;

  const pizzas = await Pizza.find({
    $or: [
      { base: { $in: inventoryIds } },
      { sauce: { $in: inventoryIds } },
      { cheese: { $in: inventoryIds } },
      { toppings: { $in: inventoryIds } },
    ],
  }).populate("base sauce cheese toppings");

  for (const pizza of pizzas) {
    const ingredients = [
      pizza.base,
      ...(pizza.sauce || []),
      ...(pizza.cheese || []),
      ...(pizza.toppings || []),
    ];
    const available =
      ingredients.length > 0 &&
      ingredients.every((ingredient) => ingredient && ingredient.stock > 0);
    await Pizza.updateOne(
      { _id: pizza._id },
      { $set: { status: available ? "available" : "unavailable" } }
    );
  }
}

function workflowError(message, statusCode = 409, outOfStockItems) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (outOfStockItems) error.outOfStockItems = outOfStockItems;
  return error;
}

export async function createReservedOrder({ userId, tableNo }) {
  let createdOrder;
  const movements = [];

  try {
    const cart = await Cart.findOne({ user: userId });
    if (!cart || cart.items.length === 0) {
      return { order: null, emptyCart: true };
    }

    const pizzaIds = [...new Set(cart.items.map((item) => idOf(item.pizza)))];
    const pizzas = await Pizza.find({ _id: { $in: pizzaIds } }).populate(
      "base sauce cheese toppings size"
    );
    const pizzasById = new Map(pizzas.map((pizza) => [idOf(pizza), pizza]));
    const outOfStockItems = [];
    const pricedItems = [];

    for (const item of cart.items) {
      const pizza = pizzasById.get(idOf(item.pizza));
      if (!pizza || pizza.status === "unavailable") {
        outOfStockItems.push({
          name: pizza?.name || "Unknown Pizza",
          reason: "Pizza unavailable",
        });
        continue;
      }
      if (
        ![pizza.base, ...(pizza.sauce || []), ...(pizza.cheese || []), ...(pizza.toppings || [])]
          .every(Boolean)
      ) {
        outOfStockItems.push({
          name: pizza.name,
          reason: "Pizza configuration references missing inventory",
        });
        continue;
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) {
        throw workflowError("Order quantities must be between 1 and 10.", 400);
      }

      const customizations = {
        base: item.customizations?.base?.toString(),
        sauce: (item.customizations?.sauce || []).map(idOf),
        cheese: (item.customizations?.cheese || []).map(idOf),
        toppings: (item.customizations?.toppings || []).map(idOf),
      };
      const price = Math.round(
        (await calculatePrice(pizza, customizations)) * 100
      ) / 100;
      pricedItems.push({
        pizza: pizza._id,
        quantity: item.quantity,
        customizations,
        price,
        finalPrice: Math.round(price * item.quantity * 100) / 100,
        pizzaSnapshot: createPizzaSnapshot(pizza),
      });
    }

    if (outOfStockItems.length > 0) {
      throw workflowError(
        "Some items are unavailable. Please update your cart and try again.",
        409,
        outOfStockItems
      );
    }

    const requirements = getInventoryRequirements(
      pricedItems.map((item) => ({
        ...item,
        pizza: pizzasById.get(idOf(item.pizza)),
      }))
    );
    const inventoryIds = [...requirements.keys()];
    const inventoryItems = await Inventory.find({ _id: { $in: inventoryIds } });
    const inventoryById = new Map(inventoryItems.map((item) => [idOf(item), item]));

    for (const [inventoryId, requiredQuantity] of requirements) {
      const inventory = inventoryById.get(inventoryId);
      if (!inventory || inventory.stock < requiredQuantity) {
        outOfStockItems.push({
          name: inventory?.name || "Unknown inventory item",
          reason: `Out of stock. Required: ${requiredQuantity}, Available: ${inventory?.stock || 0}`,
        });
        continue;
      }
      if (!(await updateInventoryStock(inventoryId, requiredQuantity, "decrement"))) {
        outOfStockItems.push({
          name: inventory.name,
          reason: "Stock changed while placing the order. Please try again.",
        });
        continue;
      }
      movements.push({ inventoryItem: inventory._id, quantity: requiredQuantity });
    }

    if (outOfStockItems.length > 0) {
      throw workflowError(
        "Some items are out of stock. Please ask admin for the issue.",
        409,
        outOfStockItems
      );
    }

    await synchronizePizzaAvailability(inventoryIds);

    for (const item of pricedItems) {
      item.customizationsSnapshot = createCustomizationsSnapshot(
        item.customizations,
        inventoryById
      );
    }

    const totalPrice =
      Math.round(
        pricedItems.reduce((sum, item) => sum + item.finalPrice, 0) * 100
      ) / 100;
    const dailyOrderId = await Order.generateDailyOrderId();
    createdOrder = new Order({
      userId,
      items: pricedItems,
      totalPrice,
      dailyOrderId,
      orderId: String(dailyOrderId),
      tableNo,
      inventoryMovements: movements,
      stockReserved: true,
    });
    await createdOrder.save();

    const cartRemoval = await Cart.deleteOne({
      _id: cart._id,
      user: userId,
      updatedAt: cart.updatedAt,
    });
    if (cartRemoval.deletedCount !== 1) {
      throw workflowError(
        "Your cart changed while the order was being placed. Please retry.",
        409
      );
    }

    return { order: createdOrder, emptyCart: false };
  } catch (error) {
    let orderRemoved = !createdOrder;
    if (createdOrder) {
      try {
        const deletion = await Order.deleteOne({ _id: createdOrder._id });
        orderRemoved = deletion.deletedCount === 1;
        if (!orderRemoved) {
          orderRemoved = !(await Order.exists({ _id: createdOrder._id }));
        }
      } catch (cleanupError) {
        console.error("Could not remove incomplete order during checkout compensation:", cleanupError);
        orderRemoved = false;
      }
    }

    if (orderRemoved) {
      const rollbackErrors = [];
      for (const movement of [...movements].reverse()) {
        try {
          const restored = await updateInventoryStock(
            movement.inventoryItem,
            movement.quantity,
            "increment"
          );
          if (!restored) {
            rollbackErrors.push(
              new Error(`Could not restore inventory ${movement.inventoryItem}`)
            );
          }
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }

      try {
        await synchronizePizzaAvailability(
          movements.map((movement) => movement.inventoryItem)
        );
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }

      if (rollbackErrors.length > 0) {
        console.error("Checkout compensation was incomplete:", rollbackErrors);
        throw workflowError(
          "Order placement failed and inventory could not be fully restored. Contact support before retrying.",
          500
        );
      }
    } else {
      console.error(
        "Checkout compensation retained inventory because an order may still exist:",
        createdOrder?._id
      );
      error.orderId = createdOrder?._id?.toString();
    }

    throw error;
  }
}

export async function cancelOrderAndReleaseInventory({ orderId, userId }) {
  const filter = {
    _id: orderId,
    status: { $in: ["pending", "placed"] },
  };
  if (userId) filter.userId = userId;
  const order = await Order.findOne(filter)
    .populate({
      path: "items.pizza",
      populate: "base sauce cheese toppings size",
    })
    .select("+stockReserved");

  if (!order) return null;

  let movements = order.inventoryMovements;
  if (!movements?.length && order.stockReserved !== false) {
    movements = [...getInventoryRequirements(order.items)].map(
      ([inventoryItem, quantity]) => ({ inventoryItem, quantity })
    );
  }
  const previousStatus = order.status;
  const previousPaymentStatus = order.paymentStatus;
  const update = {
    status: "cancelled",
    stockReserved: false,
  };
  if (previousPaymentStatus === "paid" || previousStatus === "placed") {
    update.paymentStatus = "refund_pending";
  }

  const cancelledOrder = await Order.findOneAndUpdate(
    { ...filter, stockReserved: { $ne: false } },
    { $set: update },
    { new: true, runValidators: true }
  );
  if (!cancelledOrder) return null;

  const restoredMovements = [];
  try {
    for (const movement of movements || []) {
      if (
        !(await updateInventoryStock(
          movement.inventoryItem,
          movement.quantity,
          "increment"
        ))
      ) {
        throw workflowError(
          "Cannot restore reserved stock because an inventory item is missing."
        );
      }
      restoredMovements.push(movement);
    }

    await synchronizePizzaAvailability(
      (movements || []).map((movement) => movement.inventoryItem)
    );
  } catch (error) {
    const rollbackErrors = [];
    for (const movement of [...restoredMovements].reverse()) {
      try {
        const reverted = await updateInventoryStock(
          movement.inventoryItem,
          movement.quantity,
          "decrement"
        );
        if (!reverted) {
          rollbackErrors.push(
            new Error(`Could not reverse inventory release for ${movement.inventoryItem}`)
          );
        }
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }

    try {
      await synchronizePizzaAvailability(
        restoredMovements.map((movement) => movement.inventoryItem)
      );
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError);
    }

    if (rollbackErrors.length === 0) {
      const reopenedOrder = await Order.findOneAndUpdate(
        { _id: cancelledOrder._id, status: "cancelled", stockReserved: false },
        {
          $set: {
            status: previousStatus,
            paymentStatus: previousPaymentStatus,
            stockReserved: true,
          },
        },
        { new: true, runValidators: true }
      );
      if (!reopenedOrder) {
        rollbackErrors.push(new Error("Could not reopen the order after compensation"));
      }
    }

    if (rollbackErrors.length > 0) {
      console.error("Cancellation compensation was incomplete:", rollbackErrors);
      throw workflowError(
        "Order cancellation could not complete safely. Contact support before retrying.",
        500
      );
    }
    throw error;
  }

  notifyOrderStatus(cancelledOrder);
  return cancelledOrder;
}

export function formatOrderWithSnapshots(order) {
  const formatted = order.toObject
    ? order.toObject()
    : { ...order };
  delete formatted.inventoryMovements;
  delete formatted.stockReserved;
  delete formatted.isStockDecrement;

  if (
    formatted.paymentStatus === "unpaid" &&
    formatted.paymentId &&
    ["placed", "preparing", "prepared", "completed"].includes(formatted.status)
  ) {
    formatted.paymentStatus = "paid";
  }

  const mergeSnapshot = (snapshot, current) => {
    if (snapshot === undefined || snapshot === null) return current;
    if (Array.isArray(snapshot)) return snapshot;
    if (
      typeof snapshot !== "object" ||
      typeof current !== "object" ||
      current === null ||
      Array.isArray(current) ||
      Object.getPrototypeOf(snapshot) !== Object.prototype ||
      Object.getPrototypeOf(current) !== Object.prototype
    ) {
      return snapshot;
    }

    return Object.fromEntries(
      Array.from(
        new Set([...Object.keys(current), ...Object.keys(snapshot)]),
        (key) => [
          key,
          mergeSnapshot(snapshot[key], current[key]),
        ]
      )
    );
  };

  formatted.items = (formatted.items || []).map((item) => {
    if (!item.pizzaSnapshot) return item;
    const { pizzaId, ...pizzaSnapshot } = item.pizzaSnapshot;
    return {
      ...item,
      pizza: {
        ...mergeSnapshot(pizzaSnapshot, item.pizza || {}),
        _id: item.pizza?._id || pizzaId,
      },
      customizations: mergeSnapshot(
        item.customizationsSnapshot,
        item.customizations || {}
      ),
    };
  });
  formatted.totalQuantity = formatted.items.reduce(
    (total, item) => total + (Number(item.quantity) || 0),
    0
  );
  return formatted;
}

export function notifyNewOrder(order) {
  if (!io) return;
  for (const socketId of adminSocketMap.values()) {
    io.to(socketId).emit("new-order", {
      message: "New Order Placed",
      id: order._id,
      dailyOrderId: order.dailyOrderId,
    });
  }
}

export function notifyOrderStatus(order) {
  if (!io) return;
  const socketId = userSocketMap.get(order.userId.toString());
  if (socketId) {
    io.to(socketId).emit("updated-status", {
      status: order.status,
      id: order.dailyOrderId,
      _id: order._id,
    });
  }
}

export async function updateOrderPaymentStatus(
  orderId,
  paymentId,
  userId,
  razorpayOrderId
) {
  const filter = { _id: orderId, status: "pending" };
  if (userId) filter.userId = userId;
  if (razorpayOrderId) filter.orderId = razorpayOrderId;
  const order = await Order.findOneAndUpdate(
    filter,
    {
      $set: {
        status: "placed",
        paymentId,
        paymentStatus: "paid",
        paidAt: new Date(),
      },
    },
    { new: true, runValidators: true }
  );
  if (order) notifyOrderStatus(order);
  return order;
}

export async function markOrderRefunded(orderId, refundId) {
  return Order.findOneAndUpdate(
    { _id: orderId, status: "cancelled", paymentStatus: "refund_pending" },
    { $set: { paymentStatus: "refunded", refundId, refundedAt: new Date() } },
    { new: true, runValidators: true }
  );
}
