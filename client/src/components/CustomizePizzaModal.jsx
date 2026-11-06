import React, { useState, useEffect } from "react";
import { apiClient } from "@/utils/api-client";
import { OPTIONS_ENDPOINT } from "@/utils/constant";

const CustomizePizzaModal = ({ pizza, onSave, onClose }) => {
  const [customizedPizza, setCustomizedPizza] = useState({
    ...pizza,
    customizations: {
      base: pizza.base._id,
      sauce: [],
      cheese: [],
      toppings: [],
    },
  });
  const [price, setPrice] = useState(pizza.price);
  const [options, setOptions] = useState({
    bases: [],
    sauces: [],
    cheeses: [],
    toppings: [],
  });
  const [error, setError] = useState("");

  useEffect(() => {
    fetchOptions();
    console.log("Pizza", pizza);
  }, []);
  useEffect(() => {
    calculatePrice();
  }, [customizedPizza]);

  const fetchOptions = async () => {
    try {
      const response = await apiClient.get(OPTIONS_ENDPOINT);
      if (response.status === 200) {
        setOptions(response.data);
      }
    } catch (error) {
      console.error("Error fetching options", error);
    }
  };

  const handleChange = (event, field) => {
    const { value, checked } = event.target;
    setCustomizedPizza((prev) => {
      if (field === "base") {
        const originalBasePrice =
          options.bases.find((base) => base.name === pizza.base.name)?.price ||
          0;
        const newBasePrice =
          options.bases.find((base) => base.name === value)?.price || 0;
        const priceDifference = newBasePrice - originalBasePrice;
        setPrice((prevPrice) => prevPrice + priceDifference);
        return {
          ...prev,
          customizations: { ...prev.customizations, base: value },
        };
      } else {
        const updatedField = checked
          ? [...prev.customizations[field], value]
          : prev.customizations[field].filter((item) => item !== value);
        return {
          ...prev,
          customizations: { ...prev.customizations, [field]: updatedField },
        };
      }
    });
  };

  const calculatePrice = () => {
    let newPrice = pizza.price;
    const originalBasePrice =
      options.bases.find((base) => base._id === pizza.base._id)?.price || 0;
    const newBasePrice =
      options.bases.find(
        (base) => base._id === customizedPizza.customizations.base
      )?.price || 0;
    const priceDifference = newBasePrice - originalBasePrice;
    newPrice += priceDifference;

    customizedPizza.customizations.sauce.forEach((sauceId) => {
      const saucePrice =
        options.sauces.find((sauce) => sauce._id === sauceId)?.price || 0;
      newPrice += saucePrice;
    });

    customizedPizza.customizations.cheese.forEach((cheeseId) => {
      const cheesePrice =
        options.cheeses.find((cheese) => cheese._id === cheeseId)?.price || 0;
      newPrice += cheesePrice;
    });

    customizedPizza.customizations.toppings.forEach((toppingId) => {
      const toppingPrice =
        options.toppings.find((topping) => topping._id === toppingId)?.price ||
        0;
      newPrice += toppingPrice;
    });

    setPrice(newPrice);
  };

  const handleSave = () => {
    if (customizedPizza.customizations.base === pizza.base.name) {
      delete customizedPizza.customizations.base;
    }
    if (customizedPizza.customizations.sauce.length === 0) {
      delete customizedPizza.customizations.sauce;
    }
    if (customizedPizza.customizations.cheese.length === 0) {
      delete customizedPizza.customizations.cheese;
    }
    if (customizedPizza.customizations.toppings.length === 0) {
      delete customizedPizza.customizations.toppings;
    }
    // Convert empty object to empty array
    if (Object.keys(customizedPizza.customizations).length === 0) {
      customizedPizza.customizations = {};
    }
    customizedPizza.price = price;
    onSave(customizedPizza);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ">
      <div className="bg-white p-6 rounded shadow-lg w-11/12 max-w-4xl h-5/6 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center border-b pb-4 mb-4 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold">Customize {pizza.name}</h2>
          <button className="text-red-500 font-bold text-lg" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-6 overscroll-contain">
          {/* Base */}
          <div>
            <h3 className="text-lg font-bold mb-2">Base</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {options.bases.map((base) => (
                <label key={base._id} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="base"
                    value={base._id}
                    required
                    checked={customizedPizza.customizations.base === base._id}
                    onChange={(e) => handleChange(e, "base")}
                  />
                  {base.name} | ₹{base?.price}
                </label>
              ))}
            </div>
          </div>

          {/* Sauce */}
          <div>
            <h3 className="text-lg font-bold mb-2">Extra Sauce</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {options.sauces.map((sauce) => (
                <label key={sauce._id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    value={sauce._id}
                    checked={customizedPizza.customizations.sauce.includes(
                      sauce._id
                    )}
                    onChange={(e) => handleChange(e, "sauce")}
                  />
                  {sauce.name} | ₹{sauce.price}
                </label>
              ))}
            </div>
          </div>

          {/* Cheese */}
          <div>
            <h3 className="text-lg font-bold mb-2">Extra Cheese</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {options.cheeses.map((cheese) => (
                <label key={cheese._id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    value={cheese._id}
                    checked={customizedPizza.customizations.cheese.includes(
                      cheese._id
                    )}
                    onChange={(e) => handleChange(e, "cheese")}
                  />
                  {cheese.name} | ₹{cheese.price}
                </label>
              ))}
            </div>
          </div>

          {/* Toppings */}
          <div>
            <h3 className="text-lg font-bold mb-2">Extra Toppings</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {options.toppings.map((topping) => (
                <label key={topping._id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    value={topping._id}
                    checked={customizedPizza.customizations.toppings.includes(
                      topping._id
                    )}
                    onChange={(e) => handleChange(e, "toppings")}
                  />
                  {topping.name} | ₹{topping.price}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center border-t pt-4 mt-4 sticky bottom-0 bg-white z-10">
          <h3 className="text-lg font-bold">Price: ₹{price.toFixed(2)}</h3>
          <div>
            <button
              className="bg-green-500 text-white px-4 py-2 rounded mr-2"
              onClick={handleSave}
            >
              Save
            </button>
            <button
              className="bg-red-500 text-white px-4 py-2 rounded"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomizePizzaModal;
