import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAppStore } from "@/Store/store";
import logo from "../assets/Logo.svg";
import LogoutButton from "./LogoutButton";
import { ChevronDown, UserRound } from "lucide-react";

const AdminHeader = () => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { userInfo } = useAppStore();

  return (
    <header className="relative z-30 border-b border-slate-700 bg-slate-900 px-4 py-3 text-white shadow-lg sm:px-6">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-4">
        <NavLink to="/admin/dashboard" className="flex items-center gap-2 font-semibold">
          <img src={logo} className="h-9 w-9" alt="Pizzeria" />
          <span className="text-lg">Pizzeria</span>
        </NavLink>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-slate-300">
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) =>
              isActive ? "text-orange-300" : "hover:text-white"
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/admin/inventory"
            className={({ isActive }) =>
              isActive ? "text-orange-300" : "hover:text-white"
            }
          >
            Inventory
          </NavLink>
          <NavLink
            to="/admin/pizzas"
            className={({ isActive }) =>
              isActive ? "text-orange-300" : "hover:text-white"
            }
          >
            Pizzas
          </NavLink>
          <NavLink
            to="/admin/orders"
            className={({ isActive }) =>
              isActive ? "text-orange-300" : "hover:text-white"
            }
          >
            Orders
          </NavLink>
          <NavLink
            to="/admin/users-list"
            className={({ isActive }) =>
              isActive ? "text-orange-300" : "hover:text-white"
            }
          >
            Users
          </NavLink>
        </nav>
        <div className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={isProfileOpen}
            aria-label="Open admin profile menu"
            onClick={() => setIsProfileOpen((open) => !open)}
            className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-white">
              <UserRound size={18} />
            </span>
            <span className="hidden max-w-32 truncate sm:inline">
              {userInfo?.name || "Admin"}
            </span>
            <ChevronDown size={16} />
          </button>
          {isProfileOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-slate-200 bg-white p-2 text-slate-800 shadow-xl"
            >
              <NavLink
                role="menuitem"
                to="/admin/profile"
                onClick={() => setIsProfileOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-slate-100"
              >
                Update profile
              </NavLink>
              <div className="my-1 border-t border-slate-100" />
              <div role="menuitem">
                <LogoutButton />
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
