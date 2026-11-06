import { useEffect, useState } from "react";
import { useAppStore } from "./Store/store";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  useParams,
} from "react-router-dom";
import AdminLayout from "./pages/AdminLayout";
import AdminInventory from "./pages/AdminPages/AdminInventory";
import AdminDashboard from "./pages/AdminPages/AdminDashboard";
import AdminAuth from "./pages/AdminPages/AdminAuth";
import { apiClient } from "./utils/api-client";
import { GET_LOGGED_USER_INFO } from "./utils/constant";
import AdminOrders from "./pages/AdminPages/AdminOrders";
import AdminPizza from "./pages/AdminPages/AdminPizza";
import PizzaDetails from "./pages/AdminPages/PizzaDetails";
import AdminUsersList from "./pages/AdminPages/AdminUsersList";
import UserOdersList from "./pages/AdminPages/UserOrdersList";
import SelectedUserCart from "./pages/AdminPages/SelectedUserCart";
import LoadingScreen from "./components/LoadingScreen";
import SelectedOrder from "./pages/AdminPages/SelectedOrder";
import AdminProfile from "./pages/AdminPages/AdminProfile";

// Private Routes Component (Protected Routes) -> Only Authenticated Users can access these Routes.
const PrivateRoutes = ({ children }) => {
  const { userInfo } = useAppStore();
  const isAuthenticated = !!userInfo; // If there is userInfo, then isAuthenticated is true
  const isAdmin = userInfo?.role === "admin";
  
  if (userInfo === null || userInfo === undefined) {
    return <LoadingScreen />;
  }

  // if user is not authenticated, redirect to login page for the respective user
  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/admin/auth/login" replace />;
  }

  return children;
};

// Auth Routes Component
const AuthRoutes = ({ children }) => {
  const { userInfo } = useAppStore();

  if (userInfo?.role && userInfo.role === "admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return children;
};

// Auth Wrapper Component
const AuthWrapper = ({ Component }) => {
  const { action } = useParams();
  const validActions = ["login", "signup", "forgot", "resetPassword"];

  if (!validActions.includes(action)) {
    return <Navigate to="/admin/auth/login" replace />;
  }

  return <Component action={action} />;
};

// Router Configuration
const router = createBrowserRouter([
  {
    path: "/admin/auth/:action",
    element: (
      <AuthRoutes>
        <AuthWrapper Component={AdminAuth} />
      </AuthRoutes>
    ),
  },
  {
    path: "/admin",
    element: (
      <PrivateRoutes>
        <AdminLayout />
      </PrivateRoutes>
    ),
    children: [
      { path: "dashboard", element: <AdminDashboard /> },
      { path: "profile", element: <AdminProfile /> },
      { path: "pizzas", element: <AdminPizza /> },
      { path: "inventory", element: <AdminInventory /> },
      { path: "orders", element: <AdminOrders /> },
      { path: "users-list", element: <AdminUsersList /> },
      { path: "pizza/:id", element: <PizzaDetails /> },
      {path:"cart/:cartId",element: <SelectedUserCart />},
      {path:"order/:orderId",element: <SelectedOrder />},
      { path: "user/orders/:id", element: <UserOdersList /> },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/admin/auth/login" />,
  },
]);

const MIN_SCREEN_WIDTH = 768; // Tablet breakpoint

const SmallScreenWarning = ({ onClose }) => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-70">
    <div className="relative bg-gray-900 rounded-xl p-8 max-w-[90vw] shadow-2xl text-white text-center">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 bg-gray-700 text-white rounded-full w-8 h-8 flex items-center justify-center text-xl hover:bg-gray-600 focus:outline-none"
        aria-label="Close"
      >
        &times;
      </button>
      <strong>
        This page is designed for larger screen view and you're visiting this in a smaller device.<br />
        Please open in a larger screen for better functionality.
      </strong>
    </div>
  </div>
);

const App = () => {
  const { userInfo, setUserInfo } = useAppStore();
  const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < MIN_SCREEN_WIDTH);
  const [warningClosed, setWarningClosed] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(window.innerWidth < MIN_SCREEN_WIDTH);
    };
    window.addEventListener("resize", handleResize);
    // Initial check
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await apiClient.get(GET_LOGGED_USER_INFO, {
          withCredentials: true,
        });
        setUserInfo(response.data);
      } catch (error) {
        setUserInfo({});
        console.error(error.response?.data || error.message);
      }
    };

    if (!userInfo) {
      fetchData();
    }
  }, [userInfo, setUserInfo]);

  return (
    <>
      {isSmallScreen && !warningClosed && (
        <SmallScreenWarning onClose={() => setWarningClosed(true)} />
      )}
      <RouterProvider router={router} />
    </>
  );
};

export default App;
