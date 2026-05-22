import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = sql();
  const rows = await db`
    SELECT * FROM ad_creatives
    ORDER BY spend DESC, cv_count DESC
  `;
  return NextResponse.json(rows);
}
