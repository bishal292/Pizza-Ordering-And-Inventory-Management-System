import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAppStore } from "@/Store/store";
import { apiClient } from "@/utils/api-client";
import {
  USER_AUTH_CHANGE_PASS,
  USER_UPDATE_PROFILE,
} from "@/utils/constant";

const UpdateProfile = () => {
  const { userInfo, setUserInfo } = useAppStore();
  const [name, setName] = useState(userInfo?.name || "");
  const [isSaving, setIsSaving] = useState(false);
  const [passwords, setPasswords] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await apiClient.patch(USER_UPDATE_PROFILE, {
        name: name.trim(),
      });
      setUserInfo(response.data.user);
      setName(response.data.user.name);
      toast.success(response.data.message);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.response?.data ||
          "Unable to update your profile. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (passwords.newPassword.length < 8) {
      toast.error("Use a new password with at least 8 characters.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await apiClient.patch(USER_AUTH_CHANGE_PASS, {
        oldPassword: passwords.oldPassword,
        newPassword: passwords.newPassword,
      });
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
          "Unable to change your password. Please try again."
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <main className="min-h-[70vh] bg-[#faf7f2] px-4 py-10 sm:px-6">
      <section className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="bg-[#2b1d16] px-6 py-7 text-white sm:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-300">
            Account settings
          </p>
          <h1 className="mt-2 text-3xl font-bold">Update profile</h1>
          <p className="mt-2 text-sm text-stone-300">
            Keep your account details up to date.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-7 sm:px-8">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-stone-700">
              Full name
            </span>
            <input
              autoComplete="name"
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={100}
              required
            />
          </label>
          <div className="block">
            <span className="mb-1.5 block text-sm font-semibold text-stone-700">
              Email address
            </span>
            <p className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-stone-600">
              {userInfo?.email}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              Email changes require a separate verification flow.
            </p>
          </div>
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </section>

      <section className="mx-auto mt-6 max-w-xl overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-100 px-6 py-5 sm:px-8">
          <h2 className="text-xl font-bold text-stone-900">Change password</h2>
          <p className="mt-1 text-sm text-stone-500">
            Enter your current password and choose a new one.
          </p>
        </div>
        <form onSubmit={handlePasswordChange} className="space-y-5 px-6 py-7 sm:px-8">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-stone-700">
              Current password
            </span>
            <input
              type="password"
              autoComplete="current-password"
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              value={passwords.oldPassword}
              onChange={(event) =>
                setPasswords({ ...passwords, oldPassword: event.target.value })
              }
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-stone-700">
              New password
            </span>
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              value={passwords.newPassword}
              onChange={(event) =>
                setPasswords({ ...passwords, newPassword: event.target.value })
              }
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-stone-700">
              Confirm new password
            </span>
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              value={passwords.confirmPassword}
              onChange={(event) =>
                setPasswords({
                  ...passwords,
                  confirmPassword: event.target.value,
                })
              }
              required
            />
          </label>
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
            <Link
              to="/pizzeria/home"
              className="rounded-lg border border-stone-300 px-4 py-2.5 text-center text-sm font-semibold text-stone-700 hover:bg-stone-50"
            >
              Back to menu
            </Link>
            <button
              type="submit"
              disabled={isChangingPassword}
              className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isChangingPassword ? "Changing..." : "Change password"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
};

export default UpdateProfile;
