"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_COOKIE,
  isAdminLoginConfigured,
  mintAdminSession,
  verifyAdminCredentials,
} from "@/lib/adminAuth";

export async function adminLogin(formData: FormData): Promise<void> {
  if (!isAdminLoginConfigured()) {
    redirect("/admin/login?error=unconfigured");
  }

  const user = String(formData.get("user") ?? "");
  const pass = String(formData.get("pass") ?? "");

  if (!verifyAdminCredentials(user, pass)) {
    redirect("/admin/login?error=bad");
  }

  const session = mintAdminSession();
  if (!session) {
    redirect("/admin/login?error=unconfigured");
  }

  cookies().set(ADMIN_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: session.maxAgeSeconds,
    path: "/",
  });

  redirect("/admin");
}
