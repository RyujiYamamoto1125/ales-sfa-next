import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = sql();
  const body = await req.json();
  const role = session.user.role;

  const existing = await db`SELECT * FROM cases WHERE id = ${id}`;
  if (!existing.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cur = existing[0];

  if (role === "appointer") {
    // アポインターは顧客名・アポインター名・商談日・備考のみ更新可
    const rows = await db`
      UPDATE cases SET
        customer_name = ${body.customerName ?? cur.customer_name},
        appointer     = ${body.appointer ?? cur.appointer},
        next_meeting  = ${body.nextMeeting ? new Date(body.nextMeeting) : cur.next_meeting},
        notes         = ${body.notes ?? cur.notes},
        updated_at    = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    return NextResponse.json(rows[0]);
  }

  // admin / sales: 全フィールド更新可（削除はadminのみ）
  const nextMeeting = body.nextMeeting ? new Date(body.nextMeeting) : null;
  const contractedAt =
    body.status === "契約" && !cur.contracted_at ? new Date() : cur.contracted_at;

  const rows = await db`
    UPDATE cases SET
      customer_name = ${body.customerName},
      status        = ${body.status},
      next_meeting  = ${nextMeeting},
      sales_person  = ${body.salesPerson ?? null},
      appointer     = ${body.appointer ?? null},
      notes         = ${body.notes ?? null},
      contracted_at = ${contractedAt},
      updated_at    = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return NextResponse.json(rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const db = sql();
  await db`DELETE FROM cases WHERE id = ${id}`;
  return NextResponse.json({ success: true });
}
