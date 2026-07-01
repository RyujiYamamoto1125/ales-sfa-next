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

  const [leadApoData, salesData, adRows, agencyLeads, lpOverride, ifLeads, actualCvData] = await Promise.all([
    fetchMonthlyLeadApo(),
    fetchMonthlySalesStats(),
    db`
      SELECT TO_CHAR(date, 'YYYY/MM') as month, SUM(ad_spend)::bigint as ad_spend
      FROM ad_metrics
      GROUP BY month ORDER BY month
    `,
    db`SELECT SUM(lead_count)::int as total FROM leads`.catch(() => [{ total: 0 }]),
    db`SELECT leads FROM channel_overrides WHERE channel_key = 'lp' LIMIT 1`.catch(() => []),
    db`SELECT SUM(cv_count)::int as total FROM ad_creatives WHERE medium = 'instant_form'`.catch(() => [{ total: 0 }]),
    fetchMonthlyActualCv().catch(() => []),
  ]);

  // 全チャネル合計リード数
  const agLeadsTotal = Number((agencyLeads as { total: number }[])[0]?.total ?? 0);
  const lpLeadsTotal = Number((lpOverride as { leads: number }[])[0]?.leads ?? 0);
  const ifLeadsTotal = Number((ifLeads as { total: number }[])[0]?.total ?? 0);
  const totalLeadsAllChannels = agLeadsTotal + lpLeadsTotal + ifLeadsTotal;

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

  return NextResponse.json({ monthly: result, totalLeadsAllChannels });
}
