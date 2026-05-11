import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchSheetCases } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const cases = await fetchSheetCases();

    // ── 全ステータス集計 ──
    const byStatus: Record<string, number> = {};
    cases.forEach((c) => {
      const s = c.result || "未設定";
      byStatus[s] = (byStatus[s] ?? 0) + 1;
    });

    const allContracted = cases.filter((c) => c.result === "契約");
    const followUps     = cases.filter((c) => c.result === "後追い").length;
    const ngs           = cases.filter((c) => c.result === "NG").length;

    // ── 月別集計 ──
    const monthlyMap: Record<string, { apo: number; contracts: number }> = {};
    cases.forEach((c) => {
      if (!c.apoDate) return;
      const key = `${c.apoDate.getFullYear()}/${String(c.apoDate.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap[key]) monthlyMap[key] = { apo: 0, contracts: 0 };
      monthlyMap[key].apo++;
    });
    allContracted.forEach((c) => {
      if (!c.contractDate) return;
      const key = `${c.contractDate.getFullYear()}/${String(c.contractDate.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap[key]) monthlyMap[key] = { apo: 0, contracts: 0 };
      monthlyMap[key].contracts++;
    });
    const monthly = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, ...v }));

    // ── 流入経路別集計 ──
    const sourceMap: Record<string, { apo: number; contracts: number }> = {};
    cases.forEach((c) => {
      const src = c.leadSource || "不明";
      if (!sourceMap[src]) sourceMap[src] = { apo: 0, contracts: 0 };
      sourceMap[src].apo++;
      if (c.result === "契約") sourceMap[src].contracts++;
    });
    const bySource = Object.entries(sourceMap)
      .map(([source, v]) => ({
        source,
        apo: v.apo,
        contracts: v.contracts,
        rate: v.apo > 0 ? Math.round((v.contracts / v.apo) * 100) : 0,
      }))
      .sort((a, b) => b.apo - a.apo);

    // ── アポ獲得者別集計 ──
    const appointerMap: Record<string, { apo: number; contracts: number }> = {};
    cases.forEach((c) => {
      const ap = c.appointer || "不明";
      if (!appointerMap[ap]) appointerMap[ap] = { apo: 0, contracts: 0 };
      appointerMap[ap].apo++;
      if (c.result === "契約") appointerMap[ap].contracts++;
    });
    const byAppointer = Object.entries(appointerMap)
      .map(([appointer, v]) => ({
        appointer,
        apo: v.apo,
        contracts: v.contracts,
        rate: v.apo > 0 ? Math.round((v.contracts / v.apo) * 100) : 0,
      }))
      .sort((a, b) => b.contracts - a.contracts);

    // ── 商談担当者別集計 ──
    const spMap: Record<string, { apo: number; contracts: number }> = {};
    cases.forEach((c) => {
      const sp = c.salesPerson || "未設定";
      if (!spMap[sp]) spMap[sp] = { apo: 0, contracts: 0 };
      spMap[sp].apo++;
      if (c.result === "契約") spMap[sp].contracts++;
    });
    const bySalesPerson = Object.entries(spMap)
      .map(([name, v]) => ({
        name,
        apo: v.apo,
        contracts: v.contracts,
        rate: v.apo > 0 ? Math.round((v.contracts / v.apo) * 100) : 0,
      }))
      .sort((a, b) => b.contracts - a.contracts);

    return NextResponse.json({
      cumulative: {
        totalApo:     cases.length,
        totalContracts: allContracted.length,
        followUps,
        ngs,
        contractRate: cases.length > 0 ? Math.round((allContracted.length / cases.length) * 100) : 0,
        prospectHigh: byStatus["見込み（高）"] ?? 0,
        prospectMid:  byStatus["見込み（中）"] ?? 0,
        prospectLow:  byStatus["見込み（低）"] ?? 0,
      },
      monthly,
      bySource,
      byAppointer,
      bySalesPerson,
      byStatus: Object.entries(byStatus)
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
