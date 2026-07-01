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

  // 全期間リード数 = 5月までのチャネル累計（代理店 + LP + インスタントフォーム）
  //                + 6月以降の実CV（数値管理シート）の累積
  // → 月が進むごとに実CVが積み上がる（例: 836 + 6月178 = 1014、以降7月…と加算）
  const channelBaseline =
      Number((agencyLeads as { total: number }[])[0]?.total ?? 0)   // 代理店（エモロジー）
    + Number((lpOverride  as { leads: number }[])[0]?.leads ?? 0)   // 自社LP
    + Number((ifLeads     as { total: number }[])[0]?.total ?? 0);  // インスタントフォーム
  const actualCvTotal = actualCvData.reduce((s, r) => s + r.actualCv, 0);
  const totalLeadsAllChannels = channelBaseline + actualCvTotal;

  return NextResponse.json({ monthly: result, totalLeadsAllChannels });
}
