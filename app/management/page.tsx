"use client";

import { useEffect, useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Cell, RadarChart,
  LineChart, Line, Legend,
  Radar, PolarGrid, PolarAngleAxis,
} from "recharts";
import {
  TrendingUp, TrendingDown, Users, DollarSign, Minus,
  ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle,
  Plus, Pencil, Trash2, Check, X, ChevronRight, Megaphone,
  ChevronDown, ChevronUp,
} from "lucide-react";

// ─── 型 ──────────────────────────────────────────────────────────────────────

interface SimStats {
  totalContracts: number; totalApo: number; totalAdSpend: number; totalInitialRevenue: number;
  avgCPA: number; avgContractRate: number; avgApoPerMonth: number; avgContractsPerMonth: number;
  avgInitialFee: number; avgMonthlyFee: number; upfrontPerContract: number;
  avgUpfrontActual: number; oldContractsCount: number; newContractsCount: number;
  salesPersonCount: number; avgApoPerSalesPerson: number;
  monthlySalaryCost: number; activeMonthsCount: number;
  currentMRR: number; ARR: number; LTV: number;
  ltvCacRatio: number; paybackPeriodMonths: number; grossMarginRate: number;
  mrrMoMGrowth: number; contractsMoM: number; contractCAGR: number;
  valuationConservative: number; valuationBase: number; valuationOptimistic: number;
  activeContractsCount: number;
  prospectHigh: number; prospectMid: number; prospectLow: number;
  followUps: number; pipelineExpected: number; pipelineValue: number; pipelineUpfront: number;
}

interface PnlData {
  month: string; upfront: number; cost: number; profit: number; contracts: number; mrr: number;
}

interface ByPerson {
  name: string; apo: number; contracts: number; rate: number; ltv: number;
}

interface BySource {
  source: string; apo: number; contracts: number; rate: number;
}

interface StaffContract {
  id: number; name: string; role: string; employment_type: string;
  monthly_cost: number; commission_rate: number;
  per_contract_fee: number; per_contract_monthly_fee: number; per_meeting_fee: number;
  contract_start: string | null; contract_end: string | null;
  memo: string | null; active: boolean;
}

interface MonthlyData {
  month: string; apo: number; contracts: number;
  initial_fee: number; monthly_fee: number; ad_spend: number;
}

interface ChannelStat {
  name: string; key: string; color: string;
  leads: number; apo: number; contracts: number; spend: number;
  apoRate: number; contractRate: number; leadToClose: number;
  cpaApo: number; cpaContract: number; ltv: number; roi: number;
}

interface AdCreative {
  id: number;
  ad_name: string;
  ad_set_name: string;
  status: string;
  medium: string;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  cpm: number;
  cv_count: number;
  cv_type: string | null;
  cpa: number;
  daily_budget: number;
}

// ─── ユーティリティ ───────────────────────────────────────────────────────────

const fmtYen = (n: number) => {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}億円`;
  if (n >= 10_000) {
    const man = n / 10_000;
    return `${Number.isInteger(man) ? man : man.toFixed(1)}万円`;
  }
  return `${n.toLocaleString()}円`;
};

const fmtShort = (n: number) => {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}億`;
  if (n >= 10_000) {
    const man = n / 10_000;
    return `${Number.isInteger(man) ? man : man.toFixed(1)}万`;
  }
  return `${n.toLocaleString()}`;
};

function Trend({ value }: { value: number }) {
  if (Math.abs(value) < 0.1) return (
    <span className="flex items-center gap-0.5 text-xs text-gray-400"><Minus size={11} />変化なし</span>
  );
  return value > 0
    ? <span className="flex items-center gap-0.5 text-xs text-emerald-600 font-medium"><ArrowUpRight size={12} />先月比+{Math.round(value)}%</span>
    : <span className="flex items-center gap-0.5 text-xs text-red-500 font-medium"><ArrowDownRight size={12} />先月比{Math.round(value)}%</span>;
}

// ─── 大カード ─────────────────────────────────────────────────────────────────

function BigCard({
  label, value, unit = "", note, trend, good, icon: Icon,
}: {
  label: string; value: string; unit?: string; note?: string;
  trend?: number; good?: boolean; icon?: React.ElementType;
}) {
  const isPositive = good !== undefined ? good : (trend !== undefined ? trend >= 0 : true);
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isPositive ? "bg-indigo-50" : "bg-red-50"}`}>
          {Icon
            ? <Icon size={17} className={isPositive ? "text-indigo-500" : "text-red-400"} />
            : <TrendingUp size={17} className={isPositive ? "text-indigo-500" : "text-red-400"} />
          }
        </div>
        {trend !== undefined && <Trend value={trend} />}
      </div>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-bold ${isPositive ? "text-gray-900" : "text-red-600"}`}>{value}</span>
        {unit && <span className="text-sm text-gray-500">{unit}</span>}
      </div>
      {note && <p className="text-xs text-gray-400 mt-1.5">{note}</p>}
    </div>
  );
}

// ─── ヘルスチェックバナー ─────────────────────────────────────────────────────

