import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchAdReport } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = await fetchAdReport();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isNotConfigured = message.includes("未設定");
    return NextResponse.json(
      { error: message, notConfigured: isNotConfigured },
      { status: isNotConfigured ? 503 : 500 }
    );
  }
}
