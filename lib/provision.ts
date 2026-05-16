import { clerkClient } from "@clerk/nextjs/server";
import { generateApiKey } from "./apiKey.server";
import { getServiceSupabase } from "./supabase";

export type ProvisionedProject = {
  id: string;
  name: string;
  environment: string;
  api_key: string;
  first_trace_at: string | null;
  alerts_enabled: boolean;
  slack_webhook_url: string | null;
};

/**
 * Ensures the Clerk-authenticated user has a row in `users` and at least
 * one project with an API key. Idempotent. Use as a fallback to the
 * Clerk webhook for local dev or any case where the webhook hasn't fired.
 */
export async function getOrProvisionProject(
  clerkUserId: string,
): Promise<ProvisionedProject> {
  const supabase = getServiceSupabase();

  const { data: existing, error: selectErr } = await supabase
    .from("projects")
    .select("id, name, environment, api_key, first_trace_at, alerts_enabled, slack_webhook_url")
    .eq("user_id", clerkUserId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (selectErr) {
    throw new Error(`projects_select_failed: ${selectErr.message}`);
  }
  if (existing) return existing;

  const clerk = await clerkClient();
  const user = await clerk.users.getUser(clerkUserId);
  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    null;

  if (!email) {
    throw new Error("no_email_on_clerk_user");
  }

  const { error: userErr } = await supabase
    .from("users")
    .upsert({ id: clerkUserId, email }, { onConflict: "id" });
  if (userErr) throw new Error(`user_upsert_failed: ${userErr.message}`);

  const apiKey = generateApiKey();
  const { data: created, error: insertErr } = await supabase
    .from("projects")
    .insert({
      user_id: clerkUserId,
      name: "default",
      environment: "prod",
      api_key: apiKey,
    })
    .select("id, name, environment, api_key, first_trace_at, alerts_enabled, slack_webhook_url")
    .single();
  if (insertErr || !created) {
    throw new Error(`project_insert_failed: ${insertErr?.message}`);
  }

  return created;
}
