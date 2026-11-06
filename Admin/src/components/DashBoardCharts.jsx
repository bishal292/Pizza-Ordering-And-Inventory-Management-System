import { useEffect, useState } from "react";
import { apiClient } from "@/utils/api-client";
import {
  ADMIN_DASHBOARD_ORDER,
  ADMIN_DASHBOARD_REVENUE,
} from "@/utils/constant";
import { Line, Doughnut } from "react-chartjs-2";
import { toast } from "sonner";
import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const initialOrderData = {
  pending: 0,
  placed: 0,
  preparing: 0,
  prepared: 0,
  completed: 0,
  cancelled: 0,
};

const orderStatuses = [
  ["pending", "Pending", "#f59e0b"],
  ["placed", "Placed", "#3b82f6"],
  ["preparing", "Preparing", "#f97316"],
  ["prepared", "Prepared", "#8b5cf6"],
  ["completed", "Completed", "#10b981"],
  ["cancelled", "Cancelled", "#ef4444"],
];

const DashBoardCharts = () => {
  const [revenueData, setRevenueData] = useState([]);
  const [orderData, setOrderData] = useState(initialOrderData);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    let active = true;
    const fetchDashboardCharts = async () => {
      try {
        const [revenueResponse, orderResponse] = await Promise.all([
          apiClient.get(ADMIN_DASHBOARD_REVENUE, { withCredentials: true }),
          apiClient.get(ADMIN_DASHBOARD_ORDER, { withCredentials: true }),
        ]);
        if (!active) return;
        setRevenueData(revenueResponse.data);
        setOrderData(orderResponse.data);
        setLastUpdated(new Date());
      } catch (error) {
        if (!active) return;
        console.error("Error fetching dashboard charts:", error);
        toast.error(
          error.response?.data?.message ||
            error.response?.data ||
            "Unable to load dashboard charts."
        );
      } finally {
        if (active) setIsLoading(false);
      }
    };

    fetchDashboardCharts();
    const timer = window.setInterval(fetchDashboardCharts, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const lineChartData = {
    labels: revenueData.map((item) => item.month),
    datasets: [
      {
        label: "Revenue (₹)",
        data: revenueData.map((item) => item.revenue),
        yAxisID: "revenue",
        borderColor: "#ea580c",
        backgroundColor: "rgba(234, 88, 12, 0.12)",
        pointBackgroundColor: "#ea580c",
        tension: 0.35,
        fill: true,
      },
      {
        label: "Orders",
        data: revenueData.map((item) => item.orders),
        yAxisID: "orders",
        borderColor: "#2563eb",
        backgroundColor: "rgba(37, 99, 235, 0.08)",
        pointBackgroundColor: "#2563eb",
        tension: 0.35,
      },
    ],
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "bottom" },
      tooltip: {
        callbacks: {
          label: (context) =>
            context.dataset.yAxisID === "revenue"
              ? ` Revenue: ₹${Number(context.raw).toLocaleString("en-IN")}`
              : ` Orders: ${context.raw}`,
        },
      },
    },
    scales: {
      revenue: {
        type: "linear",
        position: "left",
        beginAtZero: true,
        title: { display: true, text: "Revenue (₹)" },
        ticks: { callback: (value) => `₹${Number(value).toLocaleString("en-IN")}` },
      },
      orders: {
        type: "linear",
        position: "right",
        beginAtZero: true,
        grid: { drawOnChartArea: false },
        title: { display: true, text: "Orders" },
        ticks: { precision: 0 },
      },
    },
  };

  const statusCounts = orderStatuses.map(([key]) => Number(orderData[key] || 0));
  const totalOrders = statusCounts.reduce((sum, count) => sum + count, 0);
  const doughnutData = {
    labels: orderStatuses.map(([, label]) => label),
    datasets: [
      {
        data: statusCounts,
        backgroundColor: orderStatuses.map(([, , color]) => color),
        borderWidth: 0,
        hoverOffset: 6,
      },
    ],
  };
  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "68%",
    plugins: {
      legend: { position: "bottom" },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = Number(context.raw || 0);
            const percentage = totalOrders
              ? ((value / totalOrders) * 100).toFixed(1)
              : "0.0";
            return `${context.label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="space-y-3">
      {lastUpdated && (
        <p className="text-right text-xs text-slate-500">
          Analytics refreshed {lastUpdated.toLocaleTimeString()}
        </p>
      )}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <h3 className="font-bold text-slate-900">Revenue and order volume</h3>
            <p className="mt-1 text-sm text-slate-500">
              Monthly totals for the last 12 months
            </p>
          </div>
          <div className="relative h-80">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Loading analytics...
              </div>
            ) : (
              <Line data={lineChartData} options={lineOptions} />
            )}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <h3 className="font-bold text-slate-900">Order status</h3>
            <p className="mt-1 text-sm text-slate-500">
              Distribution across the current order lifecycle
            </p>
          </div>
          <div className="relative h-80">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Loading order statuses...
              </div>
            ) : totalOrders === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                No orders available for reporting.
              </div>
            ) : (
              <Doughnut data={doughnutData} options={doughnutOptions} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default DashBoardCharts;
