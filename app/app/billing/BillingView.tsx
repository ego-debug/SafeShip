"use client";

import Link from "next/link";
import { useState } from "react";
import type { Subscription } from "@/lib/subscriptions";

export function BillingView({
  subscription,
  isOwner,
  checkoutStatus,
  stripeConfigured,
}: {
  subscription: Subscription;
  isOwner: boolean;
  checkoutStatus: string | null;
  stripeConfigured: boolean;
}) {
  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function startCheckout() {
    setBusy("checkout");
    setErr(null);
    try {
      const r = await fetch("/api/billing/checkout", { method: "POST" });
      const data = (await r.json()) as { ok?: boolean; url?: string; error?: string };
      if (!r.ok || !data.url) {
        setErr(data.error ?? "checkout_failed");
        return;
      }
      window.location.href = data.url;
    } catch {
      setErr("network_error");
    } finally {
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy("portal");
    setErr(null);
    try {
      const r = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await r.json()) as { ok?: boolean; url?: string; error?: string };
      if (!r.ok || !data.url) {
        setErr(data.error ?? "portal_failed");
        return;
      }
      window.location.href = data.url;
    } catch {
      setErr("network_error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="flex flex-col gap-8 py-10">
      <header className="flex flex-col gap-2">
        <span className="inline-flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-fg-3">
          <span
            className="h-1.5 w-1.5 rounded-full bg-accent"
            style={{ boxShadow: "0 0 8px rgba(194,249,112,0.6)" }}
          />
          Billing
        </span>
        <h1 className="text-[clamp(28px,3vw,36px)] font-semibold leading-[1.1] tracking-[-0.025em]">
          {isOwner
            ? "Owner account — billing skipped"
            : subscription.cancel_at_period_end &&
              (subscription.status === "trialing" || subscription.status === "active")
            ? "Subscription canceled — won't renew"
            : subscription.status === "active"
            ? "SafeShip Pro — active"
            : subscription.status === "trialing"
            ? "SafeShip Pro — 7-day free trial"
            : subscription.status === "past_due"
            ? "Payment failed — please update your card"
            : subscription.status === "canceled"
            ? "Subscription canceled"
            : "Start your 7-day free trial"}
        </h1>
      </header>

      {checkoutStatus === "success" && (
        <Banner tone="ok">
          ✓ Card on file. Welcome to SafeShip — your 7-day trial starts now.
        </Banner>
      )}
      {checkoutStatus === "canceled" && (
        <Banner tone="warn">
          You canceled checkout. No card was charged. You can start the trial
          anytime below.
        </Banner>
      )}
      {err && <Banner tone="error">{humanizeBillingError(err)}</Banner>}

      {isOwner ? (
        <OwnerCard />
      ) : !stripeConfigured ? (
        <NotConfiguredCard />
      ) : (
        <SubscriptionCard
          subscription={subscription}
          busy={busy}
          onCheckout={startCheckout}
          onPortal={openPortal}
        />
      )}

      <aside className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <InfoCard
          title="What you get on Pro"
          body="Unlimited agent traces, unlimited projects, auto-suggested regression tests, deploy gating via GitHub Action, email + Slack alerts (Slack coming soon)."
        />
        <InfoCard
          title="Cancel anytime"
          body="Manage your subscription from the Stripe customer portal — cancel, update card, see invoices. No refunds for partial months but you keep access until current period ends."
        />
        <InfoCard
          title="Trial details"
          body="Card required upfront. Stripe holds it for 7 days, doesn't charge. After 7 days your card is auto-billed $29.99/mo. Cancel before day 7 = $0 charged."
        />
      </aside>
    </main>
  );
}

function SubscriptionCard({
  subscription,
  busy,
  onCheckout,
  onPortal,
}: {
  subscription: Subscription;
  busy: "checkout" | "portal" | null;
  onCheckout: () => void;
  onPortal: () => void;
}) {
  const hasSub = subscription.stripe_subscription_id != null;
  return (
    <section
      className="flex flex-col gap-6 rounded-2xl border border-line-strong p-6"
      style={{
        background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.04) inset, 0 30px 60px -28px rgba(0,0,0,0.6)",
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-1.5">
          <span className="-translate-y-3 text-[22px] font-medium text-fg-2">
            $
          </span>
          <span className="text-[60px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-fg">
            29
          </span>
          <span className="-translate-y-3 text-[22px] font-medium text-fg-2">
            .99
          </span>
          <span className="ml-1 text-fg-3">/ month</span>
        </div>
        <StatusBadge
          status={subscription.status}
          cancelAtPeriodEnd={subscription.cancel_at_period_end}
        />
      </div>

      <Meta subscription={subscription} />

      <div className="flex flex-wrap items-center gap-3">
        {!hasSub && subscription.status !== "canceled" && (
          <button
            onClick={onCheckout}
            disabled={busy != null}
            className="inline-flex items-center gap-2 rounded-[9px] bg-accent px-5 py-2.5 text-sm font-semibold text-bg shadow-[0_0_0_1px_rgba(194,249,112,0.4),0_10px_24px_-10px_rgba(194,249,112,0.4)] transition hover:-translate-y-px hover:bg-[#d3ff85] disabled:opacity-60"
          >
            {busy === "checkout" ? "Redirecting…" : "Start 7-day free trial →"}
          </button>
        )}
        {hasSub && (
          <button
            onClick={onPortal}
            disabled={busy != null}
            className="inline-flex items-center gap-2 rounded-[9px] border border-line-strong bg-[rgba(255,255,255,0.02)] px-5 py-2.5 text-sm text-fg transition-colors hover:border-[rgba(255,255,255,0.25)] disabled:opacity-60"
          >
            {busy === "portal" ? "Opening…" : "Manage subscription →"}
          </button>
        )}
        {subscription.status === "trialing" ||
        subscription.status === "active" ? (
          <Link
            href="/app/dashboard"
            className="text-sm text-fg-3 hover:text-fg-2"
          >
            ← back to dashboard
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function Meta({ subscription }: { subscription: Subscription }) {
  // Pending cancellation (user cancelled, period hasn't ended yet) takes
  // priority over the trial/active default copy — otherwise the page reads
  // like the cancel didn't go through.
  if (
    subscription.cancel_at_period_end &&
    (subscription.status === "trialing" || subscription.status === "active")
  ) {
    const end =
      subscription.current_period_end ?? subscription.trial_ends_at;
    if (end) {
      return (
        <p className="text-[13.5px] text-fg-2">
          You canceled. Access continues until {fmtDate(end)} (
          {daysUntil(end)}) — your card won&apos;t be charged. Resume anytime
          from the customer portal.
        </p>
      );
    }
  }
  if (subscription.status === "trialing" && subscription.trial_ends_at) {
    return (
      <p className="text-[13.5px] text-fg-2">
        Trial ends {fmtDate(subscription.trial_ends_at)} (
        {daysUntil(subscription.trial_ends_at)}). Your card will be charged
        $29.99 unless you cancel before then.
      </p>
    );
  }
  if (subscription.status === "active" && subscription.current_period_end) {
    return (
      <p className="text-[13.5px] text-fg-2">
        Next charge {fmtDate(subscription.current_period_end)} (
        {daysUntil(subscription.current_period_end)}).
      </p>
    );
  }
  if (subscription.status === "past_due") {
    return (
      <p className="text-[13.5px] text-danger">
        Your last payment failed. Open the customer portal to update your card
        before access is suspended.
      </p>
    );
  }
  if (subscription.status === "canceled" && subscription.current_period_end) {
    return (
      <p className="text-[13.5px] text-fg-2">
        Subscription canceled. Access continues until{" "}
        {fmtDate(subscription.current_period_end)}.
      </p>
    );
  }
  return (
    <p className="text-[13.5px] text-fg-2">
      Card required upfront. Stripe collects it but doesn&apos;t charge for 7
      days. Auto-bills $29.99/month after that. Cancel anytime — cancel before
      day 7 = $0 charged.
    </p>
  );
}

function StatusBadge({
  status,
  cancelAtPeriodEnd,
}: {
  status: Subscription["status"];
  cancelAtPeriodEnd: boolean;
}) {
  const cfg =
    cancelAtPeriodEnd && (status === "active" || status === "trialing")
      ? { label: "CANCELING", color: "text-fg-3", bg: "rgba(255,255,255,0.05)" }
      : status === "active" || status === "trialing"
      ? { label: status.toUpperCase(), color: "text-accent", bg: "rgba(194,249,112,0.10)" }
      : status === "past_due"
      ? { label: "PAST DUE", color: "text-danger", bg: "rgba(255,107,107,0.10)" }
      : status === "canceled"
      ? { label: "CANCELED", color: "text-fg-3", bg: "rgba(255,255,255,0.05)" }
      : { label: "NOT SUBSCRIBED", color: "text-fg-3", bg: "rgba(255,255,255,0.05)" };
  return (
    <span
      className={`rounded-full px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em] ${cfg.color}`}
      style={{ background: cfg.bg }}
    >
      {cfg.label}
    </span>
  );
}

function OwnerCard() {
  return (
    <section
      className="rounded-2xl border border-line-strong p-6"
      style={{
        background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)",
      }}
    >
      <p className="text-[15px] text-fg">
        You&apos;re flagged as an owner account in{" "}
        <code className="rounded border border-line bg-black/40 px-1.5 py-0.5 font-mono text-[12.5px]">
          SAFESHIP_OWNER_CLERK_IDS
        </code>{" "}
        — full access without a Stripe subscription. Remove your Clerk user
        ID from that env var to test the real billing flow.
      </p>
    </section>
  );
}

function NotConfiguredCard() {
  return (
    <section
      className="rounded-2xl border px-6 py-5"
      style={{
        background: "rgba(245,193,74,0.06)",
        borderColor: "rgba(245,193,74,0.32)",
      }}
    >
      <p className="text-[14.5px] text-fg">
        <b>Billing isn&apos;t configured yet.</b> Set{" "}
        <code className="rounded border border-line bg-black/40 px-1.5 py-0.5 font-mono text-[12.5px]">
          STRIPE_SECRET_KEY
        </code>
        ,{" "}
        <code className="rounded border border-line bg-black/40 px-1.5 py-0.5 font-mono text-[12.5px]">
          STRIPE_PRICE_ID
        </code>
        , and{" "}
        <code className="rounded border border-line bg-black/40 px-1.5 py-0.5 font-mono text-[12.5px]">
          STRIPE_WEBHOOK_SECRET
        </code>{" "}
        in your environment and redeploy.
      </p>
    </section>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-line-strong p-4">
      <h3 className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-fg-4">
        {title}
      </h3>
      <p className="text-[13.5px] leading-relaxed text-fg-2">{body}</p>
    </div>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "error";
  children: React.ReactNode;
}) {
  const bg =
    tone === "ok"
      ? "rgba(194,249,112,0.08)"
      : tone === "warn"
      ? "rgba(245,193,74,0.08)"
      : "rgba(255,107,107,0.10)";
  const border =
    tone === "ok"
      ? "rgba(194,249,112,0.32)"
      : tone === "warn"
      ? "rgba(245,193,74,0.32)"
      : "rgba(255,107,107,0.32)";
  return (
    <div
      className="rounded-xl border px-4 py-3 text-sm"
      style={{ background: bg, borderColor: border }}
    >
      {children}
    </div>
  );
}

// API routes return short error codes; translate to something a person
// can act on rather than echoing "checkout_failed" verbatim.
function humanizeBillingError(code: string): string {
  switch (code) {
    case "checkout_failed":
      return "Couldn't start checkout. Try again in a moment — if it keeps failing, email founder@safeship.dev.";
    case "portal_failed":
      return "Couldn't open the customer portal. Try again in a moment — if it keeps failing, email founder@safeship.dev.";
    case "network_error":
      return "Network error — check your connection and try again.";
    case "billing_not_configured":
      return "Billing isn't configured on this deployment yet.";
    case "no_customer":
      return "No subscription found for this account. Start the free trial first.";
    default:
      return `Something went wrong (${code}). Try again, or email founder@safeship.dev.`;
  }
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const d = Math.ceil(diff / 86_400_000);
  if (d <= 0) return "today";
  if (d === 1) return "tomorrow";
  return `in ${d} days`;
}
