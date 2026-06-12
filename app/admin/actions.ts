"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { deleteUserEverywhere, deleteWaitlistEmail, isAdmin } from "@/lib/admin";
import { hasAdminSession } from "@/lib/adminAuth";

function requireOwner(): void {
  if (hasAdminSession()) return;
  const { userId } = auth();
  if (userId && isAdmin(userId)) return;
  throw new Error("unauthorized");
}

export async function deleteUserAction(formData: FormData): Promise<void> {
  requireOwner();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;
  await deleteUserEverywhere(userId);
  revalidatePath("/admin");
}

export async function deleteWaitlistAction(formData: FormData): Promise<void> {
  requireOwner();
  const email = String(formData.get("email") ?? "");
  if (!email) return;
  await deleteWaitlistEmail(email);
  revalidatePath("/admin");
}
