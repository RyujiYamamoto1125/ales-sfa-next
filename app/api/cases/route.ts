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
      lead_source, document_request_date,
      customer_name, position, furigana,
      email_address, phone, notes,
      appointer, next_meeting,
      status
    )
    VALUES (
      ${body.leadSource ?? null},
      ${body.documentRequestDate ? new Date(body.documentRequestDate) : null},
      ${body.customerName},
      ${body.position ?? null},
      ${body.furigana ?? null},
      ${body.emailAddress ?? null},
      ${body.phone ?? null},
      ${body.notes ?? null},
      ${body.appointer ?? null},
      ${body.nextMeeting ? new Date(body.nextMeeting) : null},
      '未実行'
    )
    RETURNING *
  `;
  return NextResponse.json(rows[0], { status: 201 });
}
