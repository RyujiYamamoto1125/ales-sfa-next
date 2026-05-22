import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchSheetCases, fetchMonthlySalesStats, SALESPEOPLE, SheetCase } from "@/lib/sheets";

export const dynamic = "force-dynamic";

function monthKey(d: Date) {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function buildStats(cases: SheetCase[]) {
  const allContracted = cases.filter(c => c.result === "契約");
  const followUps     = cases.filter(c => c.result === "後追い").length;

  // ステータス別
  const statusMap: Record<string, number> = {};
  cases.forEach(c => {
    const s = c.result || "未設定";
    statusMap[s] = (statusMap[s] ?? 0) + 1;
  });
  const byStatus = Object.entries(statusMap)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  // 月別集計（全体）
  const monthlyMap: Record<string, { apo: number; contracts: number }> = {};
  cases.forEach(c => {
    if (!c.apoDate) return;
    const k = monthKey(c.apoDate);
    if (!monthlyMap[k]) monthlyMap[k] = { apo: 0, contracts: 0 };
    monthlyMap[k].apo++;
  });
  allContracted.forEach(c => {
    if (!c.contractDate) return;
    const k = monthKey(c.contractDate);
    if (!monthlyMap[k]) monthlyMap[k] = { apo: 0, contracts: 0 };
    monthlyMap[k].contracts++;
  });
  const monthly = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }));

  // 営業マン別集計（3名固定）
  const spStats = SALESPEOPLE.map(name => {
    const myCases     = cases.filter(c => c.salesPerson === name);
    const myContracts = myCases.filter(c => c.result === "契約");
    const myFollowUps = myCases.filter(c => c.result === "後追い").length;
    const myNGs       = myCases.filter(c => c.result === "NG").length;
    const myProspects = myCases.filter(c => c.result.startsWith("見込み")).length;

    const spMonthMap: Record<string, { apo: number; contracts: number }> = {};
    myCases.forEach(c => {
      if (!c.apoDate) return;
      const k = monthKey(c.apoDate);
      if (!spMonthMap[k]) spMonthMap[k] = { apo: 0, contracts: 0 };
      spMonthMap[k].apo++;
    });
    myContracts.forEach(c => {
      if (!c.contractDate) return;
      const k = monthKey(c.contractDate);
      if (!spMonthMap[k]) spMonthMap[k] = { apo: 0, contracts: 0 };
      spMonthMap[k].contracts++;
    });
    const monthlyBreakdown = Object.entries(spMonthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, ...v }));

    return {
      name,
      apo:          myCases.length,
      contracts:    myContracts.length,
      followUps:    myFollowUps,
      ngs:          myNGs,
      prospects:    myProspects,
      contractRate: myCases.length > 0
        ? Math.round((myContracts.length / myCases.length) * 100)
        : 0,
      monthlyBreakdown,
    };
  });

  // アポ獲得者別
  const apMap: Record<string, { apo: number; contracts: number }> = {};
  cases.forEach(c => {
    const ap = c.appointer || "不明";
    if (!apMap[ap]) apMap[ap] = { apo: 0, contracts: 0 };
    apMap[ap].apo++;
    if (c.result === "契約") apMap[ap].contracts++;
  });
  const byAppointer = Object.entries(apMap)
    .map(([appointer, v]) => ({
      appointer, apo: v.apo, contracts: v.contracts,
      rate: v.apo > 0 ? Math.round(v.contracts / v.apo * 100) : 0,
    }))
    .sort((a, b) => b.contracts - a.contracts);

  // 流入経路別
  const sourceMap: Record<string, { apo: number; contracts: number }> = {};
  cases.forEach(c => {
    const src = c.leadSource || "不明";
    if (!sourceMap[src]) sourceMap[src] = { apo: 0, contracts: 0 };
    sourceMap[src].apo++;
    if (c.result === "契約") sourceMap[src].contracts++;
  });
  const bySource = Object.entries(sourceMap)
    .map(([source, v]) => ({
      source, apo: v.apo, contracts: v.contracts,
      rate: v.apo > 0 ? Math.round(v.contracts / v.apo * 100) : 0,
    }))
    .sort((a, b) => b.apo - a.apo);

  return {
    cumulative: {
      totalApo:       cases.length,
      totalContracts: allContracted.length,
      followUps,
      contractRate:   cases.length > 0 ? Math.round(allContracted.length / cases.length * 100) : 0,
      prospectHigh:   statusMap["見込み（高）"] ?? 0,
      prospectMid:    statusMap["見込み（中）"] ?? 0,
      prospectLow:    statusMap["見込み（低）"] ?? 0,
    },
    salesPersonStats: spStats,
    monthly,
    bySource,
    byAppointer,
    byStatus,
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [allCases, salesStats] = await Promise.all([
      fetchSheetCases(),
      fetchMonthlySalesStats(),
    ]);

    // クエリパラメータで期間フィルタ
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period"); // "all" | "thisMonth" | "lastMonth"

    let filtered = allCases;
    const now = new Date();

    if (period === "thisMonth") {
      const y = now.getFullYear();
      const mo = now.getMonth();
      filtered = allCases.filter(c => {
        const d = c.apoDate;
        return d && d.getFullYear() === y && d.getMonth() === mo;
      });
    } else if (period === "lastMonth") {
      const target = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const y = target.getFullYear();
      const mo = target.getMonth();
      filtered = allCases.filter(c => {
        const d = c.apoDate;
        return d && d.getFullYear() === y && d.getMonth() === mo;
      });
    }

    const stats = buildStats(filtered);
    // 全期間データは月別グラフのために常に付与
    const allStats = period && period !== "all" ? buildStats(allCases) : null;
    const baseMonthly = allStats?.monthly ?? stats.monthly;

    // アポ数を「初回商談日時（L列）」ベースに補正
    // fetchMonthlySalesStats の meetings は L列（実際の商談日）でカウントしたもの
    const meetingsMap: Record<string, number> = {};
    salesStats.forEach(s => { meetingsMap[s.month] = s.meetings; });

    const allMonthly = baseMonthly.map(m => ({
      ...m,
      apo: meetingsMap[m.month] ?? m.apo,
    }));

    return NextResponse.json({
      ...stats,
      allMonthly,
      fetchedAt: new Date().toISOString(),
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
