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
  const year  = searchParams.get("year");
  const month = searchParams.get("month");

  if (year && month) {
    const rows = await db`
      SELECT * FROM ad_metrics
      WHERE EXTRACT(YEAR  FROM date) = ${Number(year)}
        AND EXTRACT(MONTH FROM date) = ${Number(month)}
      ORDER BY date DESC, medium
    `;
    return NextResponse.json(rows);
  }

  const rows = await db`SELECT * FROM ad_metrics ORDER BY date DESC, medium`;
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
  const { date, medium, adSpend, dashboardCv, actualCv, clicks, impressions } = await req.json();

  const rows = await db`
    INSERT INTO ad_metrics (date, medium, ad_spend, dashboard_cv, actual_cv, clicks, impressions)
    VALUES (${date}, ${medium}, ${Number(adSpend)}, ${Number(dashboardCv)}, ${Number(actualCv)}, ${Number(clicks)}, ${Number(impressions)})
    ON CONFLICT (date, medium) DO UPDATE SET
      ad_spend     = ${Number(adSpend)},
      dashboard_cv = ${Number(dashboardCv)},
      actual_cv    = ${Number(actualCv)},
      clicks       = ${Number(clicks)},
      impressions  = ${Number(impressions)},
      updated_at   = NOW()
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
  await db`DELETE FROM ad_metrics WHERE id = ${id}`;
  return NextResponse.json({ success: true });
}
