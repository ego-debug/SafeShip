import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "SafeShip — The same bug never ships twice.",
  description:
    "Every production failure becomes a regression test. Drop in a 4-line SDK — SafeShip captures the trace, writes the assertion, and blocks any future deploy that would reproduce it.",
  metadataBase: new URL("https://safeship.dev"),
  openGraph: {
    title: "SafeShip — The same bug never ships twice.",
    description:
      "Every production failure becomes a regression test. $29/mo flat, no seats.",
    url: "https://safeship.dev",
    siteName: "SafeShip",
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
          colorTextSecondary: "#b4b4b8",
          colorTextOnPrimaryBackground: "#0a0a0b",
          colorInputBackground: "rgba(255,255,255,0.02)",
          colorInputText: "#f5f5f6",
          colorNeutral: "#f5f5f6",
          borderRadius: "10px",
        },
        elements: {
          socialButtonsBlockButton:
            "border border-line-strong bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.06)]",
          socialButtonsBlockButtonText: "text-fg font-medium",
          formButtonPrimary: "text-bg font-semibold",
          footerActionLink: "text-accent hover:text-[#d3ff85]",
          identityPreviewEditButton: "text-accent",
          formFieldLabel: "text-fg-2",
          formFieldInput: "text-fg",
        },
      }}
    >
      {body}
    </ClerkProvider>
  );
}
