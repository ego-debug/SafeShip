import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { generateApiKey } from "@/lib/apiKey.server";
import { getServiceSupabase } from "@/lib/supabase";

// Clerk → Svix-signed webhook. Configure the endpoint in the Clerk dashboard
// under Webhooks → Add endpoint, and copy the signing secret into
// CLERK_WEBHOOK_SIGNING_SECRET in .env.local. Subscribe to `user.created`.

type ClerkUserCreated = {
  type: "user.created";
  data: {
    id: string;
    email_addresses: Array<{ id: string; email_address: string }>;
    primary_email_address_id: string | null;
  };
};

type ClerkUserDeleted = {
  type: "user.deleted";
  data: { id: string };
};

type ClerkEvent = ClerkUserCreated | ClerkUserDeleted | { type: string; data: unknown };

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "webhook_not_configured" },
      { status: 500 },
    );
  }

  const h = headers();
  const svixId = h.get("svix-id");
  const svixTimestamp = h.get("svix-timestamp");
  const svixSignature = h.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "missing_svix_headers" }, { status: 400 });
  }

  const body = await req.text();

  let event: ClerkEvent;
  try {
    event = new Webhook(secret).verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkEvent;
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  if (event.type === "user.created") {
    const { id, email_addresses, primary_email_address_id } =
      event.data as ClerkUserCreated["data"];
    const email =
      email_addresses.find((e) => e.id === primary_email_address_id)?.email_address ??
      email_addresses[0]?.email_address;

    if (!email) {
      return NextResponse.json({ error: "no_email" }, { status: 400 });
    }

    const { error: userErr } = await supabase
      .from("users")
      .upsert({ id, email }, { onConflict: "id" });
    if (userErr) {
      return NextResponse.json({ error: "user_upsert_failed" }, { status: 500 });
    }

    // Ensure a default project + api key exists for this user
    const { data: existing } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", id)
      .limit(1)
      .maybeSingle();

    if (!existing) {
      const { error: projErr } = await supabase.from("projects").insert({
        user_id: id,
        name: "default",
        environment: "prod",
        api_key: generateApiKey(),
      });
      if (projErr) {
        return NextResponse.json(
          { error: "project_insert_failed" },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ ok: true });
  }

  if (event.type === "user.deleted") {
    const { id } = event.data as ClerkUserDeleted["data"];
    await supabase.from("users").delete().eq("id", id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, ignored: event.type });
}
