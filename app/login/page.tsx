"use client";

import { FormEvent, useState } from "react";
import DemoNotice from "@/components/DemoNotice";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).catch(() => null);
    if (res?.ok) {
      window.location.href = "/support";
      return;
    }
    const code = await res?.json().then((d) => d.error?.code).catch(() => null);
    setError(
      code === "no-db" ? "Staff sign-in needs a database. See docs/testing-guide.md."
      : code === "rate_limited" ? "Too many attempts. Wait a minute and try again."
      : "That email or password isn't right.",
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DemoNotice />
      <main className="max-w-sm mx-auto mt-16 p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
        <h1 className="text-lg font-bold text-gray-900 mb-4">Staff sign in</h1>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="email" className="block text-xs text-gray-600 mb-1">Email</label>
            <input id="email" type="email" required autoComplete="username" value={email}
              onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
          </div>
          <div>
            <label htmlFor="password" className="block text-xs text-gray-600 mb-1">Password</label>
            <input id="password" type="password" required autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
          </div>
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
          <button type="submit" className="w-full py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm rounded-lg font-medium">Sign in</button>
        </form>
      </main>
    </div>
  );
}
