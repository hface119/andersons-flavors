"use client";

import { useState, useEffect } from "react";
import Dashboard from "./dashboard";

export default function Home() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/check")
      .then((r) => setAuthed(r.ok))
      .catch(() => setAuthed(false));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      setAuthed(true);
    } else {
      setError("Incorrect password. Please try again.");
    }
    setLoading(false);
  }

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" });
    setAuthed(false);
    setPassword("");
  }

  if (authed === null) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner-lg" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="login-wrapper">
        <form className="login-card" onSubmit={handleLogin}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://cdn.prod.website-files.com/6530928229391255a094fe2a/6530a6d4ffeafda603ade075_AndersonsLogo.svg"
            alt="Anderson's Frozen Custard"
            className="login-logo"
          />
          <h1>Flavor Calendar</h1>
          <p>Sign in to manage daily custard flavors</p>
          {error && <div className="login-error">{error}</div>}
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          <button className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
            {loading ? <span className="spinner" /> : "Sign In"}
          </button>
        </form>
      </div>
    );
  }

  return <Dashboard onLogout={handleLogout} />;
}
