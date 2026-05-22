import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const db = sql();
  const b = await req.json();

  const rows = await db`
    UPDATE staff_contracts SET
      name                     = ${b.name},
      role                     = ${b.role},
      employment_type          = ${b.employment_type},
      monthly_cost             = ${b.monthly_cost ?? 0},
      commission_rate          = ${b.commission_rate ?? 0},
      per_contract_fee         = ${b.per_contract_fee ?? 0},
      per_contract_monthly_fee = ${b.per_contract_monthly_fee ?? 0},
      per_meeting_fee          = ${b.per_meeting_fee ?? 0},
      contract_start           = ${b.contract_start || null},
      contract_end             = ${b.contract_end || null},
      memo                     = ${b.memo || null},
      active                   = ${b.active ?? true}
    WHERE id = ${Number(id)}
    RETURNING *
  `;
  return NextResponse.json(rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const db = sql();
  await db`DELETE FROM staff_contracts WHERE id = ${Number(id)}`;
  return NextResponse.json({ ok: true });
}
