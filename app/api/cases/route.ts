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
  const role = session.user.role;

  // アポインターは顧客名・アポインター・商談日のみ登録可
  const customerName = body.customerName;
  const nextMeeting = body.nextMeeting ? new Date(body.nextMeeting) : null;

  let status = "未実行";
  let salesPerson: string | null = null;
  let appointer: string | null = body.appointer ?? null;
  let notes: string | null = null;
  let contractedAt: Date | null = null;

  if (role === "admin" || role === "sales") {
    status = body.status ?? "未実行";
    salesPerson = body.salesPerson ?? null;
    appointer = body.appointer ?? null;
    notes = body.notes ?? null;
    if (status === "契約") contractedAt = new Date();
  }

  const rows = await db`
    INSERT INTO cases (customer_name, status, next_meeting, sales_person, appointer, notes, contracted_at)
    VALUES (${customerName}, ${status}, ${nextMeeting}, ${salesPerson}, ${appointer}, ${notes}, ${contractedAt})
    RETURNING *
  `;
  return NextResponse.json(rows[0], { status: 201 });
}
