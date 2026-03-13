"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/dashboard");
    } else {
      setError(true);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-sm px-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-[#E63946] flex items-center justify-center mb-4 shadow-lg">
            <span className="text-white font-bold text-xl tracking-tight">M51</span>
          </div>
          <h1 className="text-xl font-semibold text-foreground">AI OS Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Logg inn for å fortsette</p>
        </div>

        {/* Kort */}
        <form onSubmit={handleSubmit} className="rounded-xl border bg-card shadow-sm p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="password">
              Passord
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Skriv inn passord"
              autoFocus
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#E63946]/50 focus:border-[#E63946] transition-colors"
            />
            {error && (
              <p className="text-xs text-red-500 mt-1">Feil passord. Prøv igjen.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full rounded-lg bg-[#E63946] hover:bg-[#E63946]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm py-2.5 transition-colors"
          >
            {loading ? "Logger inn…" : "Logg inn"}
          </button>
        </form>
      </div>
    </div>
  );
}
