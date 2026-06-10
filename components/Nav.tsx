import Link from "next/link";
import { BrandMark } from "./BrandMark";

export function Nav() {
  return (
    <nav className="flex animate-rise items-center justify-between border-b border-line py-[22px]">
      <Link href="/" className="flex items-center gap-[10px] text-fg">
        <BrandMark />
        <span className="text-[15px] font-semibold tracking-tight">
          SafeShip
        </span>
      </Link>

      <div className="hidden items-center gap-7 md:flex">
        {/* /#how, not bare #how: this nav renders on every page, and a
            bare fragment is a dead click anywhere but the landing page. */}
        <a href="/#how" className="text-sm text-fg-2 transition-colors hover:text-fg">
          Product
        </a>
        <a href="/docs" className="text-sm text-fg-2 transition-colors hover:text-fg">
          Docs
        </a>
        <a href="/pricing" className="text-sm text-fg-2 transition-colors hover:text-fg">
          Pricing
        </a>
      </div>

      <div className="flex items-center gap-2">
        <a
          href="/sign-in"
          className="rounded-lg px-[14px] py-2 text-sm text-fg-2 transition-colors hover:text-fg"
        >
          Sign in
        </a>
        <a
          href="/sign-up"
          className="rounded-lg bg-fg px-[14px] py-2 text-sm font-semibold text-bg shadow-[0_1px_0_rgba(255,255,255,0.5)_inset] transition hover:bg-white hover:-translate-y-px"
        >
          Start 7-day free trial
        </a>
      </div>
    </nav>
  );
}
