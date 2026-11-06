import DashBoardCharts from "@/components/DashBoardCharts";
import { apiClient } from "@/utils/api-client";
import { ADMIN_DASHBOARD } from "@/utils/constant";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  FaBan,
  FaClipboardList,
  FaDollarSign,
  FaExclamationCircle,
  FaPizzaSlice,
  FaShoppingCart,
  FaUsers,
} from "react-icons/fa";
import { RefreshCw } from "lucide-react";

const statConfig = [
  { label: "Total Orders", key: "Total Orders", icon: FaShoppingCart, color: "bg-blue-50 text-blue-700" },
  { label: "Today's Orders", key: "Today's Orders", icon: FaClipboardList, color: "bg-violet-50 text-violet-700" },
  { label: "Total Revenue", key: "Total Revenue", icon: FaDollarSign, color: "bg-emerald-50 text-emerald-700" },
  { label: "Today's Revenue", key: "Today's Revenue", icon: FaDollarSign, color: "bg-teal-50 text-teal-700" },
  { label: "Total Users", key: "Total Users", icon: FaUsers, color: "bg-indigo-50 text-indigo-700" },
  { label: "Total Pizzas", key: "Total Pizzas", icon: FaPizzaSlice, color: "bg-orange-50 text-orange-700" },
  { label: "Low Stock Items", key: "Out Of Stock Items", icon: FaExclamationCircle, color: "bg-rose-50 text-rose-700" },
  { label: "Today's Orders Cancelled", key: "Today's Orders Cancelled", icon: FaBan, color: "bg-slate-100 text-slate-700" },
];

const formatCurrency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const Dashboard = () => {
  const [responseData, setResponseData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchDashboardData = useCallback(async (showLoading = false) => {
    if (showLoading) setIsRefreshing(true);
    try {
      const response = await apiClient.get(ADMIN_DASHBOARD, {
        withCredentials: true,
      });
      setResponseData(response.data);
      setLastUpdated(new Date());
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast.error(
        error.response?.data?.message ||
          error.response?.data ||
          "Unable to load dashboard data."
      );
      setIsLoading(false);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const timer = window.setInterval(() => fetchDashboardData(), 60_000);
    return () => window.clearInterval(timer);
  }, [fetchDashboardData]);

  const refreshDashboard = async () => {
    await fetchDashboardData(true);
    setRefreshKey((key) => key + 1);
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-7 lg:px-10">
      <div className="mx-auto max-w-screen-2xl">
        <section className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-600">
              Operations overview
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Sales, orders, and inventory at a glance.
              {lastUpdated && (
                <span className="ml-2">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={refreshDashboard}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </section>

        <section
          aria-label="Business metrics"
          className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {statConfig.map(({ label, key, icon: Icon, color }) => (
            <article
              key={label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">{label}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {isLoading
                      ? "—"
                      : label.includes("Revenue")
                        ? formatCurrency(responseData[key])
                          : Number(responseData[key] || 0).toLocaleString()}
                  </p>
                </div>
                <span className={`rounded-xl p-3 ${color}`}>
                  <Icon size={20} />
                </span>
              </div>
            </article>
          ))}
        </section>

        <section className="mb-8">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-slate-900">
              Sales and order analytics
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Aggregated from current order records and refreshed automatically every minute.
            </p>
          </div>
          <DashBoardCharts key={refreshKey} />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-bold text-slate-900">Recent orders</h2>
                <p className="text-sm text-slate-500">Latest customer activity</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                {responseData.recentOrders?.length || 0}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Order</th>
                    <th className="px-5 py-3 font-semibold">Customer</th>
                    <th className="px-5 py-3 font-semibold">Amount</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {responseData.recentOrders?.length ? (
                    responseData.recentOrders.map((order) => (
                      <tr key={order._id} className="text-slate-700">
                        <td className="whitespace-nowrap px-5 py-3 font-semibold">
                          #{order.dailyOrderId || order._id.slice(-6)}
                        </td>
                        <td className="px-5 py-3">
                          {order.userId?.name || "Customer"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3">
                          {formatCurrency(order.totalPrice)}
                        </td>
                        <td className="px-5 py-3 capitalize">
                          {order.status}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-5 py-8 text-center text-slate-500">
                        {isLoading ? "Loading recent orders..." : "No orders yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-bold text-slate-900">Stock attention</h2>
                <p className="text-sm text-slate-500">Items at or below reorder threshold</p>
              </div>
              <span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-700">
                {responseData["Out Of Stock Items"] || 0} items
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {responseData.lowStockItems?.length ? (
                responseData.lowStockItems.map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center justify-between gap-4 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800">{item.name}</p>
                      <p className="text-xs capitalize text-slate-500">{item.category}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-rose-700">
                      {item.stock} / {item.threshold}
                    </p>
                  </div>
                ))
              ) : (
                <p className="px-5 py-8 text-center text-sm text-slate-500">
                  {isLoading ? "Checking stock..." : "All inventory is above threshold."}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Dashboard;
