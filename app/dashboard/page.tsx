"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import AppLayout from "@/components/AppLayout";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, CartesianGrid, AreaChart, Area, LineChart, Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";
import {
  TrendingUp, Users, Percent, AlertCircle, RefreshCw, Clock,
  Megaphone, ChevronDown, ChevronUp, ChevronRight, X,
} from "lucide-react";

// ── 定数 ──────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  "見込み（高）": "#6366F1", "見込み（中）": "#22C55E", "見込み（低）": "#F59E0B",
  "後追い": "#F97316", "NG": "#EF4444", "契約": "#06B6D4",
  "不参加": "#64748B", "契約書返送待ち": "#8B5CF6", "未設定": "#94A3B8",
};
const SP_COLORS: Record<string, string> = { "山本": "#6366F1", "隅田": "#06B6D4", "片野": "#22C55E" };
const PALETTE = ["#6366F1","#06B6D4","#22C55E","#F59E0B","#EF4444","#A855F7","#F97316","#64748B"];
const AUTO_REFRESH_MS = 5 * 60 * 1000;

// ── 型 ────────────────────────────────────────────────
interface SpStat {
  name: string; apo: number; contracts: number; followUps: number;
  ngs: number; prospects: number; contractRate: number;
  monthlyBreakdown: { month: string; apo: number; contracts: number }[];
}
interface SheetsData {
  cumulative: { totalApo: number; totalContracts: number; followUps: number; contractRate: number; prospectHigh: number; prospectMid: number; prospectLow: number };
  salesPersonStats: SpStat[];
  monthly: { month: string; apo: number; contracts: number }[];
  allMonthly: { month: string; apo: number; contracts: number }[];
  bySource: { source: string; apo: number; contracts: number; rate: number }[];
  byAppointer: { appointer: string; apo: number; contracts: number; rate: number }[];
  byStatus: { status: string; count: number }[];
  fetchedAt: string;
}
interface ChannelStat {
  name: string; key: string; color: string;
  leads: number; apo: number; contracts: number; spend: number;
  apoRate: number; contractRate: number; leadToClose: number;
  cpaApo: number; cpaContract: number; ltv: number; roi: number;
}
interface AdCreative {
  id: number; ad_name: string; ad_set_name: string; status: string; medium: string;
  spend: number; impressions: number; reach: number; frequency: number; cpm: number;
  cv_count: number; cv_type: string | null; cpa: number; daily_budget: number;
}