function HealthBanner({ stats }: { stats: SimStats }) {
  const monthlyProfit = (stats.currentMRR + stats.avgInitialFee * stats.avgContractsPerMonth)
    - (stats.monthlySalaryCost + stats.totalAdSpend / Math.max(stats.activeMonthsCount, 1));
  const isHealthy  = monthlyProfit > 0 && stats.avgContractRate >= 20;
  const isWarning  = !isHealthy && (monthlyProfit > -200000 || stats.avgContractRate >= 10);

  if (isHealthy) return (
    <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
      <CheckCircle size={20} className="text-emerald-500 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-emerald-800">事業は黒字ペースで成長しています</p>
        <p className="text-xs text-emerald-600 mt-0.5">
          契約率{stats.avgContractRate}% ・ 月次利益 +{fmtYen(monthlyProfit)} ・ このまま継続しつつ広告投資を増やすタイミングです
        </p>
      </div>
    </div>
  );

  if (isWarning) return (
    <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
      <AlertTriangle size={20} className="text-amber-500 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-amber-800">収益はトントン。改善の余地があります</p>
        <p className="text-xs text-amber-600 mt-0.5">
          契約率を{stats.avgContractRate}%→30%に改善するだけで大きく変わります。シミュレーターで確認してみてください
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
      <TrendingDown size={20} className="text-red-500 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-red-800">現状はコストが売上を上回っています</p>
        <p className="text-xs text-red-600 mt-0.5">
          まずは広告費の見直しまたは契約単価の引き上げを検討してください
        </p>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// タブ1 — 今の状態
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function NowTab({ stats, pnl, byPerson, bySource }: {
  stats: SimStats; pnl: PnlData[]; byPerson: ByPerson[]; bySource: BySource[];
}) {
  return (
    <div className="space-y-5">

      {/* 上段KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <BigCard label="MRR" value={fmtShort(stats.currentMRR)} unit="円/月"
          note={`稼働中${stats.activeContractsCount}件 × ¥55,000`}
          icon={DollarSign} />
        <BigCard label="ARR" value={fmtShort(stats.ARR)} unit="円/年"
          note={`MRR × 12ヶ月`} icon={TrendingUp} />
        <BigCard label="累積契約数" value={`${stats.totalContracts}件`}
          note={`転換率${stats.avgContractRate}%`}
          icon={Users} />
        <BigCard label="累計アポ数" value={`${stats.totalApo}件`}
          note={`月平均${stats.avgApoPerMonth}件`} icon={Users} />
        <BigCard label="累計広告費" value={fmtShort(stats.totalAdSpend)} unit="円"
          note={`平均CPA ${fmtYen(stats.avgCPA)}`} icon={DollarSign} />
      </div>

      {/* LTV・CAC */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* LTV */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 mb-2">LTV（顧客生涯価値）</p>
          <p className="text-3xl font-bold text-gray-900 mb-3">{fmtYen(stats.LTV)}</p>
          {/* 初期29社（デポジットなし） */}
          <div className="mb-3">
            <p className="text-[10px] font-semibold text-gray-500 mb-1">
              初期{stats.oldContractsCount}社（デポジットなし）
            </p>
            <div className="space-y-1">
              {[
                ["毎月支払い（1〜24ヶ月）", fmtYen(55000)],
                ["合計", fmtYen(55000 * 24)],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-gray-400">{label}</span>
                  <span className="font-medium text-gray-600">{val}</span>
                </div>
              ))}
            </div>
          </div>
          {/* 現行契約（デポジットあり） */}
          <div className="pt-2 border-t border-gray-100">
            <p className="text-[10px] font-semibold text-gray-500 mb-1">
              現行{stats.newContractsCount}社（デポジットあり）
            </p>
            <div className="space-y-1">
              {[
                ["契約時回収（デポジット+初月）", fmtYen(stats.upfrontPerContract)],
                ["2〜20ヶ月目（¥55,000×19）",    fmtYen(55000 * 19)],
                ["21〜24ヶ月目（デポジット充当）", "¥0"],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-gray-400">{label}</span>
                  <span className="font-medium text-gray-600">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CAC */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 mb-2">CAC（顧客獲得コスト）</p>
          <p className="text-3xl font-bold text-gray-900 mb-1">{stats.avgCPA > 0 ? fmtYen(stats.avgCPA) : "—"}</p>
          <div className="mt-2 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">ROAS（LTV/CAC）</span>
              <span className={`font-bold ${stats.ltvCacRatio >= 3 ? "text-emerald-600" : stats.ltvCacRatio >= 1 ? "text-amber-600" : "text-red-500"}`}>
                {stats.ltvCacRatio > 0 ? `${Math.round(stats.ltvCacRatio * 100)}%` : "—"}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">投資回収期間</span>
              <span className="font-medium text-gray-600">
                {stats.paybackPeriodMonths > 0 ? `${stats.paybackPeriodMonths}ヶ月` : "—"}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">平均初回回収額</span>
              <span className="font-medium text-emerald-600">{fmtYen(stats.avgUpfrontActual || stats.upfrontPerContract)}</span>
            </div>
            {stats.avgCPA > 0 && (
              <p className="text-xs text-gray-500 pt-1 border-t border-gray-50">
                {(stats.avgUpfrontActual || stats.upfrontPerContract) >= stats.avgCPA
                  ? "✓ 初回回収でCACをカバーできています"
                  : `平均${stats.paybackPeriodMonths}ヶ月目で回収完了`}
              </p>
            )}
          </div>
        </div>

      </div>

      {/* 営業マン別・経路別 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 営業マン別 */}
        {byPerson.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm font-semibold text-gray-800 mb-4">営業マン別 実績</p>
            <div className="space-y-3">
              {byPerson.map((p) => (
                <div key={p.name} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center shrink-0">
                    {p.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{p.name}</span>
                      <span className="text-gray-500">{p.contracts}件 / 転換率{p.rate}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${Math.min((p.contracts / Math.max(...byPerson.map(x => x.contracts), 1)) * 100, 100)}%` }} />
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">LTV {fmtShort(p.ltv)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 流入経路別 */}
        {bySource.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm font-semibold text-gray-800 mb-4">流入経路別 実績</p>
            <div className="space-y-2.5">
              {bySource.slice(0, 5).map((s) => (
                <div key={s.source} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden" style={{ width: "80px" }}>
                      <div className="h-full bg-cyan-500 rounded-full"
                        style={{ width: `${Math.min((s.apo / Math.max(...bySource.map(x => x.apo), 1)) * 100, 100)}%` }} />
                    </div>
                    <span className="text-sm text-gray-700 truncate">{s.source}</span>
                  </div>
                  <div className="text-xs text-gray-500 shrink-0 text-right">
                    <span>{s.contracts}件契約</span>
                    <span className="text-gray-400 ml-1">{s.rate}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// タブ2 — このペースで続けると…
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 共通：投資判断バッジ
function JudgeBadge({ score }: { score: "◎" | "○" | "△" | "×" }) {
  const cls = score === "◎" ? "bg-emerald-100 text-emerald-700 border-emerald-300"
    : score === "○" ? "bg-blue-100 text-blue-700 border-blue-300"
    : score === "△" ? "bg-amber-100 text-amber-700 border-amber-300"
    : "bg-red-100 text-red-600 border-red-300";
  return <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full border ${cls}`}>{score}</span>;
}

// 共通：進捗ゲージバー
function GaugeBar({ value, label, color = "bg-indigo-500" }: { value: number; label: string; color?: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1.5">
        <span>{label}</span><span>{Math.round(pct)}%</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function FutureTab({ stats }: { stats: SimStats }) {
  const MONTHLY_FEE   = 55_000;
  const UPFRONT_NEW   = stats.upfrontPerContract; // 現行契約の初回回収額
  const avgMonthlyAd  = Math.round(stats.totalAdSpend / Math.max(stats.activeMonthsCount, 1));
  const baseContracts = Math.max(1, Math.round(stats.avgContractsPerMonth));
  const monthlyCost   = stats.monthlySalaryCost + avgMonthlyAd;

  // 損益分岐点
  const breakevenPct       = Math.min(100, Math.round((stats.currentMRR / Math.max(monthlyCost, 1)) * 100));
  const contractsToBreak   = Math.ceil(Math.max(0, monthlyCost - stats.currentMRR) / MONTHLY_FEE);
  const monthsToBreak      = baseContracts > 0 ? Math.ceil(contractsToBreak / baseContracts) : 99;
  const alreadyBreakeven   = stats.currentMRR >= monthlyCost;

  // 12ヶ月シミュ関数（シナリオ共通）
  function sim12(extraContracts: number, extraCost: number) {
    const totalContracts = baseContracts + extraContracts;
    const totalCostMo    = monthlyCost + extraCost;
    const mrr12          = stats.currentMRR + totalContracts * MONTHLY_FEE * 12;
    let cumProfit        = 0;
    for (let i = 1; i <= 12; i++) {
      cumProfit += totalContracts * UPFRONT_NEW + stats.currentMRR - totalCostMo;
      // 月額積み上がり（2ヶ月目以降）
      cumProfit += totalContracts * MONTHLY_FEE * Math.min(i - 1, 19);
    }
    const paybackMo = extraCost > 0
      ? Math.ceil(extraCost / Math.max(extraContracts * UPFRONT_NEW + extraContracts * MONTHLY_FEE, 1))
      : 0;
    const annualRoi = extraCost * 12 > 0
      ? Math.round(((extraContracts * (UPFRONT_NEW + MONTHLY_FEE * 12)) / (extraCost * 12)) * 100)
      : 0;
    return { mrr12, cumProfit, paybackMo, annualRoi };
  }

  const adExtraContracts  = stats.avgCPA > 0 ? Math.floor(avgMonthlyAd * 0.5 / stats.avgCPA) : 0;
  const hireExtraContracts= Math.max(1, Math.round(baseContracts * 0.4)); // 1名採用で40%増と仮定

  const SCENARIOS = [
    {
      id: "maintain", label: "現状維持", tag: "ベースライン",
      desc: "現在の広告費・人員を継続",
      addCost: 0, addContracts: 0,
      color: "border-gray-200 bg-white",
      headColor: "bg-gray-50 text-gray-700",
    },
    {
      id: "ad50", label: "広告費 +50%", tag: `月${fmtShort(Math.round(avgMonthlyAd * 0.5))}追加`,
      desc: `現在の広告費（${fmtYen(avgMonthlyAd)}）を1.5倍にする`,
      addCost: Math.round(avgMonthlyAd * 0.5), addContracts: adExtraContracts,
      color: "border-indigo-200 bg-indigo-50/30",
      headColor: "bg-indigo-600 text-white",
    },
    {
      id: "hire", label: "営業 1名採用", tag: "月30万円〜",
      desc: "業務委託を1名追加し、アポ対応力を増強する",
      addCost: 300_000, addContracts: hireExtraContracts,
      color: "border-emerald-200 bg-emerald-50/30",
      headColor: "bg-emerald-600 text-white",
    },
  ] as const;

  // チャートデータ（3シナリオの12ヶ月MRR）
  const chartData = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const row: Record<string, number | string> = { month: `${m}M` };
    SCENARIOS.forEach((s) => {
      row[s.label] = Math.round(stats.currentMRR + (baseContracts + s.addContracts) * MONTHLY_FEE * m);
    });
    return row;
  });
  const SCENARIO_COLORS = { "現状維持": "#94a3b8", "広告費 +50%": "#6366f1", "営業 1名採用": "#10b981" };

  return (
    <div className="space-y-6">

      {/* ① 損益分岐点ゲージ */}
      <div className={`rounded-2xl p-5 shadow-sm border ${alreadyBreakeven ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className={`text-sm font-bold mb-0.5 ${alreadyBreakeven ? "text-emerald-800" : "text-amber-800"}`}>
              {alreadyBreakeven ? "✓ MRRが月次コストを上回っています" : `あと${contractsToBreak}件契約が増えると月次黒字化`}
            </p>
            <p className={`text-xs ${alreadyBreakeven ? "text-emerald-600" : "text-amber-600"}`}>
              {alreadyBreakeven
                ? `月次コスト${fmtYen(monthlyCost)} をMRR${fmtYen(stats.currentMRR)}がカバーしています`
                : `現在のペース（月${baseContracts}件）なら約${monthsToBreak}ヶ月後に黒字ライン`}
            </p>
          </div>
          <div className={`text-2xl font-bold ${alreadyBreakeven ? "text-emerald-700" : "text-amber-700"}`}>
            {breakevenPct}%
          </div>
        </div>
        <GaugeBar value={breakevenPct} label="MRRによるコストカバー率"
          color={alreadyBreakeven ? "bg-emerald-500" : "bg-amber-400"} />
        <div className="flex justify-between text-xs mt-2">
          <span className={alreadyBreakeven ? "text-emerald-600" : "text-amber-600"}>MRR: {fmtYen(stats.currentMRR)}</span>
          <span className="text-gray-500">月次コスト: {fmtYen(monthlyCost)}</span>
        </div>
      </div>

      {/* ② 3シナリオ投資比較 */}
      <div>
        <p className="text-sm font-semibold text-gray-800 mb-1">投資オプション比較（12ヶ月後）</p>
        <p className="text-xs text-gray-400 mb-4">3つの選択肢それぞれで12ヶ月後のMRRと収益性を比較します</p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {SCENARIOS.map((s) => {
            const r = sim12(s.addContracts, s.addCost);
            const mrr12 = Math.round(stats.currentMRR + (baseContracts + s.addContracts) * MONTHLY_FEE * 12);
            const judge: "◎" | "○" | "△" | "×" =
              s.id === "maintain" ? (alreadyBreakeven ? "○" : "△")
              : r.annualRoi >= 200 ? "◎"
              : r.annualRoi >= 100 ? "○"
              : "△";
            return (
              <div key={s.id} className={`rounded-2xl border overflow-hidden ${s.color}`}>
                <div className={`px-4 py-3 ${s.headColor} flex items-center justify-between`}>
                  <div>
                    <p className="font-bold text-sm">{s.label}</p>
                    <p className="text-[11px] opacity-80">{s.tag}</p>
                  </div>
                  <JudgeBadge score={judge} />
                </div>
                <div className="px-4 py-4 space-y-2.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">追加月次コスト</span>
                    <span className="font-bold text-gray-800">{s.addCost > 0 ? `+${fmtYen(s.addCost)}` : "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">月次契約数</span>
                    <span className="font-bold text-gray-800">{baseContracts + s.addContracts}件</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-gray-200 pt-2.5 mt-1">
                    <span className="text-gray-500">12ヶ月後のMRR</span>
                    <span className="font-bold text-indigo-700">{fmtYen(mrr12)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">追加投資ROI（年）</span>
                    <span className={`font-bold ${r.annualRoi >= 200 ? "text-emerald-600" : r.annualRoi >= 100 ? "text-amber-600" : "text-gray-500"}`}>
                      {s.addCost > 0 ? `${r.annualRoi}%` : "—"}
                    </span>
                  </div>
                  {s.addCost > 0 && r.paybackMo > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">投資回収期間</span>
                      <span className="font-medium text-gray-700">{r.paybackMo}ヶ月</span>
                    </div>
                  )}
                  <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ③ 3シナリオのMRR成長チャート */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <p className="text-sm font-semibold text-gray-800 mb-1">3シナリオのMRR推移比較（12ヶ月）</p>
        <p className="text-xs text-gray-400 mb-4">投資の差が月を追うごとに広がっていきます</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={(v) => `${Math.round(v / 10000)}万`} tick={{ fontSize: 10 }} width={42} />
            <Tooltip formatter={(v) => fmtYen(Number(v))} />
            <Legend iconType="circle" iconSize={8} />
            {(["現状維持", "広告費 +50%", "営業 1名採用"] as const).map((label) => (
              <Line key={label} type="monotone" dataKey={label}
                stroke={SCENARIO_COLORS[label]} strokeWidth={label === "現状維持" ? 1.5 : 2.5}
                strokeDasharray={label === "現状維持" ? "4 4" : undefined}
                dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ④ 投資判断サマリー */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <p className="text-sm font-semibold text-gray-800 mb-4">投資判断の整理</p>
        <div className="space-y-3">
          {[
            {
              condition: stats.avgCPA > 0 && stats.ltvCacRatio >= 3,
              score: "◎" as const,
              title: "広告費を増やすタイミングです",
              body: `ROAS = ${Math.round(stats.ltvCacRatio * 100)}%（300%以上は増額推奨）。今の広告は費用対効果が高く、増額するほど利益が積み上がります。`,
            },
            {
              condition: stats.avgCPA > 0 && stats.ltvCacRatio < 3 && stats.ltvCacRatio >= 1.5,
              score: "○" as const,
              title: "広告費の増額は慎重に",
              body: `ROAS = ${Math.round(stats.ltvCacRatio * 100)}%。費用対効果はまずまずですが、契約率の改善（現在${stats.avgContractRate}%）を先に取り組むと効果的です。`,
            },
            {
              condition: stats.avgContractRate >= 30,
              score: "◎" as const,
              title: "契約率が高水準 → 採用でスケール可能",
              body: `契約率${stats.avgContractRate}%は優秀です。営業を1名増やすだけで契約数が比例的に増える状態です。採用投資が有効です。`,
            },
            {
              condition: stats.avgContractRate < 20,
              score: "△" as const,
              title: "まず契約率の改善を優先してください",
              body: `契約率${stats.avgContractRate}%は改善余地があります。広告費を増やす前に商談プロセスや提案内容を見直すと、追加コストなしで収益が改善します。`,
            },
          ].filter((item) => item.condition).map((item, i) => (
            <div key={i} className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
              <JudgeBadge score={item.score} />
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-0.5">{item.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// タブ3 — 広告費を変えたらどうなる？
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SimTab({ stats }: { stats: SimStats }) {
  const MONTHLY_FEE  = 55_000;
  const UPFRONT_NEW  = stats.upfrontPerContract;
  const avgMonthlyAd = Math.round(stats.totalAdSpend / Math.max(stats.activeMonthsCount, 1));
  const baseContracts = Math.max(1, Math.round(stats.avgContractsPerMonth));
  const monthlyCost   = stats.monthlySalaryCost + avgMonthlyAd;

  const [adBudget, setAdBudget]         = useState(avgMonthlyAd || 300_000);
  const [closeRate, setCloseRate]       = useState(stats.avgContractRate || 20);
  const [hireCost, setHireCost]         = useState(0); // 追加採用コスト
  const [showHire, setShowHire]         = useState(false);

  const cpa = stats.avgCPA || 1;
  const projContracts   = Math.floor(adBudget / cpa) * (closeRate / Math.max(stats.avgContractRate, 1));
  const projContractsInt= Math.max(0, Math.floor(projContracts));
  const hireExtraC      = showHire ? Math.max(1, Math.round(projContractsInt * 0.4)) : 0;
  const totalContracts  = projContractsInt + hireExtraC;
  const totalCostMo     = adBudget + stats.monthlySalaryCost + hireCost;
  const monthUpfront    = totalContracts * UPFRONT_NEW;
  const addMRR          = totalContracts * MONTHLY_FEE;
  const monthlyCashIn   = monthUpfront + stats.currentMRR;
  const monthlyProfit   = monthlyCashIn - totalCostMo;
  const isProfit        = monthlyProfit >= 0;

  // 投資判断ロジック
  const adjLtvCac = stats.avgCPA > 0
    ? Math.round((stats.LTV / Math.max(adBudget / Math.max(projContractsInt, 1), 1)) * 10) / 10
    : 0;
  const adJudge: "◎" | "○" | "△" | "×" =
    adjLtvCac >= 5 ? "◎" : adjLtvCac >= 3 ? "○" : adjLtvCac >= 1.5 ? "△" : "×";
  const judgeText = {
    "◎": "この広告費は費用対効果が非常に高い。積極的に増額を推奨します。",
    "○": "費用対効果は良好。このペースで継続しながら徐々に増額を検討。",
    "△": "費用対効果がやや低下。クリエイティブや訴求の見直しを先に行いましょう。",
    "×": "このCPAでは収益化が難しい。まず契約率・CPAの改善が先決です。",
  };

  // 12ヶ月MRR予測
  const chart12 = Array.from({ length: 12 }, (_, i) => ({
    month: `${i + 1}M`,
    MRR: Math.round(stats.currentMRR + addMRR * (i + 1)),
    累積利益: Math.round(
      (monthUpfront + stats.currentMRR) * (i + 1)
      + addMRR * ((i + 1) * i / 2)
      - totalCostMo * (i + 1)
    ),
  }));
  const breakEvenMonth = chart12.findIndex((d) => d["累積利益"] >= 0) + 1;

  return (
    <div className="space-y-6">

      {/* ① 入力パネル */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-5">
        <p className="font-semibold text-gray-800">投資条件を設定する</p>

        {/* 広告費 */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div>
              <p className="text-sm font-medium text-gray-700">月次広告予算</p>
              <p className="text-xs text-gray-400">現在の実績: {fmtYen(avgMonthlyAd)}/月</p>
            </div>
            <span className="text-2xl font-bold text-indigo-700">{fmtShort(adBudget)}円</span>
          </div>
          <input type="range" min={50000} max={3000000} step={50000} value={adBudget}
            onChange={(e) => setAdBudget(Number(e.target.value))}
            className="w-full h-2 rounded-full accent-indigo-600 cursor-pointer" />
          <div className="flex justify-between text-xs text-gray-400 mt-1"><span>5万</span><span>300万</span></div>
        </div>

        {/* 契約率 */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div>
              <p className="text-sm font-medium text-gray-700">目標契約率（アポ→契約）</p>
              <p className="text-xs text-gray-400">現在の実績: {stats.avgContractRate}%</p>
            </div>
            <span className="text-2xl font-bold text-indigo-700">{closeRate}%</span>
          </div>
          <input type="range" min={5} max={80} step={1} value={closeRate}
            onChange={(e) => setCloseRate(Number(e.target.value))}
            className="w-full h-2 rounded-full accent-indigo-600 cursor-pointer" />
          <div className="flex justify-between text-xs text-gray-400 mt-1"><span>5%</span><span>80%</span></div>
        </div>

        {/* 採用追加 */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-gray-700">さらに採用も追加する場合</p>
              <p className="text-xs text-gray-400">営業/アポインター 1名追加のシミュレーション</p>
            </div>
            <button onClick={() => setShowHire(!showHire)}
              className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-colors ${showHire ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-500 border-gray-200"}`}>
              {showHire ? "ON" : "OFF"}
            </button>
          </div>
          {showHire && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs text-gray-500">採用コスト（月）</p>
                <span className="text-base font-bold text-emerald-700">{fmtYen(hireCost)}</span>
              </div>
              <input type="range" min={100000} max={600000} step={50000} value={hireCost}
                onChange={(e) => setHireCost(Number(e.target.value))}
                className="w-full h-2 rounded-full accent-emerald-600 cursor-pointer" />
              <div className="flex justify-between text-xs text-gray-400 mt-1"><span>10万</span><span>60万</span></div>
            </div>
          )}
        </div>
      </div>

      {/* ② 投資判断バッジ */}
      <div className={`rounded-2xl p-5 border flex items-start gap-4 ${
        adJudge === "◎" ? "bg-emerald-50 border-emerald-200"
        : adJudge === "○" ? "bg-blue-50 border-blue-200"
        : adJudge === "△" ? "bg-amber-50 border-amber-200"
        : "bg-red-50 border-red-200"}`}>
        <div className="shrink-0 mt-0.5">
          <JudgeBadge score={adJudge} />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-800 mb-1">
            この設定の投資判断：LTV/CPA = {adjLtvCac}x
          </p>
          <p className="text-xs text-gray-600 leading-relaxed">{judgeText[adJudge]}</p>
        </div>
      </div>

      {/* ③ 月次収支サマリ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "月次新規契約数", value: `${totalContracts}件`, sub: `広告${projContractsInt}件${showHire ? ` + 採用${hireExtraC}件` : ""}` },
          { label: "月次初回回収", value: fmtYen(monthUpfront), sub: `× ¥${(UPFRONT_NEW/10000).toFixed(1)}万/件` },
          { label: "月次収支", value: `${isProfit ? "+" : ""}${fmtShort(monthlyProfit)}円`, sub: isProfit ? "黒字" : "赤字", bold: true, positive: isProfit },
          { label: "損益分岐月", value: breakEvenMonth > 0 && breakEvenMonth <= 12 ? `${breakEvenMonth}ヶ月目` : "12M超", sub: "この投資の累積黒字化" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className={`text-xl font-bold leading-tight ${c.bold ? (c.positive ? "text-emerald-600" : "text-red-500") : "text-gray-900"}`}>{c.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* ④ 12ヶ月MRR + 累積利益チャート */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <p className="text-sm font-semibold text-gray-800 mb-1">12ヶ月後のMRR成長と累積利益</p>
        <p className="text-xs text-gray-400 mb-4">
          12ヶ月後MRR: <strong>{fmtYen(chart12[11].MRR)}</strong>
          累積利益: <strong className={chart12[11]["累積利益"] >= 0 ? "text-emerald-600" : "text-red-500"}>{fmtYen(chart12[11]["累積利益"])}</strong>
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chart12} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={(v) => `${Math.round(v / 10000)}万`} tick={{ fontSize: 10 }} width={42} />
            <Tooltip formatter={(v) => fmtYen(Number(v))} />
            <Legend iconType="circle" iconSize={8} />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
            <Line type="monotone" dataKey="MRR" stroke="#6366f1" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="累積利益" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="5 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// タブ4 — 集客経路分析
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ScoreBadge({ value, thresholds, unit = "%" }: {
  value: number; thresholds: [number, number]; unit?: string;
}) {
  const [good, warn] = thresholds;
  const cls = value >= good ? "bg-emerald-100 text-emerald-700"
    : value >= warn ? "bg-amber-100 text-amber-700"
    : "bg-red-100 text-red-600";
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>
      {value > 0 ? `${value}${unit}` : "—"}
    </span>
  );
}

function ChannelTab({ channelStats }: { channelStats: ChannelStat[] }) {
  const hasData = channelStats.some((c) => c.apo > 0 || c.leads > 0);

  const radarData = ["apoRate", "contractRate", "leadToClose"].map((key) => {
    const max = Math.max(...channelStats.map((c) => c[key as keyof ChannelStat] as number), 1);
    const entry: Record<string, number | string> = { subject: key === "apoRate" ? "アポ率" : key === "contractRate" ? "契約率" : "リード→契約" };
    channelStats.forEach((c) => { entry[c.key] = Math.round(((c[key as keyof ChannelStat] as number) / max) * 100); });
    return entry;
  });

  const barDataApo      = channelStats.map((c) => ({ name: c.name.replace("（エモロジー）",""), value: c.apo,      color: c.color }));
  const barDataContract = channelStats.map((c) => ({ name: c.name.replace("（エモロジー）",""), value: c.contracts, color: c.color }));
  const barDataCpa      = channelStats.filter((c) => c.cpaContract > 0).map((c) => ({
    name: c.name.replace("（エモロジー）",""), value: c.cpaContract, color: c.color,
  }));

  return (
    <div className="space-y-5">

      {!hasData && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700">
          シートのデータが取得できていないか、流入経路の記録がありません。
          スプレッドシートの「流入経路」列に代理店・LP・インスタントフォームの区別が入力されていると自動で集計されます。
        </div>
      )}

      {/* 比較カード */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {channelStats.map((ch) => {
          const totalRevenue = ch.contracts * 1_320_000;
          const profitability = ch.spend > 0 ? ch.roi : null;

          return (
            <div key={ch.key} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* ヘッダー */}
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderLeft: `4px solid ${ch.color}` }}>
                <div>
                  <p className="font-bold text-gray-800 text-sm">{ch.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">消化金額 {ch.spend > 0 ? fmtYen(ch.spend) : "—"}</p>
                </div>
                {profitability !== null && (
                  <div className="text-right">
                    <p className="text-xs text-gray-400">ROI</p>
                    <p className={`text-lg font-bold ${ch.roi >= 200 ? "text-emerald-600" : ch.roi >= 100 ? "text-amber-600" : "text-red-500"}`}>
                      {ch.roi}%
                    </p>
                  </div>
                )}
              </div>

              {/* ファネル */}
              <div className="px-5 py-4 space-y-3">
                {/* リード → アポ */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-gray-400">リード数</span>
                    <span className="text-sm font-bold text-gray-700">{ch.leads > 0 ? `${ch.leads.toLocaleString()}件` : "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(ch.apoRate, 100)}%`, backgroundColor: ch.color, opacity: 0.7 }} />
                    </div>
                    <ScoreBadge value={ch.apoRate} thresholds={[15, 5]} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">↓ アポ率</p>
                </div>

                {/* アポ → 契約 */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-gray-400">アポ数</span>
                    <span className="text-sm font-bold text-gray-700">{ch.apo > 0 ? `${ch.apo}件` : "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(ch.contractRate, 100)}%`, backgroundColor: ch.color }} />
                    </div>
                    <ScoreBadge value={ch.contractRate} thresholds={[30, 15]} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">↓ 契約率</p>
                </div>

                {/* 契約数 */}
                <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                  <span className="text-xs font-semibold text-gray-600">契約数</span>
                  <span className="text-xl font-bold" style={{ color: ch.color }}>{ch.contracts}件</span>
                </div>
              </div>

              {/* 単価指標 */}
              <div className="px-5 pb-4 grid grid-cols-2 gap-2">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 mb-0.5">アポ単価</p>
                  <p className="text-sm font-bold text-gray-700">{ch.cpaApo > 0 ? fmtYen(ch.cpaApo) : "—"}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 mb-0.5">契約単価（CPA）</p>
                  <p className={`text-sm font-bold ${ch.cpaContract > 0 && ch.cpaContract < 500000 ? "text-emerald-600" : ch.cpaContract > 0 ? "text-amber-600" : "text-gray-400"}`}>
                    {ch.cpaContract > 0 ? fmtYen(ch.cpaContract) : "—"}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 col-span-2">
                  <p className="text-[10px] text-gray-400 mb-0.5">LTV貢献額（{ch.contracts}件 × 132万円）</p>
                  <p className="text-sm font-bold text-gray-700">{totalRevenue > 0 ? fmtYen(totalRevenue) : "—"}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 比較テーブル */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="font-semibold text-gray-800 text-sm">集客経路 比較一覧</p>
          <p className="text-xs text-gray-400 mt-0.5">緑＝優良 / 黄＝要観察 / 赤＝要改善</p>
        </div>
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-gray-50">
            <tr>
              {["集客経路", "消化金額", "リード数", "アポ数", "アポ率", "契約数", "契約率", "リード→契約", "アポ単価", "契約CPA", "LTV貢献"].map((h) => (
                <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-400 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {channelStats.map((ch) => (
              <tr key={ch.key} className="border-t border-gray-50 hover:bg-gray-50/50">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ch.color }} />
                    <span className="font-medium text-gray-800 text-xs">{ch.name}</span>
                  </div>
                </td>
                <td className="py-3 px-4 font-mono text-xs">{ch.spend > 0 ? fmtYen(ch.spend) : "—"}</td>
                <td className="py-3 px-4 text-gray-700 text-xs">{ch.leads > 0 ? `${ch.leads.toLocaleString()}件` : "—"}</td>
                <td className="py-3 px-4 font-bold text-xs" style={{ color: ch.color }}>{ch.apo > 0 ? `${ch.apo}件` : "—"}</td>
                <td className="py-3 px-4"><ScoreBadge value={ch.apoRate} thresholds={[15, 5]} /></td>
                <td className="py-3 px-4 font-bold text-xs" style={{ color: ch.color }}>{ch.contracts}件</td>
                <td className="py-3 px-4"><ScoreBadge value={ch.contractRate} thresholds={[30, 15]} /></td>
                <td className="py-3 px-4"><ScoreBadge value={ch.leadToClose} thresholds={[5, 2]} /></td>
                <td className="py-3 px-4 font-mono text-xs text-gray-600">{ch.cpaApo > 0 ? fmtYen(ch.cpaApo) : "—"}</td>
                <td className="py-3 px-4 font-mono text-xs">
                  {ch.cpaContract > 0
                    ? <span className={ch.cpaContract < 500_000 ? "text-emerald-600 font-bold" : "text-amber-600"}>{fmtYen(ch.cpaContract)}</span>
                    : "—"}
                </td>
                <td className="py-3 px-4 text-xs text-gray-700">{ch.ltv > 0 ? fmtYen(ch.ltv) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 棒グラフ比較 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { title: "アポ数", data: barDataApo,      key: "value" as const },
          { title: "契約数", data: barDataContract, key: "value" as const },
          { title: "契約CPA", data: barDataCpa,    key: "value" as const },
        ].map(({ title, data, key }) => (
          <div key={title} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm font-semibold text-gray-800 mb-4">{title} 比較</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={title === "契約CPA" ? (v) => `${Math.round(v / 10000)}万` : undefined} width={30} />
                <Tooltip formatter={(v) => title === "契約CPA" ? fmtYen(Number(v)) : `${Number(v)}件`} />
                <Bar dataKey={key} radius={[5, 5, 0, 0]}>
                  {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>

      {/* レーダーチャート */}
      {hasData && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm font-semibold text-gray-800 mb-1">チャネル総合スコア比較</p>
          <p className="text-xs text-gray-400 mb-4">各指標の最高値を100として正規化</p>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#f0f0f0" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
              {channelStats.map((ch) => (
                <Radar key={ch.key} name={ch.name} dataKey={ch.key}
                  stroke={ch.color} fill={ch.color} fillOpacity={0.15} />
              ))}
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {channelStats.map((ch) => (
              <div key={ch.key} className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ch.color }} />
                {ch.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// タブ5 — クリエイティブ分析
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active:        { label: "配信中",     cls: "bg-emerald-100 text-emerald-700" },
  inactive:      { label: "停止",       cls: "bg-gray-100 text-gray-500"    },
  not_delivering:{ label: "配信なし",   cls: "bg-amber-100 text-amber-700"  },
};

const MEDIUM_LABEL: Record<string, { label: string; cls: string }> = {
  lp:           { label: "LP",          cls: "bg-indigo-100 text-indigo-700" },
  instant_form: { label: "インスタント", cls: "bg-cyan-100 text-cyan-700"    },
  agency:       { label: "代理店",      cls: "bg-violet-100 text-violet-700" },
  unknown:      { label: "—",           cls: "bg-gray-100 text-gray-400"    },
};

function CreativeTab({ creatives }: { creatives: AdCreative[] }) {
  const [filterMedium, setFilterMedium]   = useState<string>("all");
  const [filterStatus, setFilterStatus]   = useState<string>("all");
  const [sortKey, setSortKey]             = useState<keyof AdCreative>("spend");
  const [sortAsc, setSortAsc]             = useState(false);
  const [expandedSet, setExpandedSet]     = useState<string | null>(null);

  const toggleSort = (key: keyof AdCreative) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  const filtered = creatives.filter((c) =>
    (filterMedium === "all" || c.medium === filterMedium) &&
    (filterStatus === "all" || c.status === filterStatus)
  );

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey] as number | string;
    const bv = b[sortKey] as number | string;
    const cmp = typeof av === "number" ? av - (bv as number) : String(av).localeCompare(String(bv));
    return sortAsc ? cmp : -cmp;
  });

  // 広告セット別グループ化
  const setNames = [...new Set(sorted.map((c) => c.ad_set_name || "未分類"))];
  const grouped = setNames.map((name) => ({
    name,
    items: sorted.filter((c) => (c.ad_set_name || "未分類") === name),
  }));

  // サマリ集計
  const lpItems     = filtered.filter((c) => c.medium === "lp");
  const ifItems     = filtered.filter((c) => c.medium === "instant_form");
  const agencyItems = filtered.filter((c) => c.medium === "agency");
  const sumSpend = (arr: AdCreative[]) => arr.reduce((s, c) => s + c.spend, 0);
  const sumCV    = (arr: AdCreative[]) => arr.reduce((s, c) => s + c.cv_count, 0);
  const avgCPA   = (arr: AdCreative[]) => {
    const sp = sumSpend(arr), cv = sumCV(arr);
    return cv > 0 ? Math.round(sp / cv) : 0;
  };

  const SortIcon = ({ k }: { k: keyof AdCreative }) =>
    sortKey === k
      ? sortAsc ? <ChevronUp size={11} className="text-indigo-500" /> : <ChevronDown size={11} className="text-indigo-500" />
      : <ChevronDown size={11} className="text-gray-300" />;

  const TH = ({ k, label }: { k: keyof AdCreative; label: string }) => (
    <th onClick={() => toggleSort(k)}
      className="text-left py-2 px-3 text-xs font-semibold text-gray-400 cursor-pointer hover:text-gray-600 whitespace-nowrap select-none">
      <span className="flex items-center gap-0.5">{label}<SortIcon k={k} /></span>
    </th>
  );

  return (
    <div className="space-y-5">
      {/* サマリ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "LP 消化金額",           value: fmtYen(sumSpend(lpItems)),     sub: `CV ${sumCV(lpItems)}件 / CPA ${fmtYen(avgCPA(lpItems))}`,     cls: "bg-gradient-to-br from-indigo-500 to-indigo-700" },
          { label: "インスタント 消化金額",   value: fmtYen(sumSpend(ifItems)),     sub: `CV ${sumCV(ifItems)}件 / CPA ${fmtYen(avgCPA(ifItems))}`,     cls: "bg-gradient-to-br from-cyan-500 to-cyan-700" },
          { label: "代理店（エモロジー）",    value: fmtYen(sumSpend(agencyItems)), sub: `リード ${sumCV(agencyItems)}件 / CPA ${fmtYen(avgCPA(agencyItems))}`, cls: "bg-gradient-to-br from-violet-500 to-violet-700" },
          { label: "総消化金額",             value: fmtYen(sumSpend(filtered)),    sub: `総CV/リード ${sumCV(filtered)}件 / CPA ${fmtYen(avgCPA(filtered))}`, cls: "bg-gradient-to-br from-emerald-500 to-emerald-700" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${c.cls}`}>
              <Megaphone size={16} className="text-white" />
            </div>
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className="text-xl font-bold text-gray-900">{c.value}</p>
            <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* フィルタ */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-400 font-medium">媒体:</span>
        {[["all","すべて"],["lp","LP"],["instant_form","インスタントフォーム"],["agency","代理店"]].map(([v,l]) => (
          <button key={v} onClick={() => setFilterMedium(v)}
            className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-colors ${
              filterMedium === v ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-500 border-gray-200 hover:border-indigo-300"
            }`}>{l}</button>
        ))}
        <span className="text-xs text-gray-400 font-medium ml-3">ステータス:</span>
        {[["all","すべて"],["active","配信中"],["inactive","停止"],["not_delivering","配信なし"]].map(([v,l]) => (
          <button key={v} onClick={() => setFilterStatus(v)}
            className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-colors ${
              filterStatus === v ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-500 border-gray-200 hover:border-indigo-300"
            }`}>{l}</button>
        ))}
        <span className="text-xs text-gray-400 ml-auto">{filtered.length}件表示</span>
      </div>

      {/* 広告セット別グループ */}
      <div className="space-y-3">
        {grouped.map(({ name, items }) => {
          const groupSpend = sumSpend(items);
          const groupCV    = sumCV(items);
          const groupCPA   = avgCPA(items);
          const isOpen     = expandedSet === null || expandedSet === name;

          return (
            <div key={name} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* グループヘッダー */}
              <button className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedSet(expandedSet === name ? null : name)}>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-indigo-400" />
                  <span className="font-semibold text-gray-800 text-sm">{name}</span>
                  <span className="text-xs text-gray-400">{items.length}クリエイティブ</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>消化 <strong className="text-gray-700">{fmtYen(groupSpend)}</strong></span>
                  {groupCV > 0 && <span>CV <strong className="text-gray-700">{groupCV}件</strong></span>}
                  {groupCPA > 0 && <span>CPA <strong className="text-gray-700">{fmtYen(groupCPA)}</strong></span>}
                  {isOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </div>
              </button>

              {/* クリエイティブ一覧テーブル */}
              {isOpen && (
                <div className="border-t border-gray-100 overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <TH k="ad_name"    label="広告名" />
                        <TH k="medium"     label="媒体" />
                        <TH k="status"     label="ステータス" />
                        <TH k="spend"      label="消化金額" />
                        <TH k="cv_count"   label="CV数" />
                        <TH k="cpa"        label="CPA" />
                        <TH k="impressions" label="IMP" />
                        <TH k="cpm"        label="CPM" />
                        <TH k="reach"      label="リーチ" />
                        <TH k="frequency"  label="F数" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((c) => {
                        const st = STATUS_LABEL[c.status] ?? { label: c.status, cls: "bg-gray-100 text-gray-500" };
                        const md = MEDIUM_LABEL[c.medium]  ?? { label: c.medium,  cls: "bg-gray-100 text-gray-400" };
                        return (
                          <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                            <td className="py-2.5 px-3 font-medium text-gray-800 max-w-[180px]">
                              <span className="block truncate" title={c.ad_name}>{c.ad_name}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${md.cls}`}>{md.label}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-gray-700">{c.spend > 0 ? fmtYen(c.spend) : "—"}</td>
                            <td className="py-2.5 px-3">
                              {c.cv_count > 0
                                ? <span className="font-bold text-indigo-600">{c.cv_count}件</span>
                                : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              {c.cpa > 0 ? (
                                <span className={c.cpa < 50000 ? "text-emerald-600 font-bold" : c.cpa < 100000 ? "text-amber-600" : "text-red-500"}>
                                  {fmtYen(c.cpa)}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-gray-500">{c.impressions > 0 ? c.impressions.toLocaleString() : "—"}</td>
                            <td className="py-2.5 px-3 text-gray-500 font-mono">{c.cpm > 0 ? `¥${Math.round(Number(c.cpm)).toLocaleString()}` : "—"}</td>
                            <td className="py-2.5 px-3 text-gray-500">{c.reach > 0 ? c.reach.toLocaleString() : "—"}</td>
                            <td className="py-2.5 px-3 text-gray-500">{Number(c.frequency) > 0 ? Number(c.frequency).toFixed(2) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// タブ5 — 人員管理
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ROLE_LABEL: Record<string, string> = { sales: "営業", appointer: "アポ", other: "その他" };
const EMP_LABEL: Record<string, string>  = { employee: "社員", contractor: "業務委託", part_time: "アルバイト" };
const ROLE_CLS: Record<string, string>   = { sales: "bg-indigo-100 text-indigo-700", appointer: "bg-emerald-100 text-emerald-700", other: "bg-gray-100 text-gray-600" };

const EMPTY_FORM = {
  name: "", role: "sales", employment_type: "employee",
  monthly_cost: "", commission_rate: "", contract_start: "", contract_end: "", memo: "",
};

function StaffForm({ initial, onSave, onCancel }: {
  initial?: Partial<StaffContract>;
  onSave: (data: typeof EMPTY_FORM) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    ...EMPTY_FORM, ...(initial ? {
      name: initial.name ?? "", role: initial.role ?? "sales",
      employment_type: initial.employment_type ?? "employee",
      monthly_cost: String(initial.monthly_cost ?? ""),
      commission_rate: String(initial.commission_rate ?? ""),
      contract_start: initial.contract_start?.slice(0, 10) ?? "",
      contract_end: initial.contract_end?.slice(0, 10) ?? "",
      memo: initial.memo ?? "",
    } : {}),
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className="text-xs font-medium text-gray-500 block mb-1.5">名前 *</label>
        <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="山田 太郎" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 block mb-1.5">役割 *</label>
        <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={form.role} onChange={(e) => set("role", e.target.value)}>
          <option value="sales">営業マン</option>
          <option value="appointer">アポインター</option>
          <option value="other">その他</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 block mb-1.5">雇用形態 *</label>
        <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={form.employment_type} onChange={(e) => set("employment_type", e.target.value)}>
          <option value="employee">社員</option>
          <option value="contractor">業務委託</option>
          <option value="part_time">アルバイト</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 block mb-1.5">月額コスト（円）</label>
        <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={form.monthly_cost} onChange={(e) => set("monthly_cost", e.target.value)} placeholder="300000" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 block mb-1.5">成果報酬率（%）</label>
        <input type="number" step="0.1" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={form.commission_rate} onChange={(e) => set("commission_rate", e.target.value)} placeholder="10" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 block mb-1.5">契約終了日</label>
        <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={form.contract_end} onChange={(e) => set("contract_end", e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label className="text-xs font-medium text-gray-500 block mb-1.5">メモ</label>
        <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          rows={2} value={form.memo} onChange={(e) => set("memo", e.target.value)} placeholder="条件・備考など" />
      </div>
      <div className="sm:col-span-2 flex gap-2 justify-end pt-1">
        <button onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">
          <X size={13} />キャンセル
        </button>
        <button onClick={() => form.name && onSave(form)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm bg-indigo-600 text-white hover:bg-indigo-700">
          <Check size={13} />保存
        </button>
      </div>
    </div>
  );
}

function StaffTab({ staff, onReload }: { staff: StaffContract[]; onReload: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId]   = useState<number | null>(null);

  const totalCost = staff.filter((s) => s.active).reduce((sum, s) => sum + Number(s.monthly_cost), 0);
  const today = new Date();
  const expiring = staff.filter((s) => {
    if (!s.contract_end || !s.active) return false;
    const diff = (new Date(s.contract_end).getTime() - today.getTime()) / 86400000;
    return diff >= 0 && diff <= 30;
  });

  const save = async (url: string, method: string, body: object) => {
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    onReload();
  };
  const handleAdd  = async (form: typeof EMPTY_FORM) => {
    await save("/api/management/staff", "POST",
      { ...form, monthly_cost: Number(form.monthly_cost) || 0, commission_rate: Number(form.commission_rate) || 0 });
    setShowAdd(false);
  };
  const handleEdit = async (id: number, form: typeof EMPTY_FORM) => {
    const t = staff.find((s) => s.id === id);
    await save(`/api/management/staff/${id}`, "PATCH",
      { ...form, monthly_cost: Number(form.monthly_cost) || 0, commission_rate: Number(form.commission_rate) || 0, active: t?.active ?? true });
    setEditId(null);
  };
  const handleDelete   = async (id: number) => {
    if (!confirm("削除しますか？")) return;
    await fetch(`/api/management/staff/${id}`, { method: "DELETE" });
    onReload();
  };
  const toggleActive = async (s: StaffContract) =>
    save(`/api/management/staff/${s.id}`, "PATCH", { ...s, active: !s.active });

  return (
    <div className="space-y-5">
      {/* サマリ */}
      <div className="grid grid-cols-3 gap-4">
        <BigCard label="月次人件費合計" value={fmtShort(totalCost)} unit="円/月"
          note={`${staff.filter((s) => s.active).length}名分`} icon={Users} />
        <BigCard label="営業メンバー" value={`${staff.filter((s) => s.active && s.role === "sales").length}`} unit="名"
          icon={Users} />
        <BigCard label="アポインター" value={`${staff.filter((s) => s.active && s.role === "appointer").length}`} unit="名"
          icon={Users} />
      </div>

      {expiring.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <AlertTriangle size={17} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800 mb-1">30日以内に契約終了のメンバー</p>
            <div className="flex flex-wrap gap-2">
              {expiring.map((s) => (
                <span key={s.id} className="text-xs bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full border border-amber-200">
                  {s.name}（{s.contract_end?.slice(0, 10)}）
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="font-semibold text-gray-800 mb-4">メンバー追加</p>
          <StaffForm onSave={handleAdd} onCancel={() => setShowAdd(false)} />
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <p className="font-semibold text-gray-800">メンバー一覧</p>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm hover:bg-indigo-700">
            <Plus size={13} />追加
          </button>
        </div>
        {staff.length === 0 ? (
          <div className="py-16 text-center">
            <Users size={28} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">メンバーを追加してください</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {staff.map((s) => (
              <div key={s.id}>
                <div className={`flex items-center gap-3 px-6 py-4 transition-colors ${
                  !s.active ? "opacity-40" : "hover:bg-gray-50/50"
                }`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm ${
                    s.role === "sales" ? "bg-indigo-100 text-indigo-700" : s.role === "appointer" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                  }`}>{s.name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm text-gray-800">{s.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_CLS[s.role] ?? "bg-gray-100 text-gray-600"}`}>
                        {ROLE_LABEL[s.role] ?? s.role}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                        {EMP_LABEL[s.employment_type] ?? s.employment_type}
                      </span>
                    </div>
                    <div className="flex items-center flex-wrap gap-2 text-xs text-gray-400">
                      {s.monthly_cost > 0 && <span className="bg-gray-100 px-1.5 py-0.5 rounded">{fmtYen(s.monthly_cost)}/月（固定）</span>}
                      {s.per_contract_fee > 0 && <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">{fmtYen(s.per_contract_fee)}/契約（ショット）</span>}
                      {s.per_contract_monthly_fee > 0 && <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded">{fmtYen(s.per_contract_monthly_fee)}/契約/月（継続）</span>}
                      {s.per_meeting_fee > 0 && <span className="bg-cyan-50 text-cyan-600 px-1.5 py-0.5 rounded">{fmtYen(s.per_meeting_fee)}/商談</span>}
                      {s.contract_end && <span>〜{s.contract_end.slice(0, 10)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleActive(s)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium ${
                        s.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                      }`}>
                      {s.active ? "稼働中" : "停止"}
                    </button>
                    <button onClick={() => setEditId(editId === s.id ? null : s.id)}
                      className="p-2 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(s.id)}
                      className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                {editId === s.id && (
                  <div className="px-6 pb-5 pt-2 bg-indigo-50 border-t border-indigo-100">
                    <StaffForm initial={s} onSave={(form) => handleEdit(s.id, form)} onCancel={() => setEditId(null)} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// メインページ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type Tab = "now" | "future" | "sim" | "staff";

const TABS: { id: Tab; label: string }[] = [
  { id: "now",    label: "今の状態" },
  { id: "future", label: "このペースだと…" },
  { id: "sim",    label: "広告費を変えたら？" },
  { id: "staff",  label: "人員管理" },
];

export default function ManagementPage() {
  const [tab, setTab]         = useState<Tab>("now");
  const [staff, setStaff]     = useState<StaffContract[]>([]);
  const [stats, setStats]     = useState<SimStats | null>(null);
  const [pnl, setPnl]         = useState<PnlData[]>([]);
  const [monthly, setMonthly] = useState<MonthlyData[]>([]);
  const [byPerson, setByPerson] = useState<ByPerson[]>([]);
  const [bySource, setBySource] = useState<BySource[]>([]);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    const [simRes, staffRes] = await Promise.all([
      fetch("/api/management/simulate"),
      fetch("/api/management/staff"),
    ]);
    if (simRes.ok) {
      const d = await simRes.json();
      setStats(d.stats);
      setPnl(d.pnlMonthly ?? []);
      setMonthly(d.monthly ?? []);
      setByPerson(d.byPerson ?? []);
      setBySource(d.bySource ?? []);
    }
    if (staffRes.ok) setStaff(await staffRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <AppLayout title="経営ダッシュボード">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="bg-white rounded-2xl px-5 py-4 shadow-sm border border-gray-100 text-sm text-gray-600 leading-relaxed">
          <span className="font-semibold text-gray-800">今の状態</span>ではMRR・ARR・累計アポ数・累計広告費・LTV/CAC（ROAS）など経営の現在地を確認できます。
          <span className="font-semibold text-gray-800 mx-1">このペースだと…</span>では損益分岐点と3つの投資オプション（現状維持・広告費増・採用）を12ヶ月で比較できます。
          <span className="font-semibold text-gray-800 mx-1">広告費を変えたら？</span>ではスライダーで広告費・契約率・採用コストを動かしてROIと回収期間をリアルタイムで試算できます。
          <span className="font-semibold text-gray-800 mx-1">人員管理</span>では山本・隅田・片野・荒木 計4名分の人件費（固定給・成果報酬・商談単価）が登録されており、月次コストの計算に反映されています。
        </div>

        {/* タブ */}
        <div className="flex gap-1 bg-gray-100/80 p-1 rounded-2xl overflow-x-auto">
          {TABS.map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                tab === id
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}>
              {label}
              {tab === id && <ChevronRight size={12} className="text-indigo-400" />}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32 gap-3">
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">データを読み込んでいます…</span>
          </div>
        ) : !stats ? (
          <div className="py-20 text-center text-gray-400 text-sm">データが取得できませんでした</div>
        ) : (
          <>
            {tab === "now"    && <NowTab    stats={stats} pnl={pnl} byPerson={byPerson} bySource={bySource} />}
            {tab === "future" && <FutureTab stats={stats} />}
            {tab === "sim"    && <SimTab    stats={stats} />}
            {tab === "staff"  && <StaffTab  staff={staff} onReload={load} />}
          </>
        )}
      </div>
    </AppLayout>
  );
}
