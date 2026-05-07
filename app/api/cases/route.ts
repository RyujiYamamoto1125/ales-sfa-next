import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql, initSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initSchema();
  const db = sql();
  const rows = await db`SELECT * FROM cases ORDER BY created_at DESC`;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role !== "appointer") {
    return NextResponse.json({ error: "Forbidden: 新規登録はアポインターのみ可能です" }, { status: 403 });
  }

  await initSchema();
  const db = sql();
  const body = await req.json();

  const rows = await db`
    INSERT INTO cases (
      customer_name, contact_person, email_address, phone,
      status, next_meeting, appointer, lead_source, notes
    )
    VALUES (
      ${body.customerName},
      ${body.contactPerson ?? null},
      ${body.emailAddress ?? null},
      ${body.phone ?? null},
      '未実行',
      ${body.nextMeeting ? new Date(body.nextMeeting) : null},
      ${body.appointer ?? null},
      ${body.leadSource ?? null},
      ${body.notes ?? null}
    )
    RETURNING *
  `;
  return NextResponse.json(rows[0], { status: 201 });
}
