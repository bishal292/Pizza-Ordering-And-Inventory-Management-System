import LoadingScreen from "@/components/LoadingScreen";
import { apiClient } from "@/utils/api-client";
import {
  ADMIN_ORDER_DETAILS,
  ADMIN_UPDATE_ORDER_STATUS,
} from "@/utils/constant";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";

const OrderDetails = () => {
  const { orderId } = useParams();
  const [loading, setLoading] = useState(true);
  const [orderDetails, setOrderDetails] = useState(null);
  const [totalPrice, setTotalPrice] = useState(0);
  const [genOrderId, setGenOrderId] = useState("");
  const [tableNumber, setTableNumber] = useState(null);
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dailyOID, setDailyOID] = useState(""); // Daily Order ID
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    const fetchOrderDetails = async () => {
      try {
        const response = await apiClient.get(
          `${ADMIN_ORDER_DETAILS}?id=${encodeURIComponent(orderId)}`,
          { withCredentials: true }
        );
        if (active && response.status === 200) {
          setOrderDetails(response.data.items);
          setTotalPrice(response.data.totalPrice);
          setGenOrderId(response.data.orderId);
          setTableNumber(response.data.tableNo);
          setStatus(response.data.status);
          setDailyOID(response.data.dailyOrderId);
        }
      } catch (error) {
        if (active) {
          setOrderDetails(null);
          setLoadError(
            error.response?.data?.message ||
              error.response?.data ||
              "Unable to load order details. Please try again."
          );
        }
        console.error(error.response?.data || error.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchOrderDetails();
    return () => {
      active = false;
    };
  }, [orderId]);

  const handleUpdateOrder = async (newStatus) => {
    if (status === "completed" || status === "cancelled") {
      toast.error(
        "Cannot update the status of a completed or cancelled order."
      );
      return;
    }
    try {
      setIsSubmitting(true);
      const response = await apiClient.patch(
        `${ADMIN_UPDATE_ORDER_STATUS}?id=${encodeURIComponent(orderId)}`,
        { status: newStatus },
        { withCredentials: true }
      );
      if (response.status === 200 || response.status === 202) {
        setStatus(newStatus);
        toast.success(
          response.data?.message ||
            (newStatus === "cancelled"
              ? "Order cancelled"
              : "Order status updated successfully")
        );
      }
    } catch (error) {
      console.error(error);
      toast.error(
        error.response?.data?.message ||
          error.response?.data ||
          "Some Unknown Error Occured"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "bg-yellow-200 text-yellow-800";
      case "preparing":
        return "bg-blue-200 text-blue-800";
      case "prepared":
        return "bg-purple-200 text-purple-800";
      case "completed":
        return "bg-green-200 text-green-800";
      case "cancelled":
        return "bg-red-200 text-red-800";
      default:
        return "bg-gray-200 text-gray-800";
    }
  };

  const allowedNextStatuses = {
    pending: ["cancelled"],
    placed: ["preparing", "cancelled"],
    preparing: ["prepared"],
    prepared: ["completed"],
  };

  if (loading) {
    return <LoadingScreen message="Fetching Order Details" />;
  }

  if (loadError || !orderDetails) {
    return (
      <main className="min-h-[65vh] bg-[#faf8f5] px-4 py-12">
        <section className="mx-auto max-w-xl rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-stone-900">Order unavailable</h1>
          <p className="mt-2 text-sm text-stone-600">
            {loadError || "This order could not be found."}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-[#faf8f5] px-4 py-6 font-sans sm:px-7 sm:py-9">
      <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-700">Order management</p>
          <h1 className="mt-1 text-2xl font-bold text-stone-900 sm:text-3xl">
            Order #{dailyOID || orderId}
          </h1>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase ${getStatusColor(status)}`}>
          {status}
        </span>
      </div>

      <div className="mb-6 flex flex-wrap gap-6 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-stone-600">
          <b className="text-stone-900">Table:</b> {tableNumber || "Not assigned"}
        </p>
        <p className="text-sm text-stone-600">
          <b className="text-stone-900">Payment/order ID:</b> {genOrderId || "Unavailable"}
        </p>
        <p className="ml-auto text-lg font-bold text-stone-900">
          Total ₹{Number(totalPrice || 0).toFixed(2)}
        </p>
        </div>

      {!orderDetails?.length ? (
        <div className="rounded-xl border border-stone-200 bg-white p-8 text-center font-semibold text-stone-600">
          No items were found for this order.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {orderDetails.map((item, index) => {
            const pizza = item.pizza || {};
            const customizations = item.customizations || {};
            const sauces = customizations.sauce || [];
            const cheeses = customizations.cheese || [];
            const toppings = customizations.toppings || [];
            const isCustomized =
              Boolean(customizations.base) ||
              sauces.length > 0 ||
              cheeses.length > 0 ||
              toppings.length > 0;

            return (
              <div
                key={`${pizza._id || index}-${index}`}
                className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:flex-row"
              >
                {pizza.image && (
                  <img
                    src={pizza.image}
                    alt={pizza.name || "Pizza"}
                    className="h-36 w-full rounded-xl bg-stone-100 object-cover sm:h-32 sm:w-40"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-lg font-bold text-stone-900">
                      {pizza.name || "Pizza details unavailable"}
                      {isCustomized && <span className="ml-2 text-xs font-semibold text-orange-700">Customized</span>}
                    </h2>
                    <p className="font-bold text-stone-900">₹{Number(item.finalPrice || 0).toFixed(2)}</p>
                  </div>
                  <p className="mt-1 text-sm text-stone-500">Quantity: {item.quantity}</p>
                  <div className="mt-3 space-y-1 text-sm text-stone-600">
                    <p><b className="text-stone-800">Base:</b> {customizations.base?.name || pizza.base?.name || "—"}</p>
                    <p><b className="text-stone-800">Sauce:</b> {(pizza.sauce || []).map((s) => s?.name || s).join(", ") || "None"}</p>
                    <p><b className="text-stone-800">Cheese:</b> {(pizza.cheese || []).map((c) => c?.name || c).join(", ") || "None"}</p>
                    <p><b className="text-stone-800">Toppings:</b> {(pizza.toppings || []).map((t) => t?.name || t).join(", ") || "None"}</p>
                    {isCustomized && (
                      <p className="break-words">
                        <b className="text-stone-800">Customizations:</b>{" "}
                        {[
                          customizations.base?.name && `Base: ${customizations.base.name}`,
                          sauces.length && `Sauce: ${sauces.map((s) => s?.name || s).join(", ")}`,
                          cheeses.length && `Cheese: ${cheeses.map((c) => c?.name || c).join(", ")}`,
                          toppings.length && `Toppings: ${toppings.map((t) => t?.name || t).join(", ")}`,
                        ].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-xl border border-stone-200 bg-white p-5 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <label htmlFor="orderStatus" className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Update status
          </label>
          {status !== "cancelled" && status !== "completed" && (
            <select
              disabled={isSubmitting}
              id="orderStatus"
              value={status}
              onChange={(e) => handleUpdateOrder(e.target.value)}
              className={`min-w-48 cursor-pointer rounded-lg border border-stone-200 px-3 py-2 ${getStatusColor(status)}`}
            >
              <option value={status}>{status}</option>
              {(allowedNextStatuses[status] || []).map((nextStatus) => (
                <option key={nextStatus} value={nextStatus}>{nextStatus}</option>
              ))}
            </select>
          )}
        </div>
        <p className="text-2xl font-extrabold text-stone-900">
          Total ₹{Number(totalPrice || 0).toFixed(2)}
        </p>
      </div>
      </div>
    </main>
  );
};

export default OrderDetails;
