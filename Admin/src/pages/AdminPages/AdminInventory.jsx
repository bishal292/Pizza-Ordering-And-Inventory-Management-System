import LoadingScreen from "@/components/LoadingScreen";
import { apiClient } from "@/utils/api-client";
import {
  ADMIN_ADD_PRODUCT,
  ADMIN_DELETE_PRODUCT,
  ADMIN_INVENTORY,
  ADMIN_UPDATE_PRODUCT,
} from "@/utils/constant";
import { useEffect, useState } from "react";
import { FaTrash } from "react-icons/fa";
import { MdCancel } from "react-icons/md";
import { toast } from "sonner";

const AdminInventory = () => {
  const [inventory, setInventory] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationItemId, setConfirmationItemId] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [sortBy, setSortBy] = useState("stock-asc");
  const [newItem, setNewItem] = useState({
    name: "",
    category: "",
    price: "",
    stock: "",
    threshold: "",
    type: "",
  });

  const [editableItemId, setEditableItemId] = useState(null);
  const [editableItem, setEditableItem] = useState({});

  useEffect(() => {
    const fetchInventory = async () => {
      setIsLoaded(false);
      try {
        const response = await apiClient.get(ADMIN_INVENTORY, {
          withCredentials: true,
        });
        if (response.status === 200) {
          setInventory(response.data);
        }
      } catch (error) {
        console.error(error);
        const status = error.response?.status;
        if (status === 404) {
          toast.error("Inventory is Empty");
        } else if (status === 500) {
          toast.error("Internal Server Error");
        } else {
          toast.error(
            error.response?.data?.message ||
              error.response?.data ||
              "Unable to reach the server. Please try again."
          );
        }
        setInventory([]);
      } finally {
        setIsLoaded(true);
      }
    };
    fetchInventory();
  }, []);
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewItem({ ...newItem, [name]: value });
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditableItem({ ...editableItem, [name]: value });
  };

  const addItem = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (
        newItem.name.trim().length <= 3 ||
        !newItem.category ||
        newItem.price === "" ||
        newItem.stock === "" ||
        newItem.threshold === "" ||
        !newItem.type
      ) {
        toast.error("Please fill all fields");
        return;
      }
      const response = await apiClient.post(
        ADMIN_ADD_PRODUCT,
        { ...newItem, name: newItem.name.trim() },
        {
          withCredentials: true,
        }
      );
      if (response.status === 201) {
        toast.success("Item Added Successfully");
        setInventory((items) => [...items, response.data.product]);
        setIsPopupOpen(false);
        setNewItem({
          name: "",
          category: "",
          price: "",
          stock: "",
          threshold: "",
          type: "",
        });
      }
    } catch (error) {
      console.error(error);
      toast.error(
        error.response?.data?.message ||
          error.response?.data ||
          "Unable to add inventory item."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteItem = async (id) => {
    setIsSubmitting(true);
    try {
      const response = await apiClient.delete(
        `${ADMIN_DELETE_PRODUCT}?id=${id}`,
        { withCredentials: true }
      );

      if (response.status === 200) {
        toast.success("Item Deleted Successfully");
        setInventory((items) => items.filter((item) => item._id !== id));
      }
    } catch (error) {
      console.error(error);
      const status = error.response?.status;
      if (status === 404) {
        toast.error("Product not found");
      } else if (status === 500) {
        toast.error("Internal Server Error");
      } else {
        toast.error(
          error.response?.data?.message ||
            error.response?.data ||
            "Unable to delete inventory item. Please try again."
        );
      }
    } finally {
      setIsSubmitting(false);
      setConfirmationItemId(null);
    }
  };

  const handleDeleteClick = (id) => {
    setConfirmationItemId(id);
  };

  const handleCancelDelete = () => {
    setConfirmationItemId(null);
  };

  const updateItem = async (id) => {
    setIsSubmitting(true);
    try {
      const originalItem = inventory.find((item) => item._id === id);
      if (!originalItem) {
        toast.error("Inventory item is no longer available.");
        return;
      }
      if (
        Number(editableItem.price) === Number(originalItem.price) &&
        Number(editableItem.stock) === Number(originalItem.stock) &&
        Number(editableItem.threshold) === Number(originalItem.threshold) &&
        editableItem.type === originalItem.type
      ) {
        toast.error("No changes detected");
        setIsSubmitting(false);
        setEditableItemId(null);
        return;
      }

      const response = await apiClient.patch(
        `${ADMIN_UPDATE_PRODUCT}?id=${id}`,
        {
          price: editableItem.price,
          stock: editableItem.stock,
          threshold: editableItem.threshold,
          type: editableItem.type,
        },
        { withCredentials: true }
      );
      if (response.status === 200) {
        toast.success("Item Updated Successfully");
        setInventory((items) =>
          items.map((item) =>
            item._id === id ? response.data.product : item
          )
        );
      }
    } catch (error) {
      console.error(error);
      toast.error(
        error.response?.data?.message ||
          error.response?.data ||
          "Unable to update inventory item."
      );
    } finally {
      setIsSubmitting(false);
      setEditableItemId(null);
    }
  };

  if (!isLoaded) {
    return <LoadingScreen message="Fetching Inventory...." />;
  }

  const filteredInventory = inventory
    .filter((item) => {
      const matchesSearch = `${item.name} ${item.category} ${item.type || ""}`
        .toLowerCase()
        .includes(search.trim().toLowerCase());
      const matchesCategory =
        categoryFilter === "all" || item.category === categoryFilter;
      const isLowStock = Number(item.stock) <= Number(item.threshold);
      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "low" && isLowStock) ||
        (stockFilter === "healthy" && !isLowStock);
      return matchesSearch && matchesCategory && matchesStock;
    })
    .sort((a, b) => {
      const sorters = {
        "stock-asc": () => Number(a.stock) - Number(b.stock),
        "stock-desc": () => Number(b.stock) - Number(a.stock),
        name: () => a.name.localeCompare(b.name),
        category: () => a.category.localeCompare(b.category),
        price: () => Number(a.price) - Number(b.price),
      };
      return sorters[sortBy]?.() || 0;
    });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 font-sans sm:px-7 lg:px-10">
      <div className="mx-auto max-w-screen-2xl">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-600">
            Stock control
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Inventory</h1>
          <p className="mt-2 text-sm text-slate-500">
            Find, monitor, and update ingredient stock.
          </p>
        </div>
        <button
          disabled={isSubmitting}
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-700"
          onClick={() => setIsPopupOpen(true)}
        >
          Add New Item
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          ["Inventory items", inventory.length, "bg-blue-50 text-blue-700"],
          [
            "Low stock",
            inventory.filter((item) => Number(item.stock) <= Number(item.threshold)).length,
            "bg-amber-50 text-amber-700",
          ],
          [
            "Healthy stock",
            inventory.filter((item) => Number(item.stock) > Number(item.threshold)).length,
            "bg-emerald-50 text-emerald-700",
          ],
        ].map(([label, count, color]) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm text-slate-500">{label}</p>
            <p className={`mt-2 inline-flex rounded-lg px-3 py-1 text-xl font-bold ${color}`}>
              {count}
            </p>
          </div>
        ))}
      </div>

      <section className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, category, or type"
          aria-label="Search inventory"
          className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
        />
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          aria-label="Filter by category"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-500"
        >
          <option value="all">All categories</option>
          <option value="cheese">Cheese</option>
          <option value="baseSize">Base size</option>
          <option value="sauce">Sauce</option>
          <option value="base">Base</option>
          <option value="topping">Topping</option>
        </select>
        <select
          value={stockFilter}
          onChange={(event) => setStockFilter(event.target.value)}
          aria-label="Filter by stock status"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-500"
        >
          <option value="all">All stock levels</option>
          <option value="low">At or below threshold</option>
          <option value="healthy">Above threshold</option>
        </select>
        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
          aria-label="Sort inventory"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-500"
        >
          <option value="stock-asc">Sort: lowest stock first</option>
          <option value="stock-desc">Sort: highest stock first</option>
          <option value="name">Sort: name</option>
          <option value="category">Sort: category</option>
          <option value="price">Sort: price</option>
        </select>
      </section>
      {inventory.length === 0 ? (
        <p className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-12 text-lg text-slate-500">
          No items in inventory
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="mb-0 min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {["Name", "Category", "Price", "Stock", "Threshold", "Status", "Type", "Actions"].map((heading) => (
                  <th key={heading} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInventory.map((item) => (
                <tr
                  key={item._id}
                  className={`transition-colors hover:bg-slate-50 ${Number(item.stock) <= Number(item.threshold) ? "bg-rose-50/50" : ""} ${editableItemId === item._id ? "bg-blue-50" : ""}`}
                >
                  {editableItemId === item._id ? (
                    <>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">
                        {item.name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 capitalize text-slate-600">
                        {item.category}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className="w-full p-2 text-center border border-gray-300 rounded"
                          type="number"
                                          min="0"
                                          step="0.01"
                          name="price"
                          value={editableItem.price}
                          onChange={handleEditInputChange}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className="w-full p-2 text-center border border-gray-300 rounded"
                          type="number"
                          min="0"
                          step="1"
                          name="stock"
                          value={editableItem.stock}
                          onChange={handleEditInputChange}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className="w-full text-center p-2 border border-gray-300 rounded"
                          type="number"
                          min="0"
                          step="1"
                          name="threshold"
                          value={editableItem.threshold}
                          onChange={handleEditInputChange}
                        />
                      </td>
                      <td className="px-4 py-3">
                        {Number(item.stock) <= Number(item.threshold) ? "Low stock" : "In stock"}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="w-full p-2 border border-gray-300 rounded"
                          name="type"
                          value={editableItem.type}
                          onChange={handleEditInputChange}
                        >
                          <option value="veg">Veg</option>
                          <option value="non-veg">Non-Veg</option>
                        </select>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-2">
                        <button
                          disabled={isSubmitting}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                          onClick={() => updateItem(item._id)}
                        >
                          Save
                        </button>
                        <button
                          disabled={isSubmitting}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700"
                          onClick={() => setEditableItemId(null)}
                        >
                          <MdCancel />
                        </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">
                        {item.name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 capitalize text-slate-600">
                        {item.category}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        ₹{Number(item.price).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {item.stock}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.threshold}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${Number(item.stock) <= Number(item.threshold) ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {Number(item.stock) <= Number(item.threshold) ? "Low stock" : "In stock"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 capitalize text-slate-600">
                        {item.type}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-2">
                        <button
                          disabled={isSubmitting}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                          onClick={() => {
                            setEditableItemId(item._id);
                            setEditableItem({ ...item });
                          }}
                        >
                          Update
                        </button>
                        <button
                          disabled={isSubmitting}
                          aria-label={`Delete ${item.name}`}
                          className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-rose-600 hover:bg-rose-50"
                          onClick={() => handleDeleteClick(item._id)}
                        >
                          <FaTrash />
                        </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {filteredInventory.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center text-sm text-slate-500">
                    No inventory items match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {/* Confirmation Overlay */}
      {confirmationItemId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold mb-4">Confirm Deletion</h2>
            <p className="mb-6">Are you sure you want to delete this item?</p>
            <div className="flex justify-end space-x-4">
              <button
                disabled={isSubmitting}
                className="bg-gray-500 text-white px-4 py-2 rounded"
                onClick={handleCancelDelete}
              >
                Cancel
              </button>
              <button
                disabled={isSubmitting}
                className="bg-red-500 text-white px-4 py-2 rounded"
                onClick={() => deleteItem(confirmationItemId)}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      {isPopupOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold mb-4">Add New Item</h2>
            <form className="space-y-4" onSubmit={addItem}>
              <div>
                <label className="block text-gray-700">Name</label>
                <input
                  className="w-full p-2 border border-gray-300 rounded"
                  type="text"
                  name="name"
                  value={newItem.name}
                  onChange={handleInputChange}
                  placeholder="Name"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700">Category</label>
                <select
                  className="w-full p-2 border border-gray-300 rounded"
                  name="category"
                  value={newItem.category}
                  onChange={handleInputChange}
                  required
                >
                  <option value="" disabled>
                    Select one of below options
                  </option>
                  <option value="cheese">Cheese</option>
                  <option value="baseSize">Base Size</option>
                  <option value="sauce">Sauce</option>
                  <option value="base">Base</option>
                  <option value="topping">Topping</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-700">Price</label>
                <input
                  className="w-full p-2 border border-gray-300 rounded"
                  type="number"
                  name="price"
                  value={newItem.price}
                  onChange={handleInputChange}
                  placeholder="Price"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700">Stock</label>
                <input
                  className="w-full p-2 border border-gray-300 rounded"
                  type="number"
                  name="stock"
                  value={newItem.stock}
                  onChange={handleInputChange}
                  placeholder="Stock"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700">Threshold</label>
                <input
                  className="w-full p-2 border border-gray-300 rounded"
                  type="number"
                  name="threshold"
                  value={newItem.threshold}
                  onChange={handleInputChange}
                  placeholder="Threshold"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700">Type</label>
                <select
                  className="w-full p-2 border border-gray-300 rounded"
                  name="type"
                  value={newItem.type}
                  onChange={handleInputChange}
                  required
                >
                  <option value="" disabled>
                    Select one of below options
                  </option>
                  <option value="veg">Veg</option>
                  <option value="non-veg">Non-Veg</option>
                </select>
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
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </main>
  );
};

export default AdminInventory;
