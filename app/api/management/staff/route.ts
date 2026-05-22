import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql, initSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await initSchema();
  const db = sql();
  const rows = await db`SELECT * FROM staff_contracts ORDER BY role, name`;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await initSchema();
  const db = sql();
  const b = await req.json();

  const rows = await db`
    INSERT INTO staff_contracts
      (name, role, employment_type, monthly_cost, commission_rate,
       per_contract_fee, per_contract_monthly_fee, per_meeting_fee,
       contract_start, contract_end, memo)
    VALUES
      (${b.name}, ${b.role}, ${b.employment_type},
       ${b.monthly_cost ?? 0}, ${b.commission_rate ?? 0},
       ${b.per_contract_fee ?? 0}, ${b.per_contract_monthly_fee ?? 0}, ${b.per_meeting_fee ?? 0},
       ${b.contract_start || null}, ${b.contract_end || null}, ${b.memo || null})
    RETURNING *
  `;
  return NextResponse.json(rows[0]);
}
