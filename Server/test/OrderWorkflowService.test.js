import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  formatOrderWithSnapshots,
  getInventoryRequirements,
} from "../Services/OrderWorkflowService.js";

const objectId = () => new mongoose.Types.ObjectId();

test("inventory requirements aggregate recipe and customization consumption", () => {
  const baseId = objectId();
  const sauceId = objectId();
  const toppingId = objectId();

  const requirements = getInventoryRequirements([
    {
      quantity: 2,
      pizza: { base: baseId, sauce: [sauceId], cheese: [], toppings: [toppingId] },
      customizations: { sauce: [sauceId], cheese: [], toppings: [toppingId] },
    },
  ]);

  assert.equal(requirements.get(baseId.toString()), 2);
  assert.equal(requirements.get(sauceId.toString()), 20);
  assert.equal(requirements.get(toppingId.toString()), 40);
});

test("order history responses use persisted pizza and customization snapshots", () => {
  const order = formatOrderWithSnapshots({
    stockReserved: true,
    inventoryMovements: [{ inventoryItem: "internal-inventory-id", quantity: 5 }],
    items: [
      {
        quantity: 1,
        pizza: { _id: "pizza-id", name: "Renamed pizza" },
        pizzaSnapshot: {
          name: "Original pizza",
          image: "original.png",
          base: { name: "Original base" },
          sauce: [],
          cheese: [],
          toppings: [],
        },
        customizations: { sauce: [] },
        customizationsSnapshot: { base: { name: "Original base" }, sauce: [] },
      },
    ],
  });

  assert.equal(order.items[0].pizza.name, "Original pizza");
  assert.equal(order.items[0].pizza.image, "original.png");
  assert.equal(order.items[0].customizations.base.name, "Original base");
  assert.equal(order.totalQuantity, 1);
  assert.equal("stockReserved" in order, false);
  assert.equal("inventoryMovements" in order, false);
});

test("order detail formatting includes total quantity for legacy orders", () => {
  const order = formatOrderWithSnapshots({
    items: [
      { quantity: 2, pizza: { name: "Legacy pizza" } },
      { quantity: 3, pizza: null },
    ],
  });

  assert.equal(order.totalQuantity, 5);
  assert.equal(order.items[0].pizza.name, "Legacy pizza");
});

test("partial pizza snapshots retain populated fields missing from the snapshot", () => {
  const order = formatOrderWithSnapshots({
    paymentStatus: "unpaid",
    paymentId: "payment-id",
    status: "completed",
    items: [
      {
        quantity: 1,
        pizza: {
          _id: "pizza-id",
          name: "Current pizza",
          image: "pizza.png",
          description: "Pizza description",
          size: { name: "Large", price: 100 },
          base: { name: "Thin crust", price: 25 },
          sauce: [{ name: "Tomato sauce" }],
          cheese: [{ name: "Mozzarella" }],
          toppings: [{ name: "Olives" }],
        },
        pizzaSnapshot: {
          pizzaId: "pizza-id",
          sauce: [],
          cheese: [],
          toppings: [],
        },
        customizations: {
          base: { name: "Gluten-free base" },
          sauce: [],
          cheese: [],
          toppings: [],
        },
        customizationsSnapshot: {
          sauce: [],
          cheese: [],
          toppings: [],
        },
      },
    ],
  });

  const item = order.items[0];
  assert.equal(item.pizza.name, "Current pizza");
  assert.equal(item.pizza.image, "pizza.png");
  assert.equal(item.pizza.description, "Pizza description");
  assert.deepEqual(item.pizza.size, { name: "Large", price: 100 });
  assert.deepEqual(item.pizza.base, { name: "Thin crust", price: 25 });
  assert.deepEqual(item.pizza.sauce, []);
  assert.deepEqual(item.customizations.base, { name: "Gluten-free base" });
  assert.equal(order.paymentStatus, "paid");
});
