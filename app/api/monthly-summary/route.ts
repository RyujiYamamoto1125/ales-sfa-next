import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql, initSchema } from "@/lib/db";
import { fetchMonthlyLeadApo, fetchMonthlySalesStats } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initSchema();
  const db = sql();

  const [leadApoData, salesData, adRows] = await Promise.all([
    fetchMonthlyLeadApo(),
    fetchMonthlySalesStats(),
    db`
      SELECT TO_CHAR(date, 'YYYY/MM') as month, SUM(ad_spend)::bigint as ad_spend
      FROM ad_metrics
      GROUP BY month ORDER BY month
    `,
  ]);

  const allMonths = new Set([
    ...leadApoData.map((r) => r.month),
    ...salesData.map((r) => r.month),
    ...adRows.map((r) => r.month as string),
  ]);

  const result = [...allMonths].sort().reverse().map((month) => {
    const la = leadApoData.find((r) => r.month === month);
    const ss = salesData.find((r) => r.month === month);
    return {
      month,
      leads:     la?.leads     ?? 0,
      apo:       la?.apo       ?? 0,
      meetings:  ss?.meetings  ?? 0,
      contracts: ss?.contracts ?? 0,
      adSpend:   Number(adRows.find((r) => r.month === month)?.ad_spend ?? 0),
    };
  });

  return NextResponse.json(result);
}
