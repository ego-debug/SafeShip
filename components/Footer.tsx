import Link from "next/link";
import { BrandMark } from "./BrandMark";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line py-14 pb-9 text-fg-4">
      <div className="grid grid-cols-1 gap-9 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] md:gap-12">
        <div>
          <Link href="/" className="mb-3 inline-flex items-center gap-2.5 text-fg-3">
            <BrandMark />
            <span className="text-[15px] font-semibold tracking-tight">
              SafeShip
            </span>
          </Link>
          <p className="mb-3.5 max-w-[260px] text-[13px] leading-[1.5] text-fg-3">
            Reliability for AI agents.
          </p>
          <p className="font-mono text-[11px] tracking-wide text-fg-4">
            © 2026 SafeShip, Inc.
          </p>
        </div>

        <FooterCol
          title="Product"
          links={[
            { label: "Pricing", href: "/pricing" },
            { label: "Docs", href: "/docs" },
            { label: "Changelog", href: "/changelog" },
            { label: "Migrate from Helicone", href: "/migrate/helicone" },
          ]}
        />
        <FooterCol
          title="Company"
          links={[
            { label: "Contact", href: "mailto:founder@safeship.dev" },
            { label: "Security", href: "/security" },
          ]}
        />
        <FooterCol
          title="Resources"
          links={[
            { label: "GitHub", href: "https://github.com/ego-debug/SafeShip" },
            { label: "Status", href: "/status" },
          ]}
        />
      </div>

      <div className="my-10 h-px bg-line md:my-10" />

      <div className="flex items-center gap-3.5 font-mono text-[11px] tracking-wide text-fg-4">
        <Link href="/privacy" className="text-fg-4 hover:text-fg-3">
          Privacy
        </Link>
        <span className="opacity-60">·</span>
        <Link href="/terms" className="text-fg-4 hover:text-fg-3">
          Terms
        </Link>
        <span className="opacity-60">·</span>
        <Link href="/security" className="text-fg-4 hover:text-fg-3">
          Security
        </Link>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h5 className="mb-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-fg-4">
        {title}
      </h5>
      <ul className="flex flex-col gap-2.5">
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={l.href}
              className="text-[13.5px] text-fg-3 transition-colors hover:text-fg-2"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
