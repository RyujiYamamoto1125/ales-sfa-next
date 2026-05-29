import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql, initSchema } from "@/lib/db";
import { fetchSheetCases, fetchAdReport } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// ── 固定料金体系 ────────────────────────────────────────────────────────────
const MONTHLY_FEE    = 55_000;
const DEPOSIT        = 220_000; // 4ヶ月分デポジット（21〜24ヶ月目充当）
const CONTRACT_MONTHS = 24;
const LTV_FIXED      = MONTHLY_FEE * CONTRACT_MONTHS; // 1,320,000
const UPFRONT        = DEPOSIT + MONTHLY_FEE;          // 275,000（契約時回収額）

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await initSchema();
  const db = sql();

  // ── データ取得（並列） ────────────────────────────────────────────────────
  const [adMetrics, staff, sheetCasesRaw, adCreativeSums, agencyLeadsRow, channelOverrides, gasAdReport] = await Promise.all([
    db`SELECT * FROM ad_metrics ORDER BY date ASC`,
    db`SELECT * FROM staff_contracts WHERE active = true`,
    fetchSheetCases().catch(() => null),
    db`SELECT medium, SUM(cv_count)::int AS total_cv, SUM(spend)::int AS total_spend
       FROM ad_creatives WHERE medium IN ('lp','instant_form') GROUP BY medium`,
    db`SELECT SUM(lead_count)::int AS total FROM leads WHERE medium = 'エモロジー'`,
    db`SELECT * FROM channel_overrides`.catch(() => [] as Record<string, unknown>[]),
    fetchAdReport().catch(() => null),  // 5月以降 LP（スプレッドシート）
  ]);

  // channel_overrides をキー別マップに変換
  type ChannelOverride = { channel_key: string; apo_count: number; contract_count: number; leads: number; spend: number };
  const overrideMap: Record<string, ChannelOverride> = {};
  (channelOverrides as ChannelOverride[]).forEach((r) => { overrideMap[r.channel_key] = r; });

  // シートが取得できない場合はDBにフォールバック
  const sheetCases = sheetCasesRaw ?? [];
  const sheetContracted = sheetCases.filter((c) => c.result === "契約");
  const sheetApo        = sheetCases.length;
  const sheetTotal      = sheetContracted.length;
  const sheetRate       = sheetApo > 0 ? Math.round((sheetTotal / sheetApo) * 100) : 0;

  // ── アクティブ契約（24ヶ月以内）→ MRR ──────────────────────────────────────
  const now = new Date();
  const activeContracts = sheetContracted.filter((c) => {
    if (!c.contractDate) return false;
    const msPerMonth = 30.44 * 24 * 60 * 60 * 1000;
    return (now.getTime() - c.contractDate.getTime()) / msPerMonth < CONTRACT_MONTHS;
  });
  const currentMRR = activeContracts.length * MONTHLY_FEE;
  const ARR        = currentMRR * 12;

  // ── パイプライン ──────────────────────────────────────────────────────────
  const prospectHigh = sheetCases.filter((c) => c.result === "見込み（高）").length;
  const prospectMid  = sheetCases.filter((c) => c.result === "見込み（中）").length;
  const prospectLow  = sheetCases.filter((c) => c.result === "見込み（低）").length;
  const followUps    = sheetCases.filter((c) => c.result === "後追い").length;
  // 転換確率: 高70% / 中40% / 低20%
  const pipelineExpected  = Math.round(prospectHigh * 0.7 + prospectMid * 0.4 + prospectLow * 0.2);
  const pipelineValue     = pipelineExpected * LTV_FIXED;
  const pipelineUpfront   = pipelineExpected * UPFRONT;

  // ── 月別集計（シートベース）────────────────────────────────────────────────
  const sheetMonthlyMap: Record<string, { apo: number; contracts: number }> = {};
  sheetCases.forEach((c) => {
    if (!c.apoDate) return;
    const k = monthKey(c.apoDate);
    if (!sheetMonthlyMap[k]) sheetMonthlyMap[k] = { apo: 0, contracts: 0 };
    sheetMonthlyMap[k].apo++;
  });
  sheetContracted.forEach((c) => {
    const d = c.contractDate ?? c.apoDate;
    if (!d) return;
    const k = monthKey(d);
    if (!sheetMonthlyMap[k]) sheetMonthlyMap[k] = { apo: 0, contracts: 0 };
    sheetMonthlyMap[k].contracts++;
  });
  const sheetMonthly = Object.entries(sheetMonthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month, ...v,
      initial_fee: v.contracts * DEPOSIT,
      monthly_fee: v.contracts * MONTHLY_FEE,
      ad_spend: 0, // 後で付与
    }));

  // 広告費を月別に付与
  const adByMonth: Record<string, number> = {};
  adMetrics.forEach((a) => {
    const k = monthKey(new Date(a.date as string));
    adByMonth[k] = (adByMonth[k] ?? 0) + Number(a.ad_spend ?? 0);
  });
  const monthlyWithAd = sheetMonthly.map((m) => ({
    ...m, ad_spend: adByMonth[m.month] ?? 0,
  }));

  // ── 広告費・CAC ────────────────────────────────────────────────────────────
  const totalAdSpend    = adMetrics.reduce((s, a) => s + Number(a.ad_spend ?? 0), 0);
  const avgCPA          = sheetTotal > 0 && totalAdSpend > 0
    ? Math.round(totalAdSpend / sheetTotal) : 0;
  const LTV             = LTV_FIXED;
  const ltvCacRatio     = avgCPA > 0 ? Math.round((LTV / avgCPA) * 10) / 10 : 0;
  // paybackはP&L計算後に avgUpfrontActual で上書きするため仮値
  let paybackPeriodMonths = avgCPA <= UPFRONT ? 1
    : MONTHLY_FEE > 0 ? Math.ceil((avgCPA - UPFRONT) / MONTHLY_FEE) + 1 : 0;

  // ── 人件費（固定＋変動） ─────────────────────────────────────────────────────
  // 月平均アポ数・契約数・アクティブ契約数を先に仮計算
  const _avgApo      = sheetApo > 0 && Object.keys(sheetMonthlyMap).length > 0
    ? sheetApo / Object.keys(sheetMonthlyMap).length : 0;
  const _avgContracts = sheetTotal > 0 && Object.keys(sheetMonthlyMap).length > 0
    ? sheetTotal / Object.keys(sheetMonthlyMap).length : 0;

  type StaffRow = {
    monthly_cost: number;
    per_contract_fee: number;
    per_contract_monthly_fee: number;
    per_meeting_fee: number;
  };

  const monthlySalaryCost = (staff as StaffRow[]).reduce((s, st) => {
    const fixed          = Number(st.monthly_cost ?? 0);
    // 隅田：1契約ごとのショット報酬（月平均契約数ベース）
    const perContract    = Number(st.per_contract_fee ?? 0) * _avgContracts;
    // 隅田：アクティブ契約数ごとの継続報酬
    const perContractMRR = Number(st.per_contract_monthly_fee ?? 0) * activeContracts.length;
    // 片野：1商談ごとの固定報酬（月平均アポ数ベース）
    const perMeeting     = Number(st.per_meeting_fee ?? 0) * _avgApo;
    return s + fixed + perContract + perContractMRR + perMeeting;
  }, 0);

  // ── 成長率（累計ベースで前月比較）────────────────────────────────────────────
  // 「今月の新規」ではなく「累計」の前月差分で計算する
  const prevMonthDate = new Date();
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const prevMonthKey  = monthKey(prevMonthDate);

  // 先月末時点の累計契約数
  const cumulativePrev = sheetContracted.filter((c) => {
    const d = c.contractDate ?? c.apoDate;
    return d ? monthKey(d) <= prevMonthKey : false;
  }).length;

  const contractsMoM = cumulativePrev > 0
    ? Math.round(((sheetTotal - cumulativePrev) / cumulativePrev) * 100 * 10) / 10 : 0;

  // MRR MoM も累計ベース（累計契約数 × 月額 で近似）
  const mrrPrev       = cumulativePrev * MONTHLY_FEE;
  const mrrThisApprox = sheetTotal * MONTHLY_FEE;
  const mrrMoMGrowth  = mrrPrev > 0
    ? Math.round(((mrrThisApprox - mrrPrev) / mrrPrev) * 100 * 10) / 10 : 0;

  // ── 月平均 ─────────────────────────────────────────────────────────────────
  const activeMonths        = monthlyWithAd.filter((m) => m.apo > 0 || m.contracts > 0).length;
  const avgContractsPerMonth = activeMonths > 0
    ? Math.round((sheetTotal / activeMonths) * 10) / 10 : 0;
  const avgApoPerMonth      = activeMonths > 0 ? Math.round(sheetApo / activeMonths) : 0;

  // ── 初期29社（デポジットなし）vs 現行契約（デポジットあり）の区分 ────────────────
  const OLD_CONTRACT_COUNT = 29;
  const OLD_UPFRONT = MONTHLY_FEE; // デポジットなし = 初月のみ 55,000円

  // 契約日順にソートして最初の29件を旧契約と判定
  const contractsByDate = [...sheetContracted].sort((a, b) => {
    const da = (a.contractDate ?? a.apoDate ?? new Date(0)).getTime();
    const db = (b.contractDate ?? b.apoDate ?? new Date(0)).getTime();
    return da - db;
  });

  // 月ごとに旧契約数・新契約数を集計
  const contractMonthDetail: Record<string, { oldCount: number; newCount: number }> = {};
  contractsByDate.forEach((c, idx) => {
    const d = c.contractDate ?? c.apoDate;
    if (!d) return;
    const k = monthKey(d);
    if (!contractMonthDetail[k]) contractMonthDetail[k] = { oldCount: 0, newCount: 0 };
    if (idx < OLD_CONTRACT_COUNT) contractMonthDetail[k].oldCount++;
    else contractMonthDetail[k].newCount++;
  });

  // 実際の初期回収額合計（旧29社 × 55,000 + 残り × 275,000）
  const totalOld = Math.min(contractsByDate.length, OLD_CONTRACT_COUNT);
  const totalNew = Math.max(contractsByDate.length - OLD_CONTRACT_COUNT, 0);
  const totalInitialRevenue = totalOld * OLD_UPFRONT + totalNew * UPFRONT;
  const avgUpfrontActual = contractsByDate.length > 0
    ? Math.round(totalInitialRevenue / contractsByDate.length) : 0;

  // 月次P&L（旧新それぞれの初回回収で計算）
  const pnlMonthly = monthlyWithAd.slice(-12).map((m) => {
    const detail = contractMonthDetail[m.month] ?? { oldCount: 0, newCount: 0 };
    const monthUpfront = detail.oldCount * OLD_UPFRONT + detail.newCount * UPFRONT;
    return {
      month:     m.month,
      contracts: m.contracts,
      mrr:       m.contracts * MONTHLY_FEE,
      upfront:   monthUpfront,
      cost:      (m.ad_spend || 0) + monthlySalaryCost,
      profit:    monthUpfront - ((m.ad_spend || 0) + monthlySalaryCost),
    };
  });

  // paybackを実際の加重平均初回回収額で更新
  paybackPeriodMonths = avgCPA <= avgUpfrontActual ? 1
    : MONTHLY_FEE > 0 ? Math.ceil((avgCPA - avgUpfrontActual) / MONTHLY_FEE) + 1 : 0;

  // ── 営業マン別 ────────────────────────────────────────────────────────────
  const spMap: Record<string, { apo: number; contracts: number }> = {};
  sheetCases.forEach((c) => {
    const sp = c.salesPerson || "不明";
    if (!spMap[sp]) spMap[sp] = { apo: 0, contracts: 0 };
    spMap[sp].apo++;
    if (c.result === "契約") spMap[sp].contracts++;
  });
  const byPerson = Object.entries(spMap).map(([name, v]) => ({
    name,
    apo: v.apo,
    contracts: v.contracts,
    rate: v.apo > 0 ? Math.round((v.contracts / v.apo) * 100) : 0,
    ltv: v.contracts * LTV_FIXED,
  })).sort((a, b) => b.contracts - a.contracts);

  // ── 流入経路別（細目）────────────────────────────────────────────────────────
  const srcMap: Record<string, { apo: number; contracts: number }> = {};
  sheetCases.forEach((c) => {
    const src = c.leadSource || "不明";
    if (!srcMap[src]) srcMap[src] = { apo: 0, contracts: 0 };
    srcMap[src].apo++;
    if (c.result === "契約") srcMap[src].contracts++;
  });
  const bySource = Object.entries(srcMap).map(([source, v]) => ({
    source,
    apo: v.apo,
    contracts: v.contracts,
    rate: v.apo > 0 ? Math.round((v.contracts / v.apo) * 100) : 0,
  })).sort((a, b) => b.contracts - a.contracts);

  // ── 集客経路別（3大チャネル）────────────────────────────────────────────────
  const CHANNEL_KEYS: Record<string, string[]> = {
    agency: ["エモロジー", "代理店"],
    lp:     ["自社広告（LP）", "自社広告(LP)"],
    if:     ["自社広告（インスタントフォーム）", "インスタントフォーム", "自社広告（インスタント）"],
  };
  const getChannel = (src: string) => {
    for (const [ch, kws] of Object.entries(CHANNEL_KEYS)) {
      if (kws.some((k) => src.includes(k))) return ch;
    }
    return "other";
  };

  const chApo:      Record<string, number> = { agency: 0, lp: 0, if: 0, other: 0 };
  const chContract: Record<string, number> = { agency: 0, lp: 0, if: 0, other: 0 };
  sheetCases.forEach((c) => {
    const ch = getChannel(c.leadSource || "");
    chApo[ch]++;
    if (c.result === "契約") chContract[ch]++;
  });

  // 広告データからリード数・消化金額を取得
  const lpData  = (adCreativeSums as { medium: string; total_cv: number; total_spend: number }[]).find((r) => r.medium === "lp");
  const ifData  = (adCreativeSums as { medium: string; total_cv: number; total_spend: number }[]).find((r) => r.medium === "instant_form");
  const agLeads = Number((agencyLeadsRow as { total: number }[])[0]?.total ?? 300);
  const agSpend = adMetrics.filter((m) => m.medium === "エモロジー").reduce((s, m) => s + Number(m.ad_spend ?? 0), 0);

  // 5月以降はGASスプレッドシートを正とする（全て自社広告（LP））
  type GasReport = { campaignName: string; adSpend: number; actualCv: number };
  const gasLpSpend = (gasAdReport as GasReport[] | null)?.reduce((s, c) => s + c.adSpend, 0) ?? 0;
  const gasLpCv    = (gasAdReport as GasReport[] | null)?.reduce((s, c) => s + c.actualCv, 0) ?? 0;

  const buildChannel = (
    name: string, key: string, color: string,
    leads: number, apo: number, contracts: number, spend: number,
  ) => ({
    name, key, color,
    leads,
    apo,
    contracts,
    spend,
    apoRate:      leads    > 0 ? Math.round((apo      / leads)    * 100) : 0,
    contractRate: apo      > 0 ? Math.round((contracts / apo)     * 100) : 0,
    leadToClose:  leads    > 0 ? Math.round((contracts / leads)   * 100) : 0,
    cpaApo:       apo      > 0 ? Math.round(spend / apo)      : 0,
    cpaContract:  contracts> 0 ? Math.round(spend / contracts) : 0,
    ltv:          contracts * LTV_FIXED,
    roi:          spend     > 0 ? Math.round(((contracts * LTV_FIXED) / spend) * 100) : 0,
  });

  // channel_overrides があればシート値を上書き
  const lpOverride  = overrideMap["lp"];
  const ifOverride  = overrideMap["if"];
  const agOverride  = overrideMap["agency"];

  const channelStats = [
    buildChannel("代理店（エモロジー）", "agency", "#7c3aed",
      agOverride ? agOverride.leads || agLeads : agLeads,
      agOverride ? agOverride.apo_count      : chApo.agency,
      agOverride ? agOverride.contract_count : chContract.agency,
      agOverride ? agOverride.spend || agSpend : agSpend),
    buildChannel("自社広告（LP）",       "lp",     "#4f46e5",
      lpOverride ? lpOverride.leads || ((lpData?.total_cv ?? 0) + gasLpCv) : (lpData?.total_cv ?? 0) + gasLpCv,
      lpOverride ? lpOverride.apo_count      : chApo.lp,
      lpOverride ? lpOverride.contract_count : chContract.lp,
      lpOverride ? lpOverride.spend || ((lpData?.total_spend ?? 0) + gasLpSpend) : (lpData?.total_spend ?? 0) + gasLpSpend),
    buildChannel("インスタントフォーム", "if",     "#0891b2",
      ifOverride ? ifOverride.leads || (ifData?.total_cv ?? 0) : (ifData?.total_cv ?? 0),
      ifOverride ? ifOverride.apo_count      : chApo.if,
      ifOverride ? ifOverride.contract_count : chContract.if,
      ifOverride ? ifOverride.spend || (ifData?.total_spend ?? 0) : (ifData?.total_spend ?? 0)),
  ];

  // ── 全チャネル合計リード数 ───────────────────────────────────────────────
  const totalLeadsAllChannels = channelStats.reduce((s, c) => s + c.leads, 0);

  return NextResponse.json({
    stats: {
      // 契約・アポ（シート）
      totalContracts: sheetTotal,
      totalApo: sheetApo,
      totalLeads: totalLeadsAllChannels,
      avgContractRate: sheetRate,
      activeContractsCount: activeContracts.length,
      avgContractsPerMonth,
      avgApoPerMonth,
      // 料金（固定）
      avgMonthlyFee: MONTHLY_FEE,
      avgInitialFee: DEPOSIT,
      upfrontPerContract: UPFRONT,
      // MRR / ARR / LTV
      currentMRR,
      ARR,
      LTV,
      // CAC / Payback
      totalAdSpend,
      avgCPA,
      ltvCacRatio,
      paybackPeriodMonths,
      // パイプライン
      prospectHigh,
      prospectMid,
      prospectLow,
      followUps,
      pipelineExpected,
      pipelineValue,
      pipelineUpfront,
      // コスト
      monthlySalaryCost,
      // 成長率
      mrrMoMGrowth,
      contractsMoM,
      // その他
      activeMonthsCount: activeMonths,
      grossMarginRate: 0, // 別途計算
      salesPersonCount: Object.keys(spMap).length,
      avgApoPerSalesPerson: 0,
      totalInitialRevenue,
      avgUpfrontActual,
      oldContractsCount: totalOld,
      newContractsCount: totalNew,
      contractCAGR: 0,
      valuationConservative: ARR * 2,
      valuationBase: ARR * 4,
      valuationOptimistic: ARR * 7,
    },
    monthly: monthlyWithAd.slice(-12),
    pnlMonthly,
    byPerson,
    bySource,
    channelStats,
    staff,
    sheetAvailable: sheetCasesRaw !== null,
    pipeline: { prospectHigh, prospectMid, prospectLow, followUps, pipelineExpected, pipelineValue },
  });
}
