import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import LoadingScreen from "@/components/LoadingScreen";
import { useAppStore } from "@/Store/store";
import { apiClient } from "@/utils/api-client";
import { USER_CANCEL_ORDER, USER_GET_ORDER_DETAILS } from "@/utils/constant";
import { handleCompletePayment } from "@/utils/razorpayServices";

const ingredientNames = (items) =>
  (items || []).map((item) => item?.name || item).filter(Boolean).join(", ");

const statusColor = {
  pending: "bg-amber-100 text-amber-800",
  placed: "bg-blue-100 text-blue-800",
  preparing: "bg-orange-100 text-orange-800",
  prepared: "bg-violet-100 text-violet-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
};

const OrderDetails = () => {
  const { userInfo } = useAppStore();
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchOrder = async () => {
      setIsLoading(true);
      setLoadError("");
      try {
        const response = await apiClient.get(
          `${USER_GET_ORDER_DETAILS}?id=${encodeURIComponent(orderId)}`
        );
        if (active) setOrder(response.data);
      } catch (error) {
        if (active) {
          setOrder(null);
          setLoadError(
            error.response?.status === 404
              ? "This order could not be found in your account."
              : error.response?.data?.message ||
                  error.response?.data ||
                  "We could not load this order. Please try again."
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    fetchOrder();
    return () => {
      active = false;
    };
  }, [orderId]);

  const handleCancelOrder = async () => {
    setIsSubmitting(true);
    try {
      const response = await apiClient.post(
        `${USER_CANCEL_ORDER}?id=${encodeURIComponent(orderId)}`
      );
      setOrder((current) => ({ ...current, status: "cancelled" }));
      toast.success(
        typeof response.data === "string"
          ? response.data
          : response.data?.message || "Order cancelled"
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.response?.data ||
          "Unable to cancel this order. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <LoadingScreen message="Loading your order..." />;

  if (loadError || !order) {
    return (
      <main className="min-h-[65vh] bg-[#faf7f2] px-4 py-12">
        <section className="mx-auto max-w-xl rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-stone-900">Order unavailable</h1>
          <p className="mt-2 text-sm text-stone-600">
            {loadError || "We could not find this order."}
          </p>
          <Link
            to="/pizzeria/orders"
            className="mt-6 inline-flex rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Back to your orders
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf7f2] px-4 py-7 sm:px-7 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/pizzeria/orders"
          className="text-sm font-semibold text-orange-800 hover:text-orange-950"
        >
          ← All orders
        </Link>
        <section className="mt-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-100 pb-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-700">
                Order details
              </p>
              <h1 className="mt-1 text-2xl font-bold text-stone-900 sm:text-3xl">
                Order #{order.dailyOrderId || order.orderId}
              </h1>
              <p className="mt-2 text-sm text-stone-500">
                Table {order.tableNo ?? "—"} ·{" "}
                {order.createdAt
                  ? new Date(order.createdAt).toLocaleString()
                  : "Date unavailable"}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                statusColor[order.status] || "bg-stone-100 text-stone-700"
              }`}
            >
              {order.status || "Status unavailable"}
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {(order.items || []).map((item, index) => {
              const pizza = item.pizza || {};
              const customizations = item.customizations || {};
              const extras = [
                ["Base", customizations.base],
                ["Sauce", customizations.sauce],
                ["Cheese", customizations.cheese],
                ["Toppings", customizations.toppings],
              ].filter(([, values]) =>
                Array.isArray(values) ? values.length > 0 : Boolean(values)
              );
              const hasExtras = extras.length > 0;
              return (
                <article
                  key={`${pizza._id || pizza.pizzaId || index}-${index}`}
                  className="flex flex-col gap-4 rounded-xl border border-stone-200 p-4 sm:flex-row sm:p-5"
                >
                  {pizza.image && (
                    <img
                      src={pizza.image}
                      alt={pizza.name || "Pizza"}
                      className="h-40 w-full rounded-lg bg-stone-100 object-cover sm:h-32 sm:w-40"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h2 className="text-lg font-bold text-stone-900">
                          {pizza.name || "Pizza details unavailable"}
                        </h2>
                        <p className="mt-1 text-sm text-stone-500">
                          Quantity: {item.quantity}
                        </p>
                      </div>
                      <p className="font-bold text-stone-900">
                        ₹{Number(item.finalPrice || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-stone-600">
                      <p>
                        <span className="font-semibold text-stone-800">Base:</span>{" "}
                        {customizations.base?.name || pizza.base?.name || "—"}
                      </p>
                      <p>
                        <span className="font-semibold text-stone-800">Recipe:</span>{" "}
                        {[ingredientNames(pizza.sauce), ingredientNames(pizza.cheese), ingredientNames(pizza.toppings)]
                          .filter(Boolean)
                          .join(" · ") || "No additional ingredients"}
                      </p>
                      {hasExtras && (
                        <p className="break-words">
                          <span className="font-semibold text-stone-800">Customizations:</span>{" "}
                          {extras
                            .map(([label, values]) =>
                              `${label}: ${
                                Array.isArray(values)
                                  ? ingredientNames(values)
                                  : values?.name || values
                              }`
                            )
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-6 flex flex-col gap-5 border-t border-stone-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-stone-500">Order total</p>
              <p className="text-2xl font-extrabold text-stone-900">
                ₹{Number(order.totalPrice || 0).toFixed(2)}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {order.status === "pending" && (
                <button
                  type="button"
                  onClick={() =>
                    handleCompletePayment(userInfo, orderId, setIsSubmitting)
                  }
                  disabled={isSubmitting}
                  className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                >
                  Complete payment
                </button>
              )}
              {["pending", "placed"].includes(order.status) && (
                <button
                  type="button"
                  onClick={handleCancelOrder}
                  disabled={isSubmitting}
                  className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  {isSubmitting ? "Please wait..." : "Cancel order"}
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default OrderDetails;
