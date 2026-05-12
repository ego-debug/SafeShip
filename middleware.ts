import { NextResponse, type NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher(["/app(.*)"]);

const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY,
);

const realClerkMiddleware = clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) {
    const session = auth();
    if (!session.userId) return session.redirectToSignIn();
  }
  // Forward the current pathname so server components (specifically
  // app/app/layout.tsx) can do subscription gating without re-deriving it.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
});

// If Clerk env vars aren't set yet (typical local dev before user pastes
// their keys), short-circuit: public routes work; protected /app/* routes
// 503 with a clear message telling the dev what's missing.
function fallbackMiddleware(req: NextRequest) {
  if (isProtectedRoute(req)) {
    return new NextResponse(
      "Auth not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in .env.local.",
      { status: 503, headers: { "content-type": "text/plain" } },
    );
  }
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export default clerkConfigured ? realClerkMiddleware : fallbackMiddleware;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
