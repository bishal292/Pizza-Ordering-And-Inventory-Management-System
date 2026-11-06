import { useEffect, useState } from "react";
import { apiClient } from "@/utils/api-client";
import { FaTrash } from "react-icons/fa";
import { toast } from "sonner";
import {
  ADMIN_ADD_PIZZA,
  ADMIN_DELETE_PIZZA,
  ADMIN_GET_PIZZAS,
  ADMIN_INVENTORY,
} from "@/utils/constant";
import UpdatePizza from "./UpdatePizza";
import { Link } from "react-router-dom";
import LoadingScreen from "@/components/LoadingScreen";
import {
  handleImageUploadCloudinary,
} from "@/Services/ImageUpload.service";

const AdminPizza = () => {
  const [pizzas, setPizzas] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdateScreenOpen, setIsUpdateScreenOpen] = useState(false);
  const [isDeletePopupOpen, setIsDeletePopupOpen] = useState(false);
  const [pizzaToDelete, setPizzaToDelete] = useState(null);
  const [newPizza, setNewPizza] = useState({
    name: "",
    image: null,
    description: "",
    base: "",
    size: "",
    sauce: [],
    cheese: [],
    toppings: [],
    price: "",
  });

  const [editablePizza, setEditablePizza] = useState({});

  useEffect(() => {
    const fetchPizzas = async () => {
      setIsLoaded(false);
      try {
        const response = await apiClient.get(ADMIN_GET_PIZZAS, {
          withCredentials: true,
        });
        if (response.status === 200) {
          setPizzas(response.data);
        }
      } catch {
        toast.error("Error fetching pizzas");
      } finally {
        setIsLoaded(true);
      }
    };

    const fetchInventory = async () => {
      try {
        const response = await apiClient.get(ADMIN_INVENTORY, {
          withCredentials: true,
        });
        if (response.status === 200) {
          setInventory(response.data);
        }
      } catch {
        toast.error("Error fetching inventory");
      }
    };

    fetchPizzas();
    fetchInventory();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewPizza({ ...newPizza, [name]: value });
  };

  const handleFileChange = async (e) => {
    setNewPizza({ ...newPizza, image: e.target.files[0] });
  };

  const handleCheckboxChange = (e) => {
    const { name, value, checked } = e.target;
    if (checked) {
      setNewPizza({ ...newPizza, [name]: [...newPizza[name], value] });
    } else {
      setNewPizza({
        ...newPizza,
        [name]: newPizza[name].filter((item) => item !== value),
      });
    }
  };

  const addPizza = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const cloudResponse = await handleImageUploadCloudinary(newPizza.image);

      if(!cloudResponse) {
        toast.error("Error uploading image");
        return;
      }

      const response = await apiClient.post(
        ADMIN_ADD_PIZZA,
        { ...newPizza, image: cloudResponse },
        {
        withCredentials: true,
        }
      );
      if (response.status === 201) {
        toast.success("Pizza Added Successfully");
        setPizzas((current) => [response.data.pizza, ...current]);
        setIsPopupOpen(false);
        setNewPizza({
          name: "",
          image: null,
          description: "",
          size: "",
          base: "",
          sauce: [],
          cheese: [],
          toppings: [],
          price: "",
        });
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.response?.data ||
          "Unable to add pizza. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const deletePizza = async () => {
    setIsSubmitting(true);
    try {
      const response = await apiClient.delete(
        `${ADMIN_DELETE_PIZZA}?id=${pizzaToDelete}`,
        {
          withCredentials: true,
        }
      );
      if (response.status === 200) {
        toast.success("Pizza Deleted Successfully");
        setPizzas(pizzas.filter((pizza) => pizza._id !== pizzaToDelete));
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.response?.data ||
          "Unable to delete pizza. Please try again."
      );
    } finally {
      setIsDeletePopupOpen(false);
      setIsSubmitting(false);
    }
  };

  const handleUpdate = (updatedPizza) => {
    setPizzas(
      pizzas.map((pizza) =>
        pizza._id === updatedPizza._id ? updatedPizza : pizza
      )
    );
    setIsUpdateScreenOpen(false);
    setEditablePizza({});
  };

  if (!isLoaded) {
    return <LoadingScreen message="Fetching Pizzas" />;
  }

  return (
    <main className="min-h-full bg-[#faf8f5] px-4 py-6 font-sans sm:px-7 sm:py-9">
      <div className="mx-auto max-w-7xl">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-700">Menu management</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-stone-900">Pizzas</h1>
          <p className="mt-1 text-sm text-stone-500">Manage recipes, availability, and menu pricing.</p>
        </div>
        <button
          type="button"
          disabled={isSubmitting}
          className="rounded-lg bg-orange-600 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:opacity-60"
          onClick={() => setIsPopupOpen(true)}
        >
          Add New Pizza
        </button>
      </div>
      {isUpdateScreenOpen && (
        <UpdatePizza
          pizza={editablePizza}
          inventory={inventory}
          onClose={() => {
          setIsUpdateScreenOpen(false);
          setEditablePizza({});
          }}
          onUpdate={handleUpdate}
        />
      )}
      {pizzas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
          <h2 className="text-lg font-semibold text-stone-800">No pizzas in the menu yet</h2>
          <p className="mt-1 text-sm text-stone-500">Add a pizza to start building your menu.</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {pizzas.map((pizza) => (
          <div
            key={pizza._id}
            className="group overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <Link to={`/admin/pizza/${pizza._id}`}>
              <img
                src={`${pizza.image}`}
                alt={pizza.name}
                className="h-52 w-full bg-stone-100 object-cover transition duration-300 group-hover:scale-[1.02]"
                onError={(event) => {
                  event.currentTarget.style.visibility = "hidden";
                }}
              />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-stone-900">{pizza.name}</h2>
                    <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-stone-500">
                      {pizza.description}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                    pizza.status === "available"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    {pizza.status || "Unavailable"}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-4">
                  <span className="text-sm text-stone-500">{pizza?.size?.name || "Size not set"}</span>
                  <span className="text-lg font-bold text-stone-900">₹{Number(pizza.price).toFixed(2)}</span>
                </div>
              </div>
            </Link>
            <div className="flex gap-2 px-5 pb-5">
              <button
                type="button"
                className="flex-1 rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
                onClick={() => {
                  setEditablePizza(pizza);
                  setIsUpdateScreenOpen(true);
                }}
              >
                Update
              </button>
              <button
                type="button"
                aria-label={`Delete ${pizza.name}`}
                className="rounded-lg border border-red-200 px-4 py-2 text-red-700 transition hover:bg-red-50"
                onClick={() => {
                  setPizzaToDelete(pizza._id);
                  setIsDeletePopupOpen(true);
                }}
              >
                <FaTrash />
              </button>
            </div>
          </div>
        ))}
      </div>
      )}
      {isPopupOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
            <h2 className="text-xl font-semibold mb-4">Add New Pizza</h2>
            <form className="space-y-4" onSubmit={addPizza}>
              <div>
                <label className="block text-gray-700">Name</label>
                <input
                  className="w-full p-2 border border-gray-300 rounded"
                  type="text"
                  name="name"
                  value={newPizza.name}
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
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700">Description</label>
                <textarea
                  className="w-full p-2 border border-gray-300 rounded"
                  name="description"
                  value={newPizza.description}
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
                  value={newPizza.size}
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
                  value={newPizza.base}
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
                          checked={newPizza.sauce.includes(item._id)}
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
                          checked={newPizza.cheese.includes(item._id)}
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
                          checked={newPizza.toppings.includes(item._id)}
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
                  value={newPizza.price}
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
                  onClick={() => setIsPopupOpen(false)}
                >
                  Cancel
                </button>
                <button
                  disabled={isSubmitting}
                  className="bg-green-500 text-white px-4 py-2 rounded"
                  type="submit"
                >
                  Add Pizza
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isDeletePopupOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold mb-4">Confirm Deletion</h2>
            <p>Are you sure you want to delete this pizza?</p>
            <div className="flex justify-end space-x-4 mt-4">
              <button
                className="bg-gray-500 text-white px-4 py-2 rounded"
                onClick={() => setIsDeletePopupOpen(false)}
              >
                Cancel
              </button>
              <button
                className="bg-red-500 text-white px-4 py-2 rounded"
                onClick={deletePizza}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </main>
  );
};

export default AdminPizza;
