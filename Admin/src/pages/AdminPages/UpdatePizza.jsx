import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { ADMIN_UPDATE_PIZZA } from "@/utils/constant";
import { apiClient } from "@/utils/api-client";
import { handleImageUploadCloudinary } from "@/Services/ImageUpload.service";

const getId = (value) => value?._id || value || "";

const UpdatePizza = ({ pizza, inventory, onClose, onUpdate }) => {
  const [updatedPizza, setUpdatedPizza] = useState({
    name: pizza?.name || "",
    image: null,
    description: pizza?.description || "",
    size: getId(pizza?.size),
    base: getId(pizza?.base),
    sauce: (pizza?.sauce || []).map(getId),
    cheese: (pizza?.cheese || []).map(getId),
    toppings: (pizza?.toppings || []).map(getId),
    price: pizza?.price ?? "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isSubmitting) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSubmitting, onClose]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUpdatedPizza({ ...updatedPizza, [name]: value });
  };

  const handleFileChange = (e) => {
    setUpdatedPizza({ ...updatedPizza, image: e.target.files[0] });
  };

  const handleCheckboxChange = (e) => {
    const { name, value, checked } = e.target;
    if (checked) {
      setUpdatedPizza({ ...updatedPizza, [name]: [...updatedPizza[name], value] });
    } else {
      setUpdatedPizza({
        ...updatedPizza,
        [name]: updatedPizza[name].filter((item) => item !== value),
      });
    }
  };

  const updatePizza = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = { ...updatedPizza };
      if (payload.image) {
        payload.image = await handleImageUploadCloudinary(payload.image);
      } else {
        delete payload.image;
      }
      const response = await apiClient.patch(`${ADMIN_UPDATE_PIZZA}?id=${pizza._id}`, payload, {
        withCredentials: true,
      });
      if (response.status === 200) {
        toast.success("Pizza Updated Successfully");
        onUpdate(response.data.pizza);
      }
    } catch (error) {
      console.error("Error updating pizza:", error);
      toast.error(error.response?.data?.message || error.response?.data || "Something Went Wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-pizza-title"
        className="my-auto max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="update-pizza-title" className="text-xl font-semibold mb-4">Update Pizza</h2>
        {pizza?.image && (
          <img
            src={pizza.image}
            alt={`${pizza.name} current`}
            className="mb-4 h-40 w-full rounded-xl object-cover"
          />
        )}
        <form className="space-y-4" onSubmit={updatePizza}>
          <div>
            <label className="block text-gray-700">Name</label>
            <input
              className="w-full p-2 border border-gray-300 rounded"
              type="text"
              name="name"
              value={updatedPizza.name}
              onChange={handleInputChange}
              placeholder="Name"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700">Image</label>
            <input
              className="w-full p-2 border border-gray-300 rounded"
              type="file"
              accept="Image/*"
              name="image"
              onChange={handleFileChange}
            />
          </div>
          <div>
            <label className="block text-gray-700">Description</label>
            <textarea
              className="w-full p-2 border border-gray-300 rounded"
              name="description"
              value={updatedPizza.description}
              onChange={handleInputChange}
              placeholder="Description"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700">Size</label>
            <select
              className="w-full p-2 border border-gray-300 rounded"
              name="size"
              value={updatedPizza.size}
              onChange={handleInputChange}
              required
            >
              <option value="" disabled>
                Select one of the item
              </option>
              {inventory
                .filter((item) => item.category === "baseSize")
                .map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-700">Base</label>
            <select
              className="w-full p-2 border border-gray-300 rounded"
              name="base"
              value={updatedPizza.base}
              onChange={handleInputChange}
              required
            >
              <option value="" disabled>
                Select one of the item
              </option>
              {inventory
                .filter((item) => item.category === "base")
                .map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-700">Sauce</label>
            <div className="flex flex-wrap">
              {inventory
                .filter((item) => item.category === "sauce")
                .map((item) => (
                  <label key={item._id} className="mr-4">
                    <input
                      type="checkbox"
                      name="sauce"
                      value={item._id}
                      checked={updatedPizza.sauce.includes(item._id)}
                      onChange={handleCheckboxChange}
                    />
                    {item.name}
                  </label>
                ))}
            </div>
          </div>
          <div>
            <label className="block text-gray-700">Cheese</label>
            <div className="flex flex-wrap">
              {inventory
                .filter((item) => item.category === "cheese")
                .map((item) => (
                  <label key={item._id} className="mr-4">
                    <input
                      type="checkbox"
                      name="cheese"
                      value={item._id}
                      checked={updatedPizza.cheese.includes(item._id)}
                      onChange={handleCheckboxChange}
                    />
                    {item.name}
                  </label>
                ))}
            </div>
          </div>
          <div>
            <label className="block text-gray-700">Toppings</label>
            <div className="flex flex-wrap">
              {inventory
                .filter((item) => item.category === "topping")
                .map((item) => (
                  <label key={item._id} className="mr-4">
                    <input
                      type="checkbox"
                      name="toppings"
                      value={item._id}
                      checked={updatedPizza.toppings.includes(item._id)}
                      onChange={handleCheckboxChange}
                    />
                    {item.name}
                  </label>
                ))}
            </div>
          </div>
          <div>
            <label className="block text-gray-700">Price</label>
            <input
              className="w-full p-2 border border-gray-300 rounded"
              type="number"
              name="price"
              value={updatedPizza.price}
              onChange={handleInputChange}
              placeholder="Price"
              required
            />
          </div>
          <div className="flex justify-end space-x-4">
            <button
              disabled={isSubmitting}
              className="bg-gray-500 text-white px-4 py-2 rounded"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              disabled={isSubmitting}
              className="bg-green-500 text-white px-4 py-2 rounded"
              type="submit"
            >
              Update Pizza
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default UpdatePizza;