// ── ユーティリティ ─────────────────────────────────────
const fmtYen = (n: number) => {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}億円`;
  if (n >= 10_000) { const m = n / 10_000; return `${Number.isInteger(m) ? m : m.toFixed(1)}万円`; }
  return `${n.toLocaleString()}円`;
};

// ── 既存コンポーネント ─────────────────────────────────

function KPICard({ label, value, sub, icon: Icon, iconBg, iconColor, badge }: {
  label: string; value: string; sub?: string; badge?: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-start gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon size={22} className={iconColor} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs font-medium text-gray-400">{label}</p>
          {badge && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{badge}</span>}
        </div>
        <p className="text-2xl font-bold text-gray-800 leading-none mb-1">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

function ChartCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-700 mb-5">{title}</h3>
      {children}
    </div>
  );
}

function MonthlyTable({ data }: { data: { month: string; apo: number; contracts: number }[] }) {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  const sorted = [...data].sort((a, b) => b.month.localeCompare(a.month));
  if (sorted.length === 0) return <p className="text-sm text-gray-400 text-center py-8">データがありません</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4">月</th>
            <th className="text-right text-xs font-semibold text-gray-400 pb-3 px-4">アポ数</th>
            <th className="text-right text-xs font-semibold text-gray-400 pb-3 px-4">契約数</th>
            <th className="text-right text-xs font-semibold text-gray-400 pb-3 pl-4">契約率</th>
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, 12).map((row) => {
            const rate = row.apo > 0 ? Math.round((row.contracts / row.apo) * 100) : 0;
            const isCurrentMonth = row.month === currentMonthKey;
            return (
              <tr key={row.month} className={`border-b border-gray-50 ${isCurrentMonth ? "bg-indigo-50/40" : ""}`}>
                <td className={`py-2.5 pr-4 text-xs font-medium ${isCurrentMonth ? "text-indigo-600" : "text-gray-600"}`}>
                  {row.month} {isCurrentMonth && <span className="ml-1 text-[10px] bg-indigo-100 text-indigo-600 px-1 rounded">今月</span>}
                </td>
                <td className="py-2.5 px-4 text-right font-semibold text-gray-700">{row.apo}</td>
                <td className="py-2.5 px-4 text-right font-bold text-indigo-600">{row.contracts}</td>
                <td className="py-2.5 pl-4 text-right">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${rate >= 20 ? "bg-emerald-50 text-emerald-700" : rate >= 10 ? "bg-amber-50 text-amber-700" : "bg-gray-50 text-gray-500"}`}>
                    {rate}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SalesPersonCard({ sp, rank }: { sp: SpStat; rank: number }) {
  const color = Object.values(SP_COLORS)[rank] ?? PALETTE[rank];
  const isTop = rank === 0;
  const recent6 = sp.monthlyBreakdown.slice(-6);
  return (
    <div className={`rounded-2xl p-5 shadow-sm border ${isTop ? "border-0 text-white" : "bg-white border-gray-100"}`}
      style={isTop ? { background: `linear-gradient(135deg, ${color}, ${color}dd)` } : {}}>
      <div className="flex items-start justify-between mb-4">
        <div>
          {rank === 0 && <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full mb-2 inline-block">🥇 トップ</span>}
          {rank === 1 && <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full mb-2 inline-block">🥈 2位</span>}
          {rank === 2 && <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full mb-2 inline-block">🥉 3位</span>}
          <p className={`text-lg font-bold ${isTop ? "text-white" : "text-gray-800"}`}>{sp.name}</p>
        </div>
        <div className="text-right">
          <p className={`text-3xl font-bold ${isTop ? "text-white" : ""}`} style={!isTop ? { color } : {}}>
            {sp.contracts}
          </p>
          <p className={`text-xs ${isTop ? "text-white/70" : "text-gray-400"}`}>契約件数</p>
        </div>
      </div>
      <div className={`grid grid-cols-3 gap-2 text-center mb-4 p-3 rounded-xl ${isTop ? "bg-white/10" : "bg-gray-50"}`}>
        <div><p className={`text-xs ${isTop ? "text-white/70" : "text-gray-400"}`}>アポ</p><p className={`font-bold ${isTop ? "text-white" : "text-gray-700"}`}>{sp.apo}</p></div>
        <div><p className={`text-xs ${isTop ? "text-white/70" : "text-gray-400"}`}>転換率</p><p className={`font-bold ${isTop ? "text-white" : ""}`} style={!isTop ? { color } : {}}>{sp.contractRate}%</p></div>
        <div><p className={`text-xs ${isTop ? "text-white/70" : "text-gray-400"}`}>後追い</p><p className={`font-bold ${isTop ? "text-white" : "text-gray-700"}`}>{sp.followUps}</p></div>
      </div>
      <ResponsiveContainer width="100%" height={70}>
        <BarChart data={recent6} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <Bar dataKey="contracts" fill={isTop ? "rgba(255,255,255,0.7)" : color} radius={[3,3,0,0]} />
          <Tooltip contentStyle={{borderRadius:"8px",border:"none",boxShadow:"0 4px 12px rgba(0,0,0,0.1)",fontSize:"11px"}}
            formatter={(v) => [`${v}件`, "契約"]} labelFormatter={(l) => l} />
        </BarChart>
      </ResponsiveContainer>
      <p className={`text-xs text-right mt-1 ${isTop ? "text-white/50" : "text-gray-300"}`}>直近6ヶ月の月別契約数</p>
    </div>
  );
}

function AppointerCard({ ap, idx }: { ap: { appointer: string; apo: number; contracts: number; rate: number }; idx: number }) {
  const color = PALETTE[idx % PALETTE.length];
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white shrink-0" style={{ backgroundColor: color }}>
        {ap.appointer.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 text-sm mb-1">{ap.appointer}</p>
        <div className="flex gap-3 text-xs text-gray-500">
          <span>アポ <span className="font-bold text-gray-700">{ap.apo}</span></span>
          <span>契約 <span className="font-bold text-indigo-600">{ap.contracts}</span></span>
          <span className={`font-bold px-1.5 py-0.5 rounded-full ${ap.rate >= 20 ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{ap.rate}%</span>
        </div>
        <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(ap.rate, 100)}%`, backgroundColor: color }} />
        </div>
      </div>
    </div>
  );
}

// ── 集客経路分析コンポーネント ──────────────────────────

function ScoreBadge({ value, thresholds, unit = "%" }: { value: number; thresholds: [number, number]; unit?: string }) {
  const cls = value >= thresholds[0] ? "bg-emerald-100 text-emerald-700"
    : value >= thresholds[1] ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600";
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>{value > 0 ? `${value}${unit}` : "—"}</span>;
}

function ChannelView({ channelStats }: { channelStats: ChannelStat[] }) {
  const hasData = channelStats.some((c) => c.apo > 0 || c.leads > 0);
  const radarData = ["apoRate", "contractRate", "leadToClose"].map((key) => {
    const max = Math.max(...channelStats.map((c) => c[key as keyof ChannelStat] as number), 1);
    const entry: Record<string, number | string> = { subject: key === "apoRate" ? "アポ率" : key === "contractRate" ? "契約率" : "リード→契約" };
    channelStats.forEach((c) => { entry[c.key] = Math.round(((c[key as keyof ChannelStat] as number) / max) * 100); });
    return entry;
  });
  const barDataApo      = channelStats.map((c) => ({ name: c.name.replace("（エモロジー）",""), value: c.apo, color: c.color }));
  const barDataContract = channelStats.map((c) => ({ name: c.name.replace("（エモロジー）",""), value: c.contracts, color: c.color }));
  const barDataCpa      = channelStats.filter((c) => c.cpaContract > 0).map((c) => ({ name: c.name.replace("（エモロジー）",""), value: c.cpaContract, color: c.color }));

  return (
    <div className="space-y-5">
      {!hasData && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700">
          スプレッドシートの「流入経路」列に代理店・LP・インスタントフォームの区別が入力されていると自動で集計されます。
        </div>
      )}

      {/* チャネルカード */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {channelStats.map((ch) => (
          <div key={ch.key} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderLeft: `4px solid ${ch.color}` }}>
              <div>
                <p className="font-bold text-gray-800 text-sm">{ch.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">消化金額 {ch.spend > 0 ? fmtYen(ch.spend) : "—"}</p>
              </div>
              {ch.spend > 0 && (
                <div className="text-right">
                  <p className="text-xs text-gray-400">ROI</p>
                  <p className={`text-lg font-bold ${ch.roi >= 200 ? "text-emerald-600" : ch.roi >= 100 ? "text-amber-600" : "text-red-500"}`}>{ch.roi}%</p>
                </div>
              )}
            </div>
            <div className="px-5 py-4 space-y-3">
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
              <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                <span className="text-xs font-semibold text-gray-600">契約数</span>
                <span className="text-xl font-bold" style={{ color: ch.color }}>{ch.contracts}件</span>
              </div>
            </div>
            <div className="px-5 pb-4 grid grid-cols-2 gap-2">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 mb-0.5">アポ単価</p>
                <p className="text-sm font-bold text-gray-700">{ch.cpaApo > 0 ? fmtYen(ch.cpaApo) : "—"}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 mb-0.5">契約CPA</p>
                <p className={`text-sm font-bold ${ch.cpaContract > 0 && ch.cpaContract < 500000 ? "text-emerald-600" : ch.cpaContract > 0 ? "text-amber-600" : "text-gray-400"}`}>
                  {ch.cpaContract > 0 ? fmtYen(ch.cpaContract) : "—"}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 col-span-2">
                <p className="text-[10px] text-gray-400 mb-0.5">LTV貢献額（{ch.contracts}件 × 132万円）</p>
                <p className="text-sm font-bold text-gray-700">{ch.ltv > 0 ? fmtYen(ch.ltv) : "—"}</p>
              </div>
            </div>
          </div>
        ))}
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
              {["集客経路","消化金額","リード数","アポ数","アポ率","契約数","契約率","リード→契約","アポ単価","契約CPA","LTV貢献"].map((h) => (
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

      {/* 棒グラフ + レーダー */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { title: "アポ数 比較", data: barDataApo },
          { title: "契約数 比較", data: barDataContract },
          { title: "契約CPA 比較", data: barDataCpa },
        ].map(({ title, data }) => (
          <div key={title} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-sm font-semibold text-gray-800 mb-4">{title}</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={title.includes("CPA") ? (v) => `${Math.round(v / 10000)}万` : undefined} width={30} />
                <Tooltip formatter={(v) => title.includes("CPA") ? fmtYen(Number(v)) : `${Number(v)}件`} />
                <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                  {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>

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

// ── クリエイティブ分析コンポーネント ───────────────────

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active:         { label: "配信中",   cls: "bg-emerald-100 text-emerald-700" },
  inactive:       { label: "停止",     cls: "bg-gray-100 text-gray-500" },
  not_delivering: { label: "配信なし", cls: "bg-amber-100 text-amber-700" },
};
const MEDIUM_LABEL: Record<string, { label: string; cls: string }> = {
  lp:           { label: "LP",          cls: "bg-indigo-100 text-indigo-700" },
  instant_form: { label: "インスタント", cls: "bg-cyan-100 text-cyan-700" },
  agency:       { label: "代理店",      cls: "bg-violet-100 text-violet-700" },
  unknown:      { label: "—",           cls: "bg-gray-100 text-gray-400" },
};

// 画像ファイルが存在するad_nameのセット（publicにコピー済みのもの）
const CREATIVE_IMAGES = new Set([
  "4","7","8","9","10","11","12","13","14","16","17","18","19",
  "ClaudeCode①","ClaudeCode②","ClaudeCode③","ClaudeCode④",
  "丸投げ①","丸投げ②","丸投げ③",
  "実績者の声①","実績者の声②","実績者の声③",
  "悩み解決①","悩み解決②","悩み解決③",
  "毎月更新①","毎月更新②","毎月更新③",
]);

function creativeImageUrl(adName: string) {
  return `/creatives/${encodeURIComponent(adName)}.png`;
}

function ImageModal({ adName, onClose }: { adName: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute -top-10 right-0 text-white/80 hover:text-white text-sm flex items-center gap-1">
          <X size={16} /> 閉じる
        </button>
        <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-gray-800 text-sm">{adName}</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={creativeImageUrl(adName)} alt={adName}
            className="w-full object-contain max-h-[70vh]" />
        </div>
      </div>
    </div>
  );
}

function CreativeTable({ items, TH, onSelectImage, showAdSet = false }: {
  items: AdCreative[];
  TH: ({ k, label }: { k: keyof AdCreative; label: string }) => React.ReactElement;
  onSelectImage: (name: string) => void;
  showAdSet?: boolean;
}) {
  return (
    <table className="w-full text-sm min-w-[750px]">
      <thead className="bg-gray-50">
        <tr>
          <th className="py-2 px-3 text-xs font-semibold text-gray-400 text-left w-14">画像</th>
          <TH k="ad_name" label="広告名" />
          {showAdSet && <TH k="ad_set_name" label="広告セット" />}
          <TH k="medium" label="媒体" /><TH k="status" label="ステータス" />
          <TH k="spend" label="消化金額" /><TH k="cv_count" label="CV数" /><TH k="cpa" label="CPA" />
          <TH k="impressions" label="IMP" /><TH k="cpm" label="CPM" /><TH k="reach" label="リーチ" /><TH k="frequency" label="F数" />
        </tr>
      </thead>
      <tbody>
        {items.map((c) => {
          const st = STATUS_LABEL[c.status] ?? { label: c.status, cls: "bg-gray-100 text-gray-500" };
          const md = MEDIUM_LABEL[c.medium] ?? { label: c.medium, cls: "bg-gray-100 text-gray-400" };
          const hasImg = CREATIVE_IMAGES.has(c.ad_name);
          return (
            <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
              <td className="py-2 px-3">
                {hasImg ? (
                  <button onClick={() => onSelectImage(c.ad_name)}
                    className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 hover:border-indigo-400 hover:shadow-md transition-all shrink-0 block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={creativeImageUrl(c.ad_name)} alt={c.ad_name} className="w-full h-full object-cover" />
                  </button>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    <span className="text-[9px] text-gray-400">—</span>
                  </div>
                )}
              </td>
              <td className="py-2.5 px-3 font-medium text-gray-800 max-w-[160px]">
                <span className="block truncate" title={c.ad_name}>{c.ad_name}</span>
              </td>
              {showAdSet && (
                <td className="py-2.5 px-3 text-gray-500 text-xs max-w-[120px]">
                  <span className="block truncate" title={c.ad_set_name}>{c.ad_set_name || "—"}</span>
                </td>
              )}
              <td className="py-2.5 px-3"><span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${md.cls}`}>{md.label}</span></td>
              <td className="py-2.5 px-3"><span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span></td>
              <td className="py-2.5 px-3 font-mono text-gray-700">{c.spend > 0 ? fmtYen(c.spend) : "—"}</td>
              <td className="py-2.5 px-3">
                {c.cv_count > 0 ? <span className="font-bold text-indigo-600">{c.cv_count}件</span> : <span className="text-gray-300">—</span>}
              </td>
              <td className="py-2.5 px-3 font-mono">
                {c.cpa > 0 ? <span className={c.cpa < 50000 ? "text-emerald-600 font-bold" : c.cpa < 100000 ? "text-amber-600" : "text-red-500"}>{fmtYen(c.cpa)}</span> : "—"}
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
  );
}

function CreativeView({ creatives }: { creatives: AdCreative[] }) {
  const [filterMedium, setFilterMedium]   = useState("all");
  const [filterStatus, setFilterStatus]   = useState("all");
  const [sortKey, setSortKey]             = useState<keyof AdCreative>("spend");
  const [sortAsc, setSortAsc]             = useState(false);
  const [expandedSet, setExpandedSet]     = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [viewMode, setViewMode]           = useState<"grouped" | "flat">("grouped");

  const toggleSort = (key: keyof AdCreative) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  const filtered = creatives.filter((c) =>
    (filterMedium === "all" || c.medium === filterMedium) &&
    (filterStatus === "all" || c.status === filterStatus)
  );
  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey] as number | string, bv = b[sortKey] as number | string;
    const cmp = typeof av === "number" ? av - (bv as number) : String(av).localeCompare(String(bv));
    return sortAsc ? cmp : -cmp;
  });
  const setNames = [...new Set(sorted.map((c) => c.ad_set_name || "未分類"))];
  const grouped  = setNames.map((name) => ({ name, items: sorted.filter((c) => (c.ad_set_name || "未分類") === name) }));

  const sumSpend = (arr: AdCreative[]) => arr.reduce((s, c) => s + c.spend, 0);
  const sumCV    = (arr: AdCreative[]) => arr.reduce((s, c) => s + c.cv_count, 0);
  const avgCPA   = (arr: AdCreative[]) => { const sp = sumSpend(arr), cv = sumCV(arr); return cv > 0 ? Math.round(sp / cv) : 0; };

  const lpItems     = filtered.filter((c) => c.medium === "lp");
  const ifItems     = filtered.filter((c) => c.medium === "instant_form");
  const agencyItems = filtered.filter((c) => c.medium === "agency");

  const SortIcon = ({ k }: { k: keyof AdCreative }) =>
    sortKey === k ? (sortAsc ? <ChevronUp size={11} className="text-indigo-500" /> : <ChevronDown size={11} className="text-indigo-500" />) : <ChevronDown size={11} className="text-gray-300" />;
  const TH = ({ k, label }: { k: keyof AdCreative; label: string }) => (
    <th onClick={() => toggleSort(k)} className="text-left py-2 px-3 text-xs font-semibold text-gray-400 cursor-pointer hover:text-gray-600 whitespace-nowrap select-none">
      <span className="flex items-center gap-0.5">{label}<SortIcon k={k} /></span>
    </th>
  );

  return (
    <div className="space-y-5">
      {/* サマリ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "LP 消化金額",         value: fmtYen(sumSpend(lpItems)),     sub: `CV ${sumCV(lpItems)}件 / CPA ${fmtYen(avgCPA(lpItems))}`,          cls: "bg-gradient-to-br from-indigo-500 to-indigo-700" },
          { label: "インスタント 消化金額", value: fmtYen(sumSpend(ifItems)),     sub: `CV ${sumCV(ifItems)}件 / CPA ${fmtYen(avgCPA(ifItems))}`,          cls: "bg-gradient-to-br from-cyan-500 to-cyan-700" },
          { label: "代理店（エモロジー）",  value: fmtYen(sumSpend(agencyItems)), sub: `リード ${sumCV(agencyItems)}件 / CPA ${fmtYen(avgCPA(agencyItems))}`, cls: "bg-gradient-to-br from-violet-500 to-violet-700" },
          { label: "総消化金額",           value: fmtYen(sumSpend(filtered)),    sub: `総CV ${sumCV(filtered)}件 / CPA ${fmtYen(avgCPA(filtered))}`,      cls: "bg-gradient-to-br from-emerald-500 to-emerald-700" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${c.cls}`}><Megaphone size={16} className="text-white" /></div>
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className="text-xl font-bold text-gray-900">{c.value}</p>
            <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* フィルタ + ビュー切り替え */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-400 font-medium">媒体:</span>
        {[["all","すべて"],["lp","LP"],["instant_form","インスタントフォーム"],["agency","代理店"]].map(([v,l]) => (
          <button key={v} onClick={() => setFilterMedium(v)}
            className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-colors ${filterMedium === v ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-500 border-gray-200 hover:border-indigo-300"}`}>{l}</button>
        ))}
        <span className="text-xs text-gray-400 font-medium ml-3">ステータス:</span>
        {[["all","すべて"],["active","配信中"],["inactive","停止"],["not_delivering","配信なし"]].map(([v,l]) => (
          <button key={v} onClick={() => setFilterStatus(v)}
            className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-colors ${filterStatus === v ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-500 border-gray-200 hover:border-indigo-300"}`}>{l}</button>
        ))}
        <span className="text-xs text-gray-400 ml-auto">{filtered.length}件</span>
        {/* ビュー切り替え */}
        <div className="flex gap-0.5 bg-gray-100 p-0.5 rounded-xl ml-2">
          {([["grouped","広告セット別"] , ["flat","全件一覧"]] as const).map(([mode, label]) => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${viewMode === mode ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 広告セット別グループ表示 ── */}
      {viewMode === "grouped" && (
        <div className="space-y-3">
          {grouped.map(({ name, items }) => {
            const isOpen = expandedSet === null || expandedSet === name;
            return (
              <div key={name} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <button className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedSet(expandedSet === name ? null : name)}>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-400" />
                    <span className="font-semibold text-gray-800 text-sm">{name}</span>
                    <span className="text-xs text-gray-400">{items.length}クリエイティブ</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>消化 <strong className="text-gray-700">{fmtYen(sumSpend(items))}</strong></span>
                    {sumCV(items) > 0 && <span>CV <strong className="text-gray-700">{sumCV(items)}件</strong></span>}
                    {avgCPA(items) > 0 && <span>CPA <strong className="text-gray-700">{fmtYen(avgCPA(items))}</strong></span>}
                    {isOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <CreativeTable items={items} TH={TH} onSelectImage={setSelectedImage} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── 全件一覧表示（グローバルソート）── */}
      {viewMode === "flat" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">全クリエイティブ一覧</p>
            <p className="text-xs text-gray-400">{sorted.length}件 · 列ヘッダーをクリックしてソート</p>
          </div>
          <div className="overflow-x-auto">
            <CreativeTable items={sorted} TH={TH} onSelectImage={setSelectedImage} showAdSet />
          </div>
        </div>
      )}
      {/* 画像モーダル */}
      {selectedImage && (
        <ImageModal adName={selectedImage} onClose={() => setSelectedImage(null)} />
      )}
    </div>
  );
}

// ── メインコンポーネント ────────────────────────────────

type DashTab = "overview" | "channel" | "creative";

export default function DashboardPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [activeTab, setActiveTab]       = useState<DashTab>("overview");
  const [data, setData]                 = useState<SheetsData | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [spinning, setSpinning]         = useState(false);
  const [channelStats, setChannelStats] = useState<ChannelStat[]>([]);
  const [channelLoaded, setChannelLoaded] = useState(false);
  const [creatives, setCreatives]       = useState<AdCreative[]>([]);
  const [creativeLoaded, setCreativeLoaded] = useState(false);
  const [subLoading, setSubLoading]     = useState(false);
  const [totalLeads, setTotalLeads]     = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback((silent = false) => {
    if (!silent) setLoading(true); else setSpinning(true);
    setError(null);
    fetch("/api/sheets?period=all")
      .then(r => r.json())
      .then(d => { if (d.error) { setError(d.error); return; } setData(d); })
      .catch(() => setError("データの取得に失敗しました"))
      .finally(() => { setLoading(false); setSpinning(false); });
  }, []);

  const loadChannel = useCallback(async () => {
    if (channelLoaded) return;
    setSubLoading(true);
    const res = await fetch("/api/management/simulate");
    if (res.ok) { const d = await res.json(); setChannelStats(d.channelStats ?? []); }
    setChannelLoaded(true);
    setSubLoading(false);
  }, [channelLoaded]);

  const loadCreative = useCallback(async () => {
    if (creativeLoaded) return;
    setSubLoading(true);
    const res = await fetch("/api/management/ad-creatives");
    if (res.ok) setCreatives(await res.json());
    setCreativeLoaded(true);
    setSubLoading(false);
  }, [creativeLoaded]);

  useEffect(() => { fetchData(false); }, [fetchData]);

  useEffect(() => {
    fetch("/api/monthly-summary")
      .then((r) => r.json())
      .then((d: { leads: number }[]) => {
        if (Array.isArray(d)) setTotalLeads(d.reduce((s, r) => s + (r.leads ?? 0), 0));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const schedule = () => { timerRef.current = setTimeout(() => { fetchData(true); schedule(); }, AUTO_REFRESH_MS); };
    schedule();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [fetchData]);

  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab === "channel")  loadChannel();
    if (activeTab === "creative") loadCreative();
  }, [activeTab, isAdmin, loadChannel, loadCreative]);

  const lastUpdated = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
    : null;

  const TABS: { id: DashTab; label: string }[] = [
    { id: "overview",  label: "概要" },
    ...(isAdmin ? [
      { id: "channel"  as DashTab, label: "集客経路分析" },
      { id: "creative" as DashTab, label: "クリエイティブ分析" },
    ] : []),
  ];

  const headerActions = (
    <div className="flex items-center gap-2">
      {lastUpdated && <span className="text-xs text-gray-400 flex items-center gap-1 mr-2"><Clock size={11} /> {lastUpdated} 更新</span>}
      <button onClick={() => fetchData(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors ${spinning ? "opacity-50 pointer-events-none" : ""}`}>
        <RefreshCw size={13} className={spinning ? "animate-spin" : ""} /> 更新
      </button>
    </div>
  );

  if (loading) return (
    <AppLayout title="ダッシュボード" actions={headerActions}>
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">データを読み込み中...</p>
        </div>
      </div>
    </AppLayout>
  );

  if (error) return (
    <AppLayout title="ダッシュボード" actions={headerActions}>
      <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center max-w-lg mx-auto mt-10">
        <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
        <p className="text-sm font-semibold text-red-700 mb-2">{error}</p>
        <button onClick={() => fetchData()} className="px-4 py-2 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700">再試行</button>
      </div>
    </AppLayout>
  );

  if (!data) return null;
  const { cumulative, salesPersonStats, allMonthly, bySource, byAppointer, byStatus } = data;
  const sortedSP = [...salesPersonStats].sort((a, b) => b.contracts - a.contracts);
  const allMonths = [...new Set([...allMonthly.map(m => m.month), ...salesPersonStats.flatMap(sp => sp.monthlyBreakdown.map(m => m.month))])].sort();
  const spMonthlyChartData = allMonths.map(month => {
    const row: Record<string, string | number> = { month };
    salesPersonStats.forEach(sp => {
      const found = sp.monthlyBreakdown.find(m => m.month === month);
      row[`${sp.name}_contracts`] = found?.contracts ?? 0;
    });
    return row;
  });

  return (
    <AppLayout title="ダッシュボード" actions={headerActions}>
      <div className="space-y-5">

        {/* ページ説明 */}
        <div className="bg-white rounded-2xl px-5 py-4 shadow-sm border border-gray-100 text-sm text-gray-600 leading-relaxed">
          <span className="font-semibold text-gray-800">概要</span>では累計アポ数・契約数・転換率・営業マン別実績・アポインター別実績をリアルタイムで確認できます。
          <span className="font-semibold text-gray-800 mx-1">集客経路分析</span>では代理店・自社広告（LP）・インスタントフォームごとのアポ率・契約率・CPA・ROIを比較できます。
          <span className="font-semibold text-gray-800 mx-1">クリエイティブ分析</span>では各広告素材の消化金額・CV数・CPAを確認でき、クリエイティブ画像もプレビューできます。
        </div>

        {/* タブ */}
        {TABS.length > 1 && (
          <div className="flex gap-1 bg-gray-100/80 p-1 rounded-2xl w-fit">
            {TABS.map(({ id, label }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === id ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-800"
                }`}>
                {label}
                {activeTab === id && <ChevronRight size={12} className="text-indigo-400" />}
              </button>
            ))}
          </div>
        )}

        {/* サブタブのローディング */}
        {subLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            読み込み中…
          </div>
        )}

        {/* ── 概要タブ ── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">累計実績（全期間）</p>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <KPICard label="累計アポ数" value={`${cumulative.totalApo}件`} badge="累計" icon={Users} iconBg="bg-indigo-50" iconColor="text-indigo-600" sub="全期間合計" />
                <KPICard label="累計契約数" value={`${cumulative.totalContracts}件`} badge="累計" icon={TrendingUp} iconBg="bg-emerald-50" iconColor="text-emerald-600" sub="全期間合計" />
                <KPICard label="後追い中" value={`${cumulative.followUps}件`} icon={AlertCircle} iconBg="bg-orange-50" iconColor="text-orange-500" sub="要フォローアップ" />
                <KPICard label="累計契約率（アポ比）" value={`${cumulative.contractRate}%`} badge="累計" icon={Percent} iconBg="bg-purple-50" iconColor="text-purple-600"
                  sub={`見込(高)${cumulative.prospectHigh} 中${cumulative.prospectMid} 低${cumulative.prospectLow}`} />
                <KPICard
                  label="契約率（リード比）"
                  value={totalLeads > 0 ? `${Math.round((cumulative.totalContracts / totalLeads) * 100)}%` : "—"}
                  badge="累計"
                  icon={Percent}
                  iconBg="bg-cyan-50"
                  iconColor="text-cyan-600"
                  sub={totalLeads > 0 ? `契約${cumulative.totalContracts}件 ÷ リード${totalLeads.toLocaleString()}件` : "リードデータを入力してください"}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <ChartCard title="月別実績" className="lg:col-span-1"><MonthlyTable data={allMonthly} /></ChartCard>
              <ChartCard title="月別 アポ数・契約数の推移" className="lg:col-span-2">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={allMonthly}>
                    <defs>
                      <linearGradient id="gApo" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366F1" stopOpacity={0.15}/><stop offset="95%" stopColor="#6366F1" stopOpacity={0}/></linearGradient>
                      <linearGradient id="gCon" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#06B6D4" stopOpacity={0.15}/><stop offset="95%" stopColor="#06B6D4" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="month" tick={{fontSize:10,fill:"#94A3B8"}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize:10,fill:"#94A3B8"}} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{borderRadius:"12px",border:"none",boxShadow:"0 4px 20px rgba(0,0,0,0.1)"}} />
                    <Legend />
                    <Area type="monotone" dataKey="apo" name="アポ数" stroke="#6366F1" strokeWidth={2} fill="url(#gApo)" dot={false} />
                    <Area type="monotone" dataKey="contracts" name="契約数" stroke="#06B6D4" strokeWidth={2} fill="url(#gCon)" dot={{r:4,fill:"#06B6D4"}} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">営業マン別 実績（全期間）</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {sortedSP.map((sp, i) => <SalesPersonCard key={sp.name} sp={sp} rank={i} />)}
              </div>
            </div>

            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">アポインター別 実績（全期間）</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {byAppointer.map((ap, i) => <AppointerCard key={ap.appointer} ap={ap} idx={i} />)}
              </div>
            </div>

            <ChartCard title="営業マン別 月別契約数の推移（全期間）">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={spMonthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="month" tick={{fontSize:10,fill:"#94A3B8"}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize:10,fill:"#94A3B8"}} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{borderRadius:"12px",border:"none",boxShadow:"0 4px 20px rgba(0,0,0,0.1)"}} />
                  <Legend />
                  {salesPersonStats.map(sp => (
                    <Line key={sp.name} type="monotone" dataKey={`${sp.name}_contracts`} name={`${sp.name} 契約`}
                      stroke={SP_COLORS[sp.name] ?? "#ccc"} strokeWidth={2} dot={{r:4,fill:SP_COLORS[sp.name] ?? "#ccc"}} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <ChartCard title="商談結果の内訳">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={byStatus} dataKey="count" nameKey="status" innerRadius={45} outerRadius={75} paddingAngle={3}>
                      {byStatus.map((e, i) => <Cell key={i} fill={STATUS_COLORS[e.status] ?? PALETTE[i % 8]} />)}
                    </Pie>
                    <Tooltip contentStyle={{borderRadius:"10px",border:"none",boxShadow:"0 4px 16px rgba(0,0,0,0.1)"}} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-1.5">
                  {byStatus.slice(0,6).map((s, i) => (
                    <div key={s.status} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor: STATUS_COLORS[s.status] ?? PALETTE[i % 8]}} />
                        <span className="text-gray-500 truncate">{s.status}</span>
                      </div>
                      <span className="font-semibold text-gray-700">{s.count}件</span>
                    </div>
                  ))}
                </div>
              </ChartCard>
              <ChartCard title="流入経路別 アポ数・契約数（全期間）" className="lg:col-span-2">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={bySource} layout="vertical" barSize={12} barCategoryGap="30%">
                    <XAxis type="number" tick={{fontSize:10,fill:"#94A3B8"}} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="source" tick={{fontSize:9,fill:"#64748B"}} axisLine={false} tickLine={false} width={140} />
                    <Tooltip contentStyle={{borderRadius:"12px",border:"none",boxShadow:"0 4px 20px rgba(0,0,0,0.1)"}} />
                    <Legend />
                    <Bar dataKey="apo" name="アポ" fill="#6366F1" radius={[0,4,4,0]} />
                    <Bar dataKey="contracts" name="契約" fill="#06B6D4" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </div>
        )}

        {/* ── 集客経路分析タブ ── */}
        {activeTab === "channel" && !subLoading && (
          <ChannelView channelStats={channelStats} />
        )}

        {/* ── クリエイティブ分析タブ ── */}
        {activeTab === "creative" && !subLoading && (
          <CreativeView creatives={creatives} />
        )}

      </div>
    </AppLayout>
  );
}
