import { useState } from "react";
import { useAppStore } from "@/Store/store";
import { apiClient } from "@/utils/api-client";
import {
  ADMIN_AUTH_CHANGE_PASS,
  ADMIN_AUTH_UPDATE_PROFILE,
} from "@/utils/constant";
import { toast } from "sonner";

const AdminProfile = () => {
  const { userInfo, setUserInfo } = useAppStore();
  const [name, setName] = useState(userInfo?.name || "");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwords, setPasswords] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const updateName = async (event) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      toast.error("Name must contain between 2 and 100 characters.");
      return;
    }

    setIsSavingName(true);
    try {
      const response = await apiClient.patch(
        ADMIN_AUTH_UPDATE_PROFILE,
        { name: trimmedName },
        { withCredentials: true }
      );
      setUserInfo(response.data.user);
      setName(response.data.user.name);
      toast.success(response.data.message || "Profile updated successfully.");
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.response?.data ||
          "Unable to update your profile."
      );
    } finally {
      setIsSavingName(false);
    }
  };

  const updatePassword = async (event) => {
    event.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (passwords.newPassword.length < 8) {
      toast.error("Use a new password with at least 8 characters.");
      return;
    }

    setIsSavingPassword(true);
    try {
      const response = await apiClient.patch(
        ADMIN_AUTH_CHANGE_PASS,
        {
          oldPassword: passwords.oldPassword,
          newPassword: passwords.newPassword,
        },
        { withCredentials: true }
      );
      toast.success(
        typeof response.data === "string"
          ? response.data
          : response.data?.message || "Password changed successfully."
      );
      setPasswords({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.response?.data ||
          "Unable to change your password."
      );
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <main className="min-h-[70vh] bg-slate-50 px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-600">
            Account settings
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Admin profile
          </h1>
          <p className="mt-2 text-slate-600">
            Update your display name and keep your password secure.
          </p>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-semibold text-slate-900">
            Profile details
          </h2>
          <p className="mt-1 text-sm text-slate-500">{userInfo?.email}</p>
          <form onSubmit={updateName} className="mt-6 space-y-5">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Display name
              </span>
              <input
                type="text"
                autoComplete="name"
                minLength={2}
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                required
              />
            </label>
            <button
              type="submit"
              disabled={isSavingName}
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {isSavingName ? "Saving..." : "Save profile"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-semibold text-slate-900">
            Change password
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Verify your current password before setting a new one.
          </p>
          <form onSubmit={updatePassword} className="mt-6 space-y-5">
            {[
              ["oldPassword", "Current password", "current-password"],
              ["newPassword", "New password", "new-password"],
              ["confirmPassword", "Confirm new password", "new-password"],
            ].map(([field, label, autoComplete]) => (
              <label className="block" key={field}>
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  {label}
                </span>
                <input
                  type="password"
                  autoComplete={autoComplete}
                  minLength={field === "oldPassword" ? undefined : 8}
                  value={passwords[field]}
                  onChange={(event) =>
                    setPasswords({ ...passwords, [field]: event.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  required
                />
              </label>
            ))}
            <button
              type="submit"
              disabled={isSavingPassword}
              className="rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              {isSavingPassword ? "Changing..." : "Change password"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
};

export default AdminProfile;
