import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { BrandMark } from "./BrandMark";
import { CmdKHint } from "./CmdKHint";

export function AppNav() {
  return (
    <nav className="flex animate-rise items-center justify-between border-b border-line py-[18px]">
      <div className="flex items-center gap-7">
        <Link href="/" className="flex items-center gap-[10px] text-fg" title="Back to safeship.dev">
          <BrandMark />
          <span className="text-[15px] font-semibold tracking-tight">
            SafeShip
          </span>
        </Link>
        <div className="hidden items-center gap-5 text-sm md:flex">
          <NavTab href="/app/dashboard" label="Overview" />
          <NavTab href="/app/suggestions" label="Suggestions" />
          <NavTab href="/app/tests" label="Tests" />
          <NavTab href="/app/onboarding" label="Setup" />
          <NavTab href="/app/billing" label="Billing" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <CmdKHint />
        <Link
          href="/designs/dashboard.html"
          className="hidden text-xs text-fg-3 hover:text-fg-2 md:inline"
          title="HTML prototypes, not yet React-ported"
        >
          Prototype gallery →
        </Link>
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: { avatarBox: "h-7 w-7" },
          }}
        />
      </div>
    </nav>
  );
}

function NavTab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-fg-2 transition-colors hover:text-fg"
    >
      {label}
    </Link>
  );
}
