import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(
  _req: Request,
  { params }: { params: { projectId: string } },
) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("projects")
    .select("first_trace_at")
    .eq("id", params.projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ first_trace_at: data.first_trace_at });
}
