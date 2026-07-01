import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql, initSchema } from "@/lib/db";
import { fetchMonthlyLeadApo, fetchMonthlySalesStats, fetchMonthlyActualCv } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initSchema();
  const db = sql();

  const [leadApoData, salesData, adRows, actualCvData] = await Promise.all([
    fetchMonthlyLeadApo(),
    fetchMonthlySalesStats(),
    db`
      SELECT TO_CHAR(date, 'YYYY/MM') as month, SUM(ad_spend)::bigint as ad_spend
      FROM ad_metrics
      GROUP BY month ORDER BY month
    `,
    fetchMonthlyActualCv().catch(() => []),
  ]);

  const allMonths = new Set([
    ...leadApoData.map((r) => r.month),
    ...salesData.map((r) => r.month),
    ...adRows.map((r) => r.month as string),
    ...actualCvData.map((r) => r.month),
  ]);

  const result = [...allMonths].sort().reverse().map((month) => {
    const la = leadApoData.find((r) => r.month === month);
    const ss = salesData.find((r) => r.month === month);
    // 数値管理シートに当月の実CVがあれば、それを月別リード数として優先採用
    const acv = actualCvData.find((r) => r.month === month);
    return {
      month,
      leads:     acv ? acv.actualCv : (la?.leads ?? 0),
      apo:       la?.apo       ?? 0,
      meetings:  ss?.meetings  ?? 0,
      contracts: ss?.contracts ?? 0,
      adSpend:   Number(adRows.find((r) => r.month === month)?.ad_spend ?? 0),
    };
  });

  // 全期間リード数 = 各月リード数（実CV優先・無い月は従来集計）の合計
  // → 月別ビューの合計と一致し、実CV（例: 2026/06=178）が反映される
  const totalLeadsAllChannels = result.reduce((s, r) => s + r.leads, 0);

  return NextResponse.json({ monthly: result, totalLeadsAllChannels });
}
