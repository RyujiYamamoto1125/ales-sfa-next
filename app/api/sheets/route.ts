import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchSheetCases, SALESPEOPLE } from "@/lib/sheets";

export const dynamic = "force-dynamic";

function monthKey(d: Date) {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const cases = await fetchSheetCases();

    // ── 全体集計 ──
    const allContracted = cases.filter(c => c.result === "契約");
    const followUps     = cases.filter(c => c.result === "後追い").length;

    // ── ステータス別 ──
    const statusMap: Record<string, number> = {};
    cases.forEach(c => {
      const s = c.result || "未設定";
      statusMap[s] = (statusMap[s] ?? 0) + 1;
    });
    const byStatus = Object.entries(statusMap)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    // ── 月別集計（全体） ──
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

    // ── 営業マン別集計（3名固定） ──
    const spStats = SALESPEOPLE.map(name => {
      const myCases      = cases.filter(c => c.salesPerson === name);
      const myContracts  = myCases.filter(c => c.result === "契約");
      const myFollowUps  = myCases.filter(c => c.result === "後追い").length;
      const myNGs        = myCases.filter(c => c.result === "NG").length;
      const myProspects  = myCases.filter(c => c.result.startsWith("見込み")).length;

      // 月別内訳
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
        apo:      myCases.length,
        contracts: myContracts.length,
        followUps: myFollowUps,
        ngs:       myNGs,
        prospects: myProspects,
        contractRate: myCases.length > 0
          ? Math.round((myContracts.length / myCases.length) * 100)
          : 0,
        monthlyBreakdown,
      };
    });

    // ── 流入経路別 ──
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

    // ── アポ獲得者別 ──
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

    return NextResponse.json({
      cumulative: {
        totalApo:      cases.length,
        totalContracts: allContracted.length,
        followUps,
        contractRate:  cases.length > 0 ? Math.round(allContracted.length / cases.length * 100) : 0,
        prospectHigh:  statusMap["見込み（高）"] ?? 0,
        prospectMid:   statusMap["見込み（中）"] ?? 0,
        prospectLow:   statusMap["見込み（低）"] ?? 0,
      },
      salesPersonStats: spStats,
      monthly,
      bySource,
      byAppointer,
      byStatus,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
