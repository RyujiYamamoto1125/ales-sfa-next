import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = sql();
  const rows = await db`SELECT * FROM cases ORDER BY created_at DESC`;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = sql();
  const body = await req.json();
  const nextMeeting = body.nextMeeting ? new Date(body.nextMeeting) : null;
  const contractedAt = body.status === "契約" ? new Date() : null;

  const rows = await db`
    INSERT INTO cases (customer_name, status, next_meeting, sales_person, appointer, notes, contracted_at)
    VALUES (${body.customerName}, ${body.status ?? "未実行"}, ${nextMeeting}, ${body.salesPerson ?? null}, ${body.appointer ?? null}, ${body.notes ?? null}, ${contractedAt})
    RETURNING *
  `;
  return NextResponse.json(rows[0], { status: 201 });
}
