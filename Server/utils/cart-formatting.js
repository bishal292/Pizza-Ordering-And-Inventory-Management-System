import { Inventory } from "../db/models/InventoryModel.js";

export async function getFormattedCartItems({ cart }) {
  const baseIds = [];
  const sauceIds = [];
  const cheeseIds = [];
  const toppingIds = [];

  cart.items.forEach((item) => {
    if (item.customizations.base) baseIds.push(item.customizations.base);
    if (item.customizations.sauce) sauceIds.push(...item.customizations.sauce);
    if (item.customizations.cheese)
      cheeseIds.push(...item.customizations.cheese);
    if (item.customizations.toppings)
      toppingIds.push(...item.customizations.toppings);
  });

  const [baseMap, sauceMap, cheeseMap, toppingMap] = await Promise.all([
    Inventory.find({ _id: { $in: baseIds } }, "name price").then((items) =>
      items.reduce((acc, item) => ({ ...acc, [item._id]: item }), {})
    ),
    Inventory.find({ _id: { $in: sauceIds } }, "name").then((items) =>
      items.reduce((acc, item) => ({ ...acc, [item._id]: item.name }), {})
    ),
    Inventory.find({ _id: { $in: cheeseIds } }, "name").then((items) =>
      items.reduce((acc, item) => ({ ...acc, [item._id]: item.name }), {})
    ),
    Inventory.find({ _id: { $in: toppingIds } }, "name").then((items) =>
      items.reduce((acc, item) => ({ ...acc, [item._id]: item.name }), {})
    ),
  ]);

  return cart.items.map((item) => ({
    pizza: item.pizza,
    quantity: item.quantity,
    price: item.price,
    finalPrice: item.finalPrice,
    customizations: {
      base: item.customizations.base ? baseMap[item.customizations.base] : null,
      sauce:
        item.customizations.sauce?.map((id) => sauceMap[id]).filter(Boolean) ||
        [],
      cheese:
        item.customizations.cheese
          ?.map((id) => cheeseMap[id])
          .filter(Boolean) || [],
      toppings:
        item.customizations.toppings
          ?.map((id) => toppingMap[id])
          .filter(Boolean) || [],
    },
  }));
}
