"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import DemoNotice from "@/components/DemoNotice";

export interface Me {
  email: string;
  displayName: string;
  roles: string[];
  permissions: string[];
}

function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [problem, setProblem] = useState("");
  useEffect(() => {
    fetch("/api/auth/me").then(async (res) => {
      if (res.status === 401) window.location.href = "/login";
      else if (res.status === 503) setProblem("Staff pages need a database. See docs/testing-guide.md.");
      else if (res.ok) setMe(await res.json());
      else setProblem("Couldn't check your session.");
    }).catch(() => setProblem("Couldn't check your session."));
  }, []);
  return { me, problem };
}

const LINKS: { href: string; label: string; permission: string }[] = [
  { href: "/dashboard",   label: "Analytics",   permission: "analytics:read" },
  { href: "/support",     label: "Support queue", permission: "escalations:read" },
  { href: "/knowledge",   label: "Knowledge",   permission: "knowledge:read" },
  { href: "/reviews",     label: "Reviews",     permission: "reviews:write" },
  { href: "/evaluations", label: "Evaluations", permission: "evaluations:read" },
  { href: "/audit",       label: "Audit log",   permission: "audit:read" },
];

// These links only tidy the interface. Every API route checks permissions itself.
export function StaffNav() {
  const { me } = useMe();
  if (!me) return null;
  return (
    <nav aria-label="Staff" className="flex flex-wrap items-center gap-4 px-6 py-2 bg-white border-b border-gray-200 text-xs">
      <Link href="/" className="text-gray-400 hover:text-gray-600">Call demo</Link>
      {LINKS.filter((l) => me.permissions.includes(l.permission)).map((l) => (
        <Link key={l.href} href={l.href} className="text-teal-700 hover:underline">{l.label}</Link>
      ))}
      <span className="ml-auto text-gray-500">{me.displayName} ({me.roles.join(", ")})</span>
      <button
        onClick={() => fetch("/api/auth/logout", { method: "POST" }).then(() => { window.location.href = "/login"; })}
        className="text-gray-500 underline"
      >
        Sign out
      </button>
    </nav>
  );
}

export default function StaffShell({ title, intro, children }: {
  title: string;
  intro?: string;
  children: (me: Me) => ReactNode;
}) {
  const { me, problem } = useMe();
  return (
    <div className="min-h-screen bg-gray-50">
      <DemoNotice />
      <StaffNav />
      <main className="max-w-5xl mx-auto p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          {intro && <p className="text-xs text-gray-500 mt-1">{intro}</p>}
        </div>
        {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
        {me && children(me)}
      </main>
    </div>
  );
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.json !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.json !== undefined ? JSON.stringify(init.json) : undefined,
  });
  if (res.status === 401) window.location.href = "/login";
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: { code?: string } }).error?.code ?? `HTTP ${res.status}`);
  return data as T;
}
