import mongoose from "mongoose";

const pizzaSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String, required: true },
  description: { type: String, required: true },
  size: { type: mongoose.Schema.Types.ObjectId ,ref:'Inventory', required: true },
  base: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
  sauce: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Inventory'}],
  cheese: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' }],
  toppings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' }],
  price: { type: Number, required: true, min: 0.01 },
  status: { type: String, enum: ['available', 'unavailable'], default: 'available' }
}, { timestamps: true });

// Pre-save hook to update the status based on the stock of the items used
pizzaSchema.pre('save', async function(next) {
  const pizza = this;
  
  // Allow admin to manually set the pizza status to 'unavailable'
  if (pizza.isModified('status') && pizza.status === 'unavailable') {
    return next();
  }

  const inventoryItems = [ pizza?.base, ...pizza?.sauce, ...pizza?.cheese, ...pizza?.toppings];
  
  try {
    const Inventory = mongoose.model("Inventory");
    const items = await Inventory.find({ _id: { $in: inventoryItems } });
    const isAvailable = items.every(item => item.status === 'available');
    pizza.status = isAvailable ? 'available' : 'unavailable';
    next();
  } catch (error) {
    next(error);
  }
});

export const Pizza = mongoose.model("Pizza", pizzaSchema);
