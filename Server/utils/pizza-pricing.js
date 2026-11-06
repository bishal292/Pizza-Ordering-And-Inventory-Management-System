import { Inventory } from "../db/models/InventoryModel.js";
import { isValidObjectId } from "mongoose";

export const calculatePrice = async (pizza, customizations) => {
  const invalidCustomization = () => {
    const error = new Error("Invalid or unavailable pizza customization");
    error.statusCode = 400;
    return error;
  };
  const isInventoryId = (id) => isValidObjectId(id);

  if (!pizza?.base || !["sauce", "cheese", "toppings"].every(
    (category) =>
      customizations?.[category] === undefined ||
      Array.isArray(customizations[category])
  )) {
    throw invalidCustomization();
  }

  if (pizza.base.category !== "base" || pizza.base.stock <= 0) {
    throw invalidCustomization();
  }

  if (!Number.isFinite(pizza.price) || pizza.price < 0) {
    throw invalidCustomization();
  }

  let price = pizza.price;

  if (customizations.base) {
    if (!isInventoryId(customizations.base)) throw invalidCustomization();
    const baseItem = await Inventory.findOne({
      _id: customizations.base,
      category: "base",
      stock: { $gt: 0 },
    });
    if (!baseItem) throw invalidCustomization();
    price += baseItem.price - pizza.base.price;
  }

  for (const category of ["sauce", "cheese", "toppings"]) {
    for (const itemId of customizations[category] || []) {
      if (!isInventoryId(itemId)) throw invalidCustomization();
      const item = await Inventory.findOne({
        _id: itemId,
        category: category === "toppings" ? "topping" : category,
        stock: { $gt: 0 },
      });
      if (!item) throw invalidCustomization();
      price += item.price;
    }
  }

  if (!Number.isFinite(price) || price <= 0) {
    throw invalidCustomization();
  }

  return price;
};
