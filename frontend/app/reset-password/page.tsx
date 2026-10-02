"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, apiRequest } from "@/lib/api";
import { setToken } from "@/lib/auth";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const token = useMemo(() => tokenFromUrl.trim(), [tokenFromUrl]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Reset token is missing from the link");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);

    try {
      const response = await apiRequest<{ token: string; message: string }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      });

      if (response.token) {
        setToken(response.token);
      }

      setDone(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to reset password");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-white px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold">Reset password</h1>
        <p className="mt-1 text-sm text-zinc-600">Set a new password for your account.</p>

        {!done ? (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="text-sm font-medium">New password</label>
              <input
                type="password"
                required
                className="mt-1 w-full rounded-xl border px-3 py-2.5"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Confirm password</label>
              <input
                type="password"
                required
                className="mt-1 w-full rounded-xl border px-3 py-2.5"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-zinc-900 px-3 py-2.5 text-white disabled:opacity-60"
            >
              {submitting ? "Resetting..." : "Reset password"}
            </button>
          </form>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-emerald-700">Password reset successful. You are now signed in.</p>
            <button
              type="button"
              onClick={() => router.replace("/dashboard")}
              className="w-full rounded-xl bg-zinc-900 px-3 py-2.5 text-white"
            >
              Continue to dashboard
            </button>
          </div>
        )}

        <p className="mt-4 text-sm text-zinc-600">
          Back to{" "}
          <Link className="font-medium text-zinc-900 underline" href="/login">
            sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center bg-white px-4 py-10 text-sm text-zinc-600">Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
