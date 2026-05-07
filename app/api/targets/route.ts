import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = sql();
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  if (year && month) {
    const rows = await db`SELECT target_count FROM targets WHERE year = ${Number(year)} AND month = ${Number(month)} LIMIT 1`;
    return NextResponse.json({ targetCount: rows[0]?.target_count ?? 0 });
  }

  const rows = await db`SELECT * FROM targets ORDER BY year, month`;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = sql();
  const { year, month, targetCount } = await req.json();

  const rows = await db`
    INSERT INTO targets (year, month, target_count)
    VALUES (${year}, ${month}, ${targetCount})
    ON CONFLICT (year, month) DO UPDATE SET target_count = ${targetCount}
    RETURNING *
  `;
  return NextResponse.json(rows[0]);
}
