import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchLeadsCount } from "@/lib/sheets";
import { sql, initSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const counts = await fetchLeadsCount();
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    if (year && month) {
      const prefix = `${year}-${String(month).padStart(2, "0")}`;
      return NextResponse.json(counts.filter(c => c.date.startsWith(prefix)));
    }
    return NextResponse.json(counts);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// 実CVをad_metricsに同期（actual_cvのみ上書き、広告費等は既存値を保持）
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "appointer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await initSchema();
  const db = sql();
  const rows: { date: string; campaign: string; count: number }[] = await req.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No data" }, { status: 400 });
  }

  let synced = 0;
  for (const row of rows) {
    // 新規はゼロ埋めで登録、既存行はactual_cvのみ更新（広告費・クリック等は保持）
    await db`
      INSERT INTO ad_metrics (date, medium, ad_spend, dashboard_cv, actual_cv, clicks, impressions)
      VALUES (${row.date}, ${row.campaign}, 0, ${row.count}, ${row.count}, 0, 0)
      ON CONFLICT (date, medium) DO UPDATE SET
        actual_cv  = ${row.count},
        updated_at = NOW()
    `;
    synced++;
  }

  return NextResponse.json({ synced });
}
