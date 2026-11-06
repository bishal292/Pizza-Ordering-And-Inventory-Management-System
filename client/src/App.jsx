import React, { useEffect } from "react";
import { useAppStore } from "./Store/store";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  useParams,
} from "react-router-dom";
import UserLayout from "./pages/UserLayout";
import UserHome from "./pages/UserPages/UserHome";
import UserCart from "./pages/UserPages/UserCart";
import UserAuth from "./pages/UserPages/UserAuth";
import { apiClient } from "./utils/api-client";
import { GET_LOGGED_USER_INFO } from "./utils/constant";
import UserOrders from "./pages/UserPages/UserOrders";
import OrderDetails from "./pages/UserPages/OrderDetails";
import UpdateProfile from "./pages/UserPages/UpdateProfile";
import LoadingScreen from "./components/LoadingScreen";

// Private Routes Component (Protected Routes) -> Only Authenticated Users can access these Routes.
const PrivateRoutes = ({ children }) => {
  const { userInfo } = useAppStore();
  const isAuthenticated = !!userInfo; // If there is userInfo, then isAuthenticated is true
  const isUser = userInfo?.role === "user";

  if (userInfo === null || userInfo === undefined) {
    return <LoadingScreen />;
  }
  // if user is not authenticated, redirect to login page for the respective user
  if (!isAuthenticated || !isUser) {
    return <Navigate to="/pizzeria/auth/login" replace />;
  }

  return children;
};

// Auth Routes Component
const AuthRoutes = ({ children }) => {
  const { userInfo } = useAppStore();
  if (userInfo?.role && userInfo.role === "user") {
    return <Navigate to="/pizzeria/home" replace />;
  }
  return children;
};

// Auth Wrapper Component
const AuthWrapper = ({ Component }) => {
  const { action } = useParams();
  const validActions = ["login", "signup", "forgot", "resetPassword"];

  if (!validActions.includes(action)) {
    return <Navigate to="/pizzeria/auth/login" replace />;
  }

  return <Component action={action} />;
};

// Router Configuration
const router = createBrowserRouter([
  {
    path: "/pizzeria/auth/:action",
    element: (
      <AuthRoutes>
        <AuthWrapper Component={UserAuth} />
      </AuthRoutes>
    ),
  },
  {
    path: "/pizzeria",
    element: <UserLayout />,
    children: [
      { index: true, element: <Navigate to="home" replace /> },
      {
        path: "home",
        element: <UserHome />,
      },
      {
        path: "orders",
        element: (
          <PrivateRoutes>
            <UserOrders />
          </PrivateRoutes>
        ),
      },
      {
        path: "profile",
        element: (
          <PrivateRoutes>
            <UpdateProfile />
          </PrivateRoutes>
        ),
      },
      {
        path: "cart",
        element: (
          <PrivateRoutes>
            <UserCart />
          </PrivateRoutes>
        ),
      },
      {
        path: "order/:orderId",
        element: (
          <PrivateRoutes>
            <OrderDetails />
          </PrivateRoutes>
        ),
      }
    ],
  },
  {
    path: "*",
    element: <Navigate to="/pizzeria/home" />,
  },
]);

// App Component
const App = () => {
  const { userInfo, setUserInfo } = useAppStore();
  const [loading, setLoading] = React.useState(true);
  const [showDelayMessage, setShowDelayMessage] = React.useState(false);

  useEffect(() => {
    let delayTimer;
    if (loading) {
      delayTimer = setTimeout(() => {
        setShowDelayMessage(true);
      }, 5000); // Show message after 5 seconds
    } else {
      setShowDelayMessage(false);
    }
    return () => clearTimeout(delayTimer);
  }, [loading]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get(GET_LOGGED_USER_INFO, {
          withCredentials: true,
        });
        setUserInfo(response.data);
      } catch (error) {
        setUserInfo({});
        console.error(error.response?.data || error.message);
      } finally {
        setLoading(false);
      }
    };

    if (!userInfo) {
      fetchData();
    }
  }, [userInfo, setUserInfo]);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        {showDelayMessage && (
          <div className="mt-6 text-center text-gray-600 max-w-md">
            <p>
              The first loading may take up to <b>30 seconds</b> to start. This
              is because the server is hosted on a free Render.com tier, which
              goes inactive after 15 minutes of inactivity and needs to wake up.
            </p>
          </div>
        )}
      </div>
    );
  }

  return <RouterProvider router={router} />;
};

export default App;
