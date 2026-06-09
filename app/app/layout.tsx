import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Background } from "@/components/Background";
import { AppNav } from "@/components/AppNav";
import { CmdKPalette } from "@/components/CmdKPalette";

// Auth-only here. Subscription gating happens per-page via requireAccess()
// in lib/access.ts - layouts persist across sibling navigations in the
// App Router, so a redirect placed here would only fire on initial route
// load, not when a user clicks from /app/billing to /app/dashboard.

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  return (
    <>
      <Background />
      <div className="relative z-[1] mx-auto max-w-shell px-8">
        <AppNav />
        {children}
      </div>
      <CmdKPalette />
    </>
  );
}
