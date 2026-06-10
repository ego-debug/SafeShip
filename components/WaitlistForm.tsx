"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "ok" | "duplicate" | "error";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrMsg(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        duplicate?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setStatus("error");
        setErrMsg(
          data.error === "invalid_email"
            ? "That doesn't look like a valid email."
            : "Something went wrong. Try again?"
        );
        return;
      }
      setStatus(data.duplicate ? "duplicate" : "ok");
    } catch {
      setStatus("error");
      setErrMsg("Network error. Try again?");
    }
  }

  if (status === "ok" || status === "duplicate") {
    return (
      <div
        className="flex items-center gap-3 rounded-xl border border-line-strong px-4 py-3 text-sm text-fg-2"
        style={{ background: "rgba(194,249,112,0.06)" }}
        role="status"
      >
        <span
          className="grid h-5 w-5 place-items-center rounded-full text-accent"
          style={{ background: "rgba(194,249,112,0.15)" }}
          aria-hidden="true"
        >
          ✓
        </span>
        <span>
          {status === "duplicate"
            ? "You're already on the list. We'll be in touch."
            : "You're in. We'll email you when SafeShip opens up."}
        </span>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2.5">
      <label htmlFor="waitlist-email" className="sr-only">
        Email
      </label>
      <input
        id="waitlist-email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={status === "submitting"}
        className="min-w-[240px] flex-1 rounded-[9px] border border-line-strong bg-[rgba(255,255,255,0.02)] px-[14px] py-3 text-sm text-fg outline-none transition-colors placeholder:text-fg-4 focus:border-[rgba(255,255,255,0.25)]"
      />
      <button
        type="submit"
        disabled={status === "submitting"}
        className="rounded-[9px] bg-accent px-[18px] py-3 text-[14.5px] font-semibold text-bg shadow-[0_0_0_1px_rgba(194,249,112,0.35),0_12px_24px_-12px_rgba(0,0,0,0.55)] transition hover:-translate-y-px hover:bg-[#d3ff85] disabled:opacity-60"
      >
        {status === "submitting" ? "Adding…" : "Get early access →"}
      </button>
      <a
        href="/#how"
        className="inline-flex items-center gap-1.5 rounded-[9px] border border-line-strong px-[18px] py-3 text-[14.5px] text-fg transition-colors hover:border-[rgba(255,255,255,0.25)] hover:bg-[rgba(255,255,255,0.03)]"
      >
        See how it works
        <span className="ml-1.5 font-mono text-[11.5px] text-fg-3">90s</span>
      </a>

      {status === "error" && (
        <p className="w-full text-xs text-danger" role="alert">
          {errMsg}
        </p>
      )}
    </form>
  );
}
