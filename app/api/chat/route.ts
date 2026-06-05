import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchSheetCases, fetchMonthlySalesStats, SALESPEOPLE } from "@/lib/sheets";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

function monthKey(d: Date) {
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message, history } = await req.json();
  if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が設定されていません。" },
      { status: 503 }
    );
  }

  const [cases, salesStats] = await Promise.all([
    fetchSheetCases(),
    fetchMonthlySalesStats(),
  ]);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const allContracted = cases.filter(c => c.result === "契約");

  // 今月絞り込み
  const thisMonthCases = cases.filter(c => {
    const d = c.apoDate;
    return d && d.getFullYear() === year && d.getMonth() + 1 === month;
  });
  const thisMonthContracted = allContracted.filter(c => {
    const d = c.contractDate;
    return d && d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  // ステータス別
  const statusMap: Record<string, number> = {};
  cases.forEach(c => {
    const s = c.result || "未設定";
    statusMap[s] = (statusMap[s] ?? 0) + 1;
  });

  // 流入経路別
  const sourceMap: Record<string, { apo: number; contracts: number }> = {};
  cases.forEach(c => {
    const src = c.leadSource || "不明";
    if (!sourceMap[src]) sourceMap[src] = { apo: 0, contracts: 0 };
    sourceMap[src].apo++;
    if (c.result === "契約") sourceMap[src].contracts++;
  });

  // アポインター別
  const appointerMap: Record<string, { apo: number; contracts: number }> = {};
  cases.forEach(c => {
    const ap = c.appointer || "不明";
    if (!appointerMap[ap]) appointerMap[ap] = { apo: 0, contracts: 0 };
    appointerMap[ap].apo++;
    if (c.result === "契約") appointerMap[ap].contracts++;
  });

  // 月別全体推移（salesStats = L列商談日ベース）
  const salesStatsMap: Record<string, { meetings: number; contracts: number }> = {};
  salesStats.forEach(s => { salesStatsMap[s.month] = { meetings: s.meetings, contracts: s.contracts }; });

  const monthlyTotalText = Object.entries(salesStatsMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, v]) => {
      const rate = v.meetings > 0 ? Math.round((v.contracts / v.meetings) * 100) : 0;
      return `- ${ym}: 商談${v.meetings}件 / 契約${v.contracts}件 / 契約率${rate}%`;
    })
    .join("\n");

  // 営業マン×月別（商談=apoDate, 契約=contractDate）
  const spMonthlyText = SALESPEOPLE.map(name => {
    const myCases = cases.filter(c => c.salesPerson === name);
    const myContracts = myCases.filter(c => c.result === "契約");

    const monthMap: Record<string, { apo: number; contracts: number }> = {};
    myCases.forEach(c => {
      if (!c.apoDate) return;
      const k = monthKey(c.apoDate);
      if (!monthMap[k]) monthMap[k] = { apo: 0, contracts: 0 };
      monthMap[k].apo++;
    });
    myContracts.forEach(c => {
      if (!c.contractDate) return;
      const k = monthKey(c.contractDate);
      if (!monthMap[k]) monthMap[k] = { apo: 0, contracts: 0 };
      monthMap[k].contracts++;
    });

    const rows = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, v]) => {
        const rate = v.apo > 0 ? Math.round((v.contracts / v.apo) * 100) : 0;
        return `  ${ym}: 商談${v.apo}件 / 契約${v.contracts}件 / 契約率${rate}%`;
      })
      .join("\n");

    const totalRate = myCases.length > 0 ? Math.round((myContracts.length / myCases.length) * 100) : 0;
    return `【${name}】累計: 商談${myCases.length}件 / 契約${myContracts.length}件 / 契約率${totalRate}%\n${rows || "  データなし"}`;
  }).join("\n\n");

  const context = `
# 営業SFA データサマリー（${year}年${month}月現在）
※データソース: Googleスプレッドシート（リアルタイム）

## 全期間 累計KPI
- 総商談数: ${cases.length}件
- 総契約数: ${allContracted.length}件
- 全体契約率: ${cases.length > 0 ? Math.round((allContracted.length / cases.length) * 100) : 0}%
- 後追い中: ${statusMap["後追い"] ?? 0}件
- 見込み（高）: ${statusMap["見込み（高）"] ?? 0}件
- 見込み（中）: ${statusMap["見込み（中）"] ?? 0}件
- 見込み（低）: ${statusMap["見込み（低）"] ?? 0}件

## 今月（${year}年${month}月）KPI
- 商談数: ${thisMonthCases.length}件
- 契約数: ${thisMonthContracted.length}件
- 契約率: ${thisMonthCases.length > 0 ? Math.round((thisMonthContracted.length / thisMonthCases.length) * 100) : 0}%

## 月別全体推移（商談日ベース）
${monthlyTotalText || "データなし"}

## 営業マン別・月別実績（商談日ベースで商談数、契約日ベースで契約数）
${spMonthlyText}

## 全期間ステータス別件数
${Object.entries(statusMap).map(([k, v]) => `- ${k}: ${v}件`).join("\n")}

## 流入経路別（全期間）
${Object.entries(sourceMap).map(([k, v]) => `- ${k}: 商談${v.apo}件 / 契約${v.contracts}件 / 成約率${v.apo > 0 ? Math.round((v.contracts / v.apo) * 100) : 0}%`).join("\n")}

## アポインター別（全期間）
${Object.entries(appointerMap).map(([k, v]) => `- ${k}: 商談${v.apo}件 / 契約${v.contracts}件 / 成約率${v.apo > 0 ? Math.round((v.contracts / v.apo) * 100) : 0}%`).join("\n")}
`;

  const systemPrompt = `あなたは営業SFAシステムのアシスタントです。以下の最新データ（Googleスプレッドシートから取得）を元に、営業数値・案件状況・目標達成状況などの質問に日本語で回答してください。
- 数値は具体的に、簡潔にまとめてください
- データが存在する場合は必ず数値を出してください
- 複数のデータを照合・計算して回答が導ける場合は積極的に計算して答えてください
- 月別・営業マン別など集計が必要な場合は、提供されたデータから集計して回答してください

${context}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const chatHistory = (history ?? [])
    .filter((h: { role: string; content: string }) => h.role === "user" || h.role === "assistant")
    .map((h: { role: string; content: string }) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    }));

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [...chatHistory, { role: "user", content: message }],
  });

  const reply = response.content[0].type === "text" ? response.content[0].text : "";

  return NextResponse.json({ reply });
}
