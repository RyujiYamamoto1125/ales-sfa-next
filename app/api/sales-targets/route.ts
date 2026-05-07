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
      SELECT * FROM sales_targets
      WHERE year = ${Number(year)} AND month = ${Number(month)}
      ORDER BY sales_person
    `;
    return NextResponse.json(rows);
  }

  const rows = await db`SELECT * FROM sales_targets ORDER BY year, month, sales_person`;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await initSchema();
  const db = sql();
  const { salesPerson, year, month, targetContracts, targetAmount } = await req.json();

  const rows = await db`
    INSERT INTO sales_targets (sales_person, year, month, target_contracts, target_amount)
    VALUES (${salesPerson}, ${year}, ${month}, ${targetContracts}, ${targetAmount})
    ON CONFLICT (sales_person, year, month)
    DO UPDATE SET target_contracts = ${targetContracts}, target_amount = ${targetAmount}
    RETURNING *
  `;
  return NextResponse.json(rows[0]);
}
