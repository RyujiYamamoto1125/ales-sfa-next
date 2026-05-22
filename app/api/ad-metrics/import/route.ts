import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql, initSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

interface ImportRow {
  date: string;
  medium: string;
  adSpend: number;
  dashboardCv: number;
  actualCv: number;
  clicks: number;
  impressions: number;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "appointer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await initSchema();
  const db = sql();
  const rows: ImportRow[] = await req.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows" }, { status: 400 });
  }

  let count = 0;
  for (const row of rows) {
    await db`
      INSERT INTO ad_metrics (date, medium, ad_spend, dashboard_cv, actual_cv, clicks, impressions)
      VALUES (
        ${row.date}, ${row.medium},
        ${row.adSpend}, ${row.dashboardCv}, ${row.actualCv},
        ${row.clicks}, ${row.impressions}
      )
      ON CONFLICT (date, medium) DO UPDATE SET
        ad_spend     = ${row.adSpend},
        dashboard_cv = ${row.dashboardCv},
        actual_cv    = ${row.actualCv},
        clicks       = ${row.clicks},
        impressions  = ${row.impressions},
        updated_at   = NOW()
    `;
    count++;
  }

  return NextResponse.json({ imported: count });
}
