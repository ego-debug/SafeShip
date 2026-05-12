import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "SafeLoop — Catch your AI agent failing before your users do.",
  description:
    "Drop a 4-line SDK into your agent. SafeLoop traces every run, turns production failures into test cases, and blocks the deploy when it regresses.",
  metadataBase: new URL("https://safeloop.dev"),
  openGraph: {
    title: "SafeLoop — Reliability for AI agents",
    description:
      "Catch your AI agent failing before your users do. $29/mo flat. No seats.",
    url: "https://safeloop.dev",
    siteName: "SafeLoop",
    type: "website",
  },
};

const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const body = (
    <html lang="en">
      <body>{children}</body>
    </html>
  );

  if (!clerkConfigured) return body;

  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#c2f970",
          colorBackground: "#0a0a0b",
          colorText: "#f5f5f6",
          colorInputBackground: "rgba(255,255,255,0.02)",
          colorInputText: "#f5f5f6",
          borderRadius: "10px",
        },
      }}
    >
      {body}
    </ClerkProvider>
  );
}
