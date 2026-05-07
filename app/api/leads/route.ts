import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql, initSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initSchema();
  const db = sql();
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  if (year && month) {
    const rows = await db`
      SELECT * FROM leads
      WHERE EXTRACT(YEAR FROM date) = ${Number(year)}
        AND EXTRACT(MONTH FROM date) = ${Number(month)}
      ORDER BY date, medium
    `;
    return NextResponse.json(rows);
  }

  const rows = await db`SELECT * FROM leads ORDER BY date DESC, medium`;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "appointer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await initSchema();
  const db = sql();
  const { date, medium, leadCount } = await req.json();

  const rows = await db`
    INSERT INTO leads (date, medium, lead_count)
    VALUES (${date}, ${medium}, ${leadCount})
    ON CONFLICT (date, medium) DO UPDATE SET lead_count = ${leadCount}
    RETURNING *
  `;
  return NextResponse.json(rows[0]);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = sql();
  const { id } = await req.json();
  await db`DELETE FROM leads WHERE id = ${id}`;
  return NextResponse.json({ success: true });
}
