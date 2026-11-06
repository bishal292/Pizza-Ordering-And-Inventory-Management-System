import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaShoppingCart,
  FaBox,
  FaBars,
  FaTimes,
  FaUserCircle,
} from "react-icons/fa";
import logo from "../assets/Logo.svg";
import { apiClient } from "@/utils/api-client";
import { USER_AUTH_LOGOUT } from "@/utils/constant";
import { useAppStore } from "@/Store/store";
import { toast } from "sonner";

const UserHeader = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const profileMenuRef = useRef(null);
  const navigate = useNavigate();
  const { userInfo, setUserInfo } = useAppStore();

  useEffect(() => {
    const closeMenu = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await apiClient.post(USER_AUTH_LOGOUT);
      setUserInfo(null);
      setProfileOpen(false);
      navigate("/pizzeria/auth/login");
      toast.success("Logged out successfully");
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.response?.data ||
          "Unable to log out. Please try again."
      );
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="relative z-50 flex items-center justify-between border-b border-white/10 bg-[#211711] px-4 py-3 text-white shadow-lg sm:px-6">
      <NavLink to="/pizzeria/home" className="flex items-center gap-2">
        <img src={logo} className="h-9 w-9" alt="Pizzeria" />
        <span className="text-xl font-bold tracking-tight">Pizzeria</span>
      </NavLink>

      <button
        className="ml-auto mr-3 rounded-full p-2 text-orange-100 transition hover:bg-white/10 hover:text-white md:hidden"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label={menuOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={menuOpen}
      >
        {menuOpen ? <FaTimes className="text-xl" /> : <FaBars className="text-xl" />}
      </button>

      <nav
        className={`${menuOpen ? "flex" : "hidden"} absolute left-0 top-full w-full flex-col gap-1 border-t border-white/10 bg-[#211711] p-3 shadow-xl md:static md:flex md:w-auto md:flex-row md:items-center md:gap-2 md:border-0 md:bg-transparent md:p-0 md:shadow-none`}
      >
        {[
          { to: "/pizzeria/home", label: "Home", icon: <FaHome /> },
          { to: "/pizzeria/cart", label: "Cart", icon: <FaShoppingCart /> },
          { to: "/pizzeria/orders", label: "Orders", icon: <FaBox /> },
        ].map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-orange-500/15 text-orange-300"
                  : "text-stone-200 hover:bg-white/10 hover:text-white"
              }`
            }
          >
            {icon} {label}
          </NavLink>
        ))}
      </nav>

      <div className="relative" ref={profileMenuRef}>
        <button
          type="button"
          onClick={() => {
            if (!userInfo?.role) {
              navigate("/pizzeria/auth/login");
              return;
            }
            setProfileOpen((open) => !open);
          }}
          className="flex items-center gap-2 rounded-full border border-white/15 p-1.5 pr-2 text-orange-100 transition hover:bg-white/10"
          aria-label="Profile menu"
          aria-expanded={profileOpen}
        >
          <FaUserCircle className="text-2xl" />
          <span className="hidden max-w-28 truncate text-sm sm:inline">
            {userInfo?.name || "Profile"}
          </span>
        </button>
        {profileOpen && userInfo?.role === "user" && (
          <div className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-xl border border-stone-200 bg-white p-1.5 text-stone-800 shadow-xl">
            <NavLink
              to="/pizzeria/profile"
              onClick={() => setProfileOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-orange-50 hover:text-orange-700"
            >
              Update profile
            </NavLink>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              {isLoggingOut ? "Logging out..." : "Log out"}
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default UserHeader;
