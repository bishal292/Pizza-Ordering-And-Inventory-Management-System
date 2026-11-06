import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiClient } from "../../utils/api-client";
import {
  ADMIN_ALL_ORDERS,
  ADMIN_ORDER_FILTERED,
  ADMIN_UPDATE_ORDER_STATUS,
} from "../../utils/constant";
import LoadingScreen from "@/components/LoadingScreen";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [limit, setLimit] = useState(25);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const fetchOrders = useCallback(async (reset = false, requestedSkip = 0) => {
    try {
      setLoading(true);
      const response = await apiClient.get(ADMIN_ALL_ORDERS, {
        params: { limit, skip: reset ? 0 : requestedSkip },
      });
      if (response.status === 200) {
        setOrders((prevOrders) =>
          reset ? response.data : [...prevOrders, ...response.data]
        );
        setSkip((reset ? 0 : requestedSkip) + limit);
        setHasMore(response.data.length === limit);
      } else if (response.status === 204) {
        if (reset) setOrders([]);
        setHasMore(false);
      }
    } catch (error) {
      console.error(error.response?.data || error.message);
      toast.error(
        error.response?.data?.message ||
          error.response?.data ||
          "Unable to load orders. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [limit]);

  const fetchOrderAccordingToStatus = async (status) => {
    setLoading(true);
    try {
      const response = await apiClient.get(
        `${ADMIN_ORDER_FILTERED}?status=${status}`
      );
      if (response.status === 200) {
        setOrders(response.data);
        toast.success("Orders fetched successfully with Status : " + status);
      }
    } catch (error) {
      console.error("Error Occured : ", error);
      toast.error(error.response?.data || "Some Unknown Error Occured");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const status = queryParams.get("status") || "";
    setFilterStatus(status);
    if (status) {
      fetchOrderAccordingToStatus(status);
    } else {
      fetchOrders(true);
    }
    setOrders([]);
    setSkip(0);
  }, [location.search, fetchOrders]);

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
    completed: [],
    cancelled: [],
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      setIsSubmitting(true);
      const response = await apiClient.patch(
        `${ADMIN_UPDATE_ORDER_STATUS}?id=${orderId}`,
        { status: newStatus },
        { withCredentials: true }
      );
      if (response.status === 200 || response.status === 202) {
        setOrders((prevOrders) =>
          prevOrders.map((order) =>
            order._id === orderId ? { ...order, status: newStatus } : order
          )
        );
        toast.success(response.data?.message || response.data || "Order status updated successfully",
          {
            duration: 5000,
            style: {
              backgroundColor: "#1e293b",
              color: "#ffffff",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)", 
            }
          }
        );
      }
    } catch (error) {
      console.error(error);
      toast.error(
        error.response?.data?.message || error.response?.data || "Some Unknown Error Occurred"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFilterChange = (status) => {
    setFilterStatus(status);
    setSkip(0);
    navigate(`?status=${status}`);
  };

  const handleShowMore = () => {
    fetchOrders(false, skip);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">All Orders</h2>
        <div className="flex items-center gap-2 ">
          <div>
            <label className="mr-2">Filter by Status:</label>
            <select
              value={filterStatus}
              onChange={(e) => handleFilterChange(e.target.value)}
              className="p-2 border border-gray-300 rounded"
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="placed">Placed</option>
              <option value="preparing">Preparing</option>
              <option value="prepared">Prepared</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          {!filterStatus && (
            <div>
              <label className="mr-2">Limit:</label>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(parseInt(e.target.value));
                  setSkip(0);
                }}
                className="p-2 border border-gray-300 rounded"
                disabled={loading}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {loading && <LoadingScreen message="Fetching Orders..." />}

      {orders && orders.length > 0 ? (
        <table className="w-full border-collapse border border-gray-300 mb-6">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-3 border border-gray-300">#</th>
              <th className="p-3 border border-gray-300">Order ID</th>
              <th className="p-3 border border-gray-300">User</th>
              <th className="p-3 border border-gray-300">Table No</th>
              <th className="p-3 border border-gray-300">Order Amount</th>
              <th className="p-3 border border-gray-300">Total Quantity</th>
              <th className="p-3 border border-gray-300">Status</th>
              <th className="p-3 border border-gray-300">Created At</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order, index) => (
              <tr key={order._id} className="border-b border-gray-300">
                <td className="p-3">{index + 1}</td>
                <td className="p-3">
                  <Link
                    to={`/admin/order/${order._id}`}
                    className="text-blue-500 underline  hover:text-orange-700 "
                  >
                    {order?.dailyOrderId !== "N/A"
                      ? order.dailyOrderId
                      : order._id}
                  </Link>
                </td>
                <td className="p-3">
                  <Link
                    to={`/admin/users-list?id=${
                      order.userEmail || order.userName
                    }`}
                    className="text-blue-500 text-center underline   hover:text-orange-700 "
                  >
                    {order?.userName || order?.userEmail}
                  </Link>
                </td>
                <td className="p-3">{order?.tableNo || "N/A"}</td>
                <td className="p-3">₹ {Number(order?.totalPrice || 0).toFixed(2)}</td>
                <td className="p-3 text-center">{order?.totalQuantity}</td>
                <td className="p-3">
                  <select
                    value={order.status}
                    disabled={isSubmitting || !allowedNextStatuses[order.status]?.length}
                    onChange={(e) =>
                      handleUpdateOrderStatus(order._id, e.target.value)
                    }
                    className={`p-2 rounded ${getStatusColor(order.status)}`}
                  >
                    <option value={order.status}>{order.status}</option>
                    {(allowedNextStatuses[order.status] || []).map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  {new Date(order.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-center text-gray-500">No orders found.</p>
      )}

      {!filterStatus && !loading && hasMore && (
        <div className="text-center mt-4">
          <button
            onClick={handleShowMore}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Show More...
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
