import { Inventory } from "../db/models/InventoryModel.js";

export const calculatePrice = async (pizza, customizations) => {
  let price = pizza.price;

  if (customizations.base) {
    const baseItem = await Inventory.findById(customizations.base);
    if (baseItem) price += baseItem.price - pizza.base.price;
  }

  for (const category of ["sauce", "cheese", "toppings"]) {
    for (const itemId of customizations[category] || []) {
      const item = await Inventory.findById(itemId);
      if (item) price += item.price;
    }
  }

  return price;
};
