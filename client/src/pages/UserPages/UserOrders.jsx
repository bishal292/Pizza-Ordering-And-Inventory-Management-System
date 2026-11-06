import LoadingScreen from "@/components/LoadingScreen";
import { useAppStore } from "@/Store/store";
import { apiClient } from "@/utils/api-client";
import { USER_CANCEL_ORDER, USER_GET_ORDERS } from "@/utils/constant";
import { handleCompletePayment } from "@/utils/razorpayServices";
import { useEffect, useState } from "react";
import {
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaTruck,
  FaUtensils,
  FaClipboardList,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const UserOrders = () => {
  const {userInfo} = useAppStore();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting,setIsSubmitting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setError(null);
        const response = await apiClient.get(USER_GET_ORDERS, {
          withCredentials: true,
        });
        if (response.status === 200) {
          setOrders(response.data);
        } else if (response.status === 204) {
          setOrders([]);
        }
      } catch (error) {
        console.error("Error fetching orders:", error);
        setError(
          error.response?.data?.message ||
            error.response?.data ||
            "We could not reach your orders. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [reloadKey]);

  const handleCancelOrder = async (orderId) => {
    setIsSubmitting(true);
    try {
      const response = await apiClient.post(`${USER_CANCEL_ORDER}?id=${orderId}`);
      if (response.status === 200 || response.status === 202) {
        toast.success(response.data)
        setOrders((orders) =>
          orders.map((order) =>
            order._id === orderId ? { ...order, status: "cancelled" } : order
          )
        );
      }
    } catch (error) {
      console.error("Error cancelling order:", error);
      toast.error(error.response?.data?.message || error.response?.message || "Failed to cancel order.");
    }finally{
      setIsSubmitting(false);
    }
  };

  

  const getStatusStyle = (status) => {
    switch (status) {
      case "pending":
        return { color: "bg-yellow-100 text-yellow-600", icon: <FaClock /> };
      case "placed":
        return { color: "bg-blue-100 text-blue-600", icon: <FaClipboardList /> };
      case "preparing":
        return { color: "bg-orange-100 text-orange-600", icon: <FaUtensils /> };
      case "prepared":
        return { color: "bg-purple-100 text-purple-600", icon: <FaCheckCircle /> };
      case "completed":
        return { color: "bg-green-100 text-green-600", icon: <FaTruck /> };
      case "cancelled":
        return { color: "bg-red-100 text-red-600", icon: <FaTimesCircle /> };
      default:
        return { color: "bg-gray-100 text-gray-600", icon: <FaClock /> };
    }
  };

  if (loading) {
    return (
      <LoadingScreen message="Fetching your orders..." />
    );
  }

  if (error) {
    return (
      <main className="flex min-h-[65vh] items-center justify-center bg-[#faf7f2] px-4 py-12">
        <section className="max-w-lg rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-stone-900">Orders unavailable</h1>
          <p className="mt-2 text-sm text-stone-600">{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setReloadKey((key) => key + 1);
            }}
            className="mt-5 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf7f2] px-4 py-8 sm:px-7 sm:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 text-center sm:mb-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-700">Order history</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">
            Your orders
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Track payments, preparation, and completed orders.
          </p>
        </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white px-6 py-14 text-center shadow-sm">
          <h2 className="text-lg font-bold text-stone-900">No orders yet</h2>
          <p className="mt-2 text-sm text-stone-600">
            Your order history will appear here after checkout.
          </p>
          <Link
            to="/pizzeria/home"
            className="mt-5 inline-flex rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Explore the menu
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => {
            const { color, icon } = getStatusStyle(order.status);

            return (
              <div
                key={order._id}
                className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {order.image && (
                        <img
                          src={order.image}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-lg bg-stone-100 object-cover"
                        />
                      )}
                      <div className="min-w-0">
                        <h2 className="truncate font-bold text-stone-900">
                          Order #{order.dailyOrderId || order._id}
                        </h2>
                        <p className="mt-1 text-xs text-stone-500">
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleString()
                            : "Date unavailable"}
                        </p>
                      </div>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold capitalize ${color}`}>
                      {icon}{order.status}
                    </span>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2 border-y border-stone-100 py-4">
                    <div>
                      <p className="text-xs text-stone-500">Total</p>
                      <p className="mt-1 font-bold text-stone-900">
                        ₹{Number(order.totalPrice || 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-stone-500">Items</p>
                      <p className="mt-1 font-semibold text-stone-800">
                        {order.totalQuantity ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-stone-500">Table</p>
                      <p className="mt-1 font-semibold text-stone-800">
                        {order.tableNo ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <Link
                      className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                      to={`/pizzeria/order/${order._id}`}
                    >
                      View details
                    </Link>
                    {(order.status === "pending" || order.status === "placed") && (
                      <button
                        onClick={() => handleCancelOrder(order._id)}
                        className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                        disabled={isSubmitting}
                      >
                        Cancel
                      </button>
                    )}
                    {order.status === "pending" && (
                      <button
                        onClick={() => handleCompletePayment(userInfo, order._id, setIsSubmitting)}
                        className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                        disabled={isSubmitting}
                      >
                        Complete Payment
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </main>
  );
};

export default UserOrders;
