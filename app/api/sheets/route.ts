import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchSheetsData } from "@/lib/sheets";

export const dynamic = "force-dynamic";

function parseNum(v: string): number {
  return Number((v ?? "").replace(/[¥,%]/g, "").replace(/,/g, "")) || 0;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year  = Number(searchParams.get("year")  ?? new Date().getFullYear());
  const month = Number(searchParams.get("month") ?? new Date().getMonth() + 1);

  try {
    const { cases, metrics } = await fetchSheetsData();

    // ── 今月絞り込み ──
    const thisMonthApo = cases.filter((c) => {
      if (!c.apoDate) return false;
      return c.apoDate.getFullYear() === year && c.apoDate.getMonth() + 1 === month;
    });

    const thisMonthContracted = cases.filter((c) => {
      if (c.result !== "契約" || !c.contractDate) return false;
      return c.contractDate.getFullYear() === year && c.contractDate.getMonth() + 1 === month;
    });

    const allContracted = cases.filter((c) => c.result === "契約");

    // ── KPI（スプレッドシートは全期間累計で表示） ──
    const kpis = {
      totalCases: cases.length,
      thisMonthApo: cases.length,           // 全期間アポ数をここに入れる
      thisMonthContracts: allContracted.length, // 全期間契約数
      totalContracts: allContracted.length,
      thisMonthAmount: 0,
      totalAmount: 0,
      contractRate:
        cases.length > 0
          ? Math.round((allContracted.length / cases.length) * 100)
          : 0,
      apoRate: null as number | null,
      globalTarget: 0,
      totalLeads: 0,
    };

    // ── ステータス別 ──
    const statusCounts: Record<string, number> = {};
    cases.forEach((c) => {
      const s = c.result || "未設定";
      statusCounts[s] = (statusCounts[s] ?? 0) + 1;
    });

    // ── 月別トレンド ──
    const monthlyMap: Record<string, { contracts: number; amount: number; apo: number }> = {};
    cases.forEach((c) => {
      if (!c.apoDate) return;
      const key = `${c.apoDate.getFullYear()}/${String(c.apoDate.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap[key]) monthlyMap[key] = { contracts: 0, amount: 0, apo: 0 };
      monthlyMap[key].apo++;
    });
    cases.forEach((c) => {
      if (c.result !== "契約" || !c.contractDate) return;
      const key = `${c.contractDate.getFullYear()}/${String(c.contractDate.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap[key]) monthlyMap[key] = { contracts: 0, amount: 0, apo: 0 };
      monthlyMap[key].contracts++;
    });
    const monthlyTrend = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([m, v]) => ({ month: m, ...v }));

    // ── 営業マン別 ──
    const spMap: Record<string, { apo: number; contracts: number; amount: number; targetContracts: number; targetAmount: number }> = {};
    thisMonthApo.forEach((c) => {
      const sp = c.salesPerson || "未設定";
      if (!spMap[sp]) spMap[sp] = { apo: 0, contracts: 0, amount: 0, targetContracts: 0, targetAmount: 0 };
      spMap[sp].apo++;
    });
    thisMonthContracted.forEach((c) => {
      const sp = c.salesPerson || "未設定";
      if (!spMap[sp]) spMap[sp] = { apo: 0, contracts: 0, amount: 0, targetContracts: 0, targetAmount: 0 };
      spMap[sp].contracts++;
    });
    const salesPersonStats = Object.entries(spMap)
      .map(([name, v]) => ({
        name, ...v,
        contractRate: v.apo > 0 ? Math.round((v.contracts / v.apo) * 100) : 0,
        contractAchievement: null as number | null,
        amountAchievement: null as number | null,
      }))
      .sort((a, b) => b.contracts - a.contracts);

    // ── ファネル ──
    const STATUS_ORDER = [
      "見込み（高）", "見込み（中）", "見込み（低）",
      "後追い", "契約書返送待ち", "不参加", "NG", "契約",
    ];
    const funnelCount: Record<string, number> = {};
    cases.forEach((c) => {
      if (c.result) funnelCount[c.result] = (funnelCount[c.result] ?? 0) + 1;
    });
    const funnelData = STATUS_ORDER
      .filter((s) => funnelCount[s])
      .map((s) => ({ status: s, count: funnelCount[s], avgDays: 0 }));

    // ── 広告：サマリテーブルからリード数取得 ──
    const leadRow = metrics.find((m) => m.label === "リード数");
    const leadsByMedium = leadRow
      ? [
          { medium: "エモロジー",       count: parseNum(leadRow.emology) },
          { medium: "フォーム",         count: parseNum(leadRow.form) },
          { medium: "自社LP(〜4/8)",   count: parseNum(leadRow.ownLpEarly) },
          { medium: "自社LP(4/9〜)",   count: parseNum(leadRow.ownLpLate) },
        ].filter((l) => l.count > 0)
      : [];

    // アポ数（サマリ）
    const apoRow = metrics.find((m) => m.label === "アポ数");
    const apoByMedium = leadsByMedium.map((l) => {
      const apoCount =
        l.medium === "エモロジー"     ? parseNum(apoRow?.emology ?? "")   :
        l.medium === "フォーム"       ? parseNum(apoRow?.form ?? "")       :
        l.medium === "自社LP(〜4/8)" ? parseNum(apoRow?.ownLpEarly ?? "") :
        l.medium === "自社LP(4/9〜)" ? parseNum(apoRow?.ownLpLate ?? "")  : 0;
      return {
        medium: l.medium,
        leads: l.count,
        apo: apoCount,
        apoRate: l.count > 0 ? Math.round((apoCount / l.count) * 100) : 0,
      };
    });

    return NextResponse.json({
      kpis,
      statusCounts,
      monthlyTrend,
      salesPersonStats,
      funnelData,
      leadsByMedium,
      apoByMedium,
      leadsRaw: [],
      sheetsMetrics: metrics,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
