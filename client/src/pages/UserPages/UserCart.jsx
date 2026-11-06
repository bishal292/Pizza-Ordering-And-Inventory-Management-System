import { useEffect, useState } from "react";
import useCartStore from "@/Store/cartStore";
import {
  USER_GET_CART,
  USER_REMOVE_FROM_CART,
  USER_CLEAR_CART,
  USER_PLACE_ORDER,
} from "@/utils/constant";
import { toast } from "sonner";
import { apiClient } from "@/utils/api-client";
import { useSocket } from "@/Context/SocketContext";
import { useAppStore } from "@/Store/store";
import LoadingScreen from "@/components/LoadingScreen";
import { useNavigate } from "react-router-dom";
import {
  openRazorPayScreenUI,
} from "@/utils/razorpayServices";

const UserCart = () => {
  const { userInfo } = useAppStore();
  const cart = useCartStore((state) => state.cart);
  const setCart = useCartStore((state) => state.setCart);
  const removeFromCart = useCartStore((state) => state.removeFromCart);
  const clearCart = useCartStore((state) => state.clearCart);
  const increaseQuantity = useCartStore((state) => state.increaseQuantity);
  const decreaseQuantity = useCartStore((state) => state.decreaseQuantity);
  const [totalPrice, setTotalPrice] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { socket, isConnected } = useSocket();
  const [tableNumber, setTableNumber] = useState(null);
  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false);
  const [enteredTableNumber, setEnteredTableNumber] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (Array.isArray(cart)) {
      const price = cart.reduce((acc, item) => {
        return acc + Number(item.finalPrice || 0);
      }, 0);
      setTotalPrice(price);
    }
  }, [cart]);

  useEffect(() => {
    const getCart = async () => {
      try {
        const response = await apiClient.get(USER_GET_CART, {
          withCredentials: true,
        });

        if (response.status === 200) {
          setCart(response.data.items);
        }
      } catch (error) {
        console.error("Error fetching cart", error);
        toast.error(
          error.response?.data?.message ||
            error.response?.message ||
            "Failed to fetch cart."
        );
      } finally {
        setIsLoading(false);
      }
    };
    getCart();
  }, [setCart]);

  const removeItem = async (pizzaId, index) => {
    try {
      setIsSubmitting(true);
      const response = await apiClient.delete(
        `${USER_REMOVE_FROM_CART}?id=${pizzaId}&idx=${index}`,
        {
          withCredentials: true,
        }
      );
      if (response.status === 200) {
        removeFromCart(index);
        toast.success("Item removed from cart successfully");
      }
    } catch (error) {
      console.error("Error removing item from cart", error);
      toast.error(
        error.response?.data?.message ||
          error.response?.message ||
          "Failed to remove item."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleIncreaseQuantity = (pizzaId, index) => {
    if (isConnected) {
      socket.timeout(10000).emit(
        "increase-quantity",
        { pizzaId, index },
        (timeoutError, response) => {
          if (timeoutError) {
            toast.error("The server did not respond. Please try again.");
          } else if (response.status === "ok") {
            const { newQuantity } = response.data;
            increaseQuantity(index, newQuantity);
          } else {
            toast.error(response.error);
          }
        }
      );
    } else {
      toast.error("Connection lost. Please reconnect before changing quantities.");
    }
  };

  const handleDecreaseQuantity = (pizzaId, index) => {
    if (isConnected) {
      socket.timeout(10000).emit(
        "decrease-quantity",
        { pizzaId, index },
        (timeoutError, response) => {
          if (timeoutError) {
            toast.error("The server did not respond. Please try again.");
          } else if (response.status === "ok") {
            const { newQuantity } = response.data;
            decreaseQuantity(index, newQuantity);
          } else {
            toast.error(response.error);
          }
        }
      );
    } else {
      toast.error("Connection lost. Please reconnect before changing quantities.");
    }
  };

  const handleClearCart = async () => {
    try {
      setIsSubmitting(true);
      const response = await apiClient.delete(USER_CLEAR_CART, {
        withCredentials: true,
      });
      if (response.status === 200) {
        clearCart();
        toast.success("Cart cleared successfully");
      }
    } catch (error) {
      console.error("Error clearing cart", error);
      toast.error(
        error.response?.data?.message ||
          error.response?.message ||
          "Failed to clear cart."
      );
    } finally {
      setIsSubmitting(false);
      setIsDialogOpen(false);
    }
  };

  const handlePlaceOrder = async (selectedTableNumber = tableNumber) => {
    if (!selectedTableNumber) {
      setIsTableDialogOpen(true);
      return;
    }

    let createdOrderId;
    try {
      setIsSubmitting(true);
      const response = await apiClient.post(
        USER_PLACE_ORDER,
        { tableNo: Number(selectedTableNumber) },
        {
          withCredentials: true,
        }
      );

      if (response.status === 200) {
        clearCart();
        toast.error(response.data?.message || "Your cart is empty.");
        return;
      }

      if (response.status === 201) {
        createdOrderId = response.data._id;
        const order = response.data.order;
        clearCart();
        await openRazorPayScreenUI(userInfo, order);
        toast("Complete payment to confirm your order.");
      }
    } catch (error) {
      console.error(error);
      const failedOrderId = error.response?.data?.orderId || createdOrderId;
      if (failedOrderId) {
        navigate(`/pizzeria/order/${failedOrderId}`);
      }
      const errorMessage =
        error.response?.data?.message ||
        error.response?.message ||
        error.response?.data ||
        "Some unknown Error Occured";

      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmTableNumber = () => {
    const parsedTableNumber = Number(enteredTableNumber);
    if (!Number.isInteger(parsedTableNumber) || parsedTableNumber < 1) {
      toast.error("Invalid table number. Please try again.");
      return;
    }
    setTableNumber(parsedTableNumber);
    setIsTableDialogOpen(false);
    handlePlaceOrder(parsedTableNumber);
  };

  if (isLoading) {
    return <LoadingScreen message="Fetching your cart..." />;
  }

  return (
    <div className="mx-auto min-h-[70vh] max-w-7xl px-4 py-8 font-sans sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">Almost there</p>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-4xl">Your Cart</h1>
        <p className="mt-2 text-slate-600">Review your pizzas and quantities before placing your order.</p>
      </div>

      {!Array.isArray(cart) || cart.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-2xl text-orange-600">+</div>
          <h2 className="text-xl font-bold text-slate-900">Your cart is empty</h2>
          <p className="mt-2 text-slate-600">Add a pizza from the menu and it will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {cart &&
            cart.map((item, index) => {
              const customizations = item.customizations || {};
              const pizza = item.pizza || {};
              const customized =
                customizations.base ||
                (customizations.sauce || []).length > 0 ||
                (customizations.cheese || []).length > 0 ||
                (customizations.toppings || []).length > 0;

              return (
                <div
                  key={`${pizza._id || "pizza"}-${index}`}
                  className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  {pizza.image ? (
                    <img src={pizza.image} alt={pizza.name || "Pizza"} className="h-48 w-full object-cover" />
                  ) : (
                    <div className="flex h-48 items-center justify-center bg-orange-50 text-slate-400">Image unavailable</div>
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-xl font-bold text-slate-900">
                        {pizza.name || "Unavailable pizza"} {customized && <span className="text-sm font-medium text-orange-600">Customized</span>}
                      </h2>
                      <span className="shrink-0 rounded-full bg-orange-50 px-3 py-1 text-sm font-bold text-orange-700">₹{Number(item.finalPrice || 0).toFixed(2)}</span>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-slate-600">
                      <p><b className="text-slate-800">Base:</b> {pizza.base?.name || "Standard"}</p>
                      <p><b className="text-slate-800">Sauce:</b> {(pizza.sauce || []).map((s) => s.name).join(", ") || "None"}</p>
                      <p><b className="text-slate-800">Cheese:</b> {(pizza.cheese || []).map((c) => c.name).join(", ") || "None"}</p>
                      <p><b className="text-slate-800">Toppings:</b> {(pizza.toppings || []).map((t) => t.name).join(", ") || "None"}</p>
                    </div>
                    {customized && (
                      <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                        <b className="text-slate-800">Your customizations</b>
                        <ul className="mt-1 list-inside list-disc">
                          {customizations.base && <li>Base: {customizations.base.name}</li>}
                          {(customizations.sauce || []).length > 0 && <li>Sauce: {customizations.sauce.map((s) => s.name).join(", ")}</li>}
                          {(customizations.cheese || []).length > 0 && <li>Cheese: {customizations.cheese.map((c) => c.name).join(", ")}</li>}
                          {(customizations.toppings || []).length > 0 && <li>Toppings: {customizations.toppings.map((t) => t.name).join(", ")}</li>}
                        </ul>
                      </div>
                    )}
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
                      <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
                        <button
                          className="h-9 w-9 rounded-lg text-lg font-bold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={`Decrease ${pizza.name || "pizza"} quantity`}
                          onClick={() => handleDecreaseQuantity(pizza._id, index)}
                          disabled={isSubmitting || item.quantity <= 1}
                        >
                          −
                        </button>
                        <span className="min-w-10 text-center font-semibold text-slate-900">{item.quantity}</span>
                        <button
                          className="h-9 w-9 rounded-lg text-lg font-bold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={`Increase ${pizza.name || "pizza"} quantity`}
                          onClick={() => handleIncreaseQuantity(pizza._id, index)}
                          disabled={isSubmitting || item.quantity >= 10}
                        >
                          +
                        </button>
                      </div>
                      <button
                        className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                        onClick={() => removeItem(pizza._id, index)}
                        disabled={isSubmitting}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {Array.isArray(cart) && cart.length > 0 && (
        <div className="mt-8 flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-sm text-slate-500">{cart.length} {cart.length === 1 ? "item" : "items"} in your order</p>
            <h2 className="mt-1 text-2xl font-extrabold text-slate-900">Total: ₹{Number(totalPrice).toFixed(2)}</h2>
            <p className="mt-1 text-xs text-slate-500">Final amount is validated by the server at checkout.</p>
          </div>
          <div className="flex flex-wrap gap-3 sm:justify-end">
          {cart.length >= 3 && (
            <>
              <button
                className="rounded-xl border border-red-200 px-4 py-3 font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                onClick={() => setIsDialogOpen(true)}
                disabled={isSubmitting}
              >
                Clear Cart
              </button>
              {isDialogOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
                  <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
                    <h2 className="text-xl font-bold mb-4">
                      Confirm Clear Cart
                    </h2>
                    <p>Are you sure you want to clear the cart?</p>
                    <div className="mt-4 flex justify-end space-x-4">
                      <button
                        className="rounded-lg bg-slate-100 px-4 py-2 font-semibold text-slate-700"
                        onClick={() => setIsDialogOpen(false)}
                      >
                        Cancel
                      </button>
                      <button
                        className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
                        onClick={handleClearCart}
                        disabled={isSubmitting}
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <button
            className="rounded-xl bg-orange-600 px-6 py-3 font-bold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => handlePlaceOrder()}
            disabled={isSubmitting}
          >
            Place Order
          </button>
          </div>
        </div>
      )}
      {isTableDialogOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <form
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onSubmit={(event) => {
              event.preventDefault();
              confirmTableNumber();
            }}
          >
            <h2 className="text-xl font-bold text-slate-900">Enter Table Number</h2>
            <p className="mt-2 text-sm text-slate-600">
              We’ll include this number with your order.
            </p>
            <label
              htmlFor="table-number"
              className="mt-4 block text-sm font-semibold text-slate-700"
            >
              Table number
            </label>
            <input
              id="table-number"
              type="number"
              min="1"
              step="1"
              required
              autoFocus
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              placeholder="e.g. 12"
              value={enteredTableNumber}
              onChange={(e) => setEnteredTableNumber(e.target.value)}
            />
            <div className="mt-5 flex justify-end space-x-4">
              <button
                type="button"
                className="rounded-lg bg-slate-100 px-4 py-2 font-semibold text-slate-700"
                onClick={() => setIsTableDialogOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Placing order..." : "Continue to payment"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default UserCart;
