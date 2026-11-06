import { useState } from "react";
import { Button } from "./ui/button";
import { apiClient } from "@/utils/api-client";
import { USER_AUTH_LOGOUT } from "@/utils/constant";
import { useAppStore } from "@/Store/store";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const LogoutButton = () => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { userInfo, setUserInfo } = useAppStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const response = await apiClient.post(USER_AUTH_LOGOUT);
      if (response.status === 200) {
        toast.warning("Logged Out Successfully");
        setUserInfo(null);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoggingOut(false);
    }
  };
  return (
    <div>
      {/* Show Login button when user is NOT logged in */}
      {!userInfo || !userInfo.role ? (
        <Button
          className="bg-green-500 text-white
          px-4 py-2 rounded hover:bg-green-800 hover:shadow-lg "
          onClick={() => navigate("/pizzeria/auth/login")}
        >
          Login
        </Button>
      ) : (
        // Show Logout button when user IS logged in
        <Button
          className="bg-red-500 text-white
        px-4 py-2 rounded hover:bg-red-800 hover:shadow-lg "
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? "Logging Out..." : "Logout"}
        </Button>
      )}
    </div>
  );
};

export default LogoutButton;
