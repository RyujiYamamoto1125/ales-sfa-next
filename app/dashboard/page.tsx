"use client";

import { useEffect, useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, CartesianGrid, AreaChart, Area,
} from "recharts";
import {
  TrendingUp, Users, DollarSign, Percent,
  ArrowUpRight, ArrowDownRight, Layers, Megaphone, TableProperties, Database,
} from "lucide-react";

// ── 定数 ──────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  "未実行": "#94A3B8", "見込み（高）": "#6366F1", "見込み（中）": "#22C55E",
  "見込み（低）": "#F59E0B", "申し込みフォーム返送待ち": "#A855F7",
  "NG": "#EF4444", "契約": "#06B6D4", "後追い": "#F97316",
  "不参加": "#64748B", "契約書返送待ち": "#8B5CF6",
};

const MEDIUM_PALETTE = ["#6366F1","#22C55E","#F59E0B","#EF4444","#A855F7","#06B6D4"];

const TABS = ["概要","営業マン別","ファネル分析","広告分析"] as const;
type Tab = typeof TABS[number];
type DataSource = "db" | "sheets";

// ── 型 ────────────────────────────────────────────────
interface SheetMetric { label: string; emology: string; form: string; ownLpEarly: string; ownLpLate: string; total: string; }

interface DashboardData {
  kpis: {
    totalCases: number; thisMonthApo: number; thisMonthContracts: number;
    totalContracts: number; thisMonthAmount: number; totalAmount: number;
    contractRate: number; apoRate: number | null; globalTarget: number; totalLeads: number;
  };
  statusCounts: Record<string, number>;
  monthlyTrend: { month: string; contracts: number; amount: number; apo: number }[];
  salesPersonStats: {
    name: string; apo: number; contracts: number; amount: number;
    contractRate: number; targetContracts: number; targetAmount: number;
    contractAchievement: number | null; amountAchievement: number | null;
  }[];
  funnelData: { status: string; count: number; avgDays: number }[];
  leadsByMedium: { medium: string; count: number }[];
  apoByMedium: { medium: string; leads: number; apo: number; apoRate: number }[];
  leadsRaw: { id: number; date: string; medium: string; lead_count: number }[];
  sheetsMetrics?: SheetMetric[];
}

// ── スプレッドシート サマリテーブル ───────────────────
const MEDIUM_LABELS = ["エモロジー", "フォーム", "自社LP(〜4/8)", "自社LP(4/9〜)", "合計・平均"];

function SheetsMetricsTable({ metrics }: { metrics: SheetMetric[] }) {
  if (!metrics || metrics.length === 0) return null;
  const cols: (keyof SheetMetric)[] = ["emology","form","ownLpEarly","ownLpLate","total"];
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
      <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
        <TableProperties size={16} className="text-indigo-600" />
        <h3 className="text-sm font-semibold text-gray-700">スプレッドシート 媒体別サマリ（累計）</h3>
      </div>
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 w-40">指標</th>
            {MEDIUM_LABELS.map((m) => (
              <th key={m} className={`px-4 py-3 text-right text-xs font-semibold ${m === "合計・平均" ? "text-indigo-600 bg-indigo-50" : "text-gray-400"}`}>{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((row, i) => (
            <tr key={row.label} className={`border-t border-gray-50 ${i % 2 === 0 ? "" : "bg-gray-50/40"}`}>
              <td className="px-5 py-3 font-medium text-gray-700">{row.label}</td>
              {cols.map((c, ci) => (
                <td key={c} className={`px-4 py-3 text-right text-gray-600 ${ci === 4 ? "font-bold text-indigo-700 bg-indigo-50/60" : ""}`}>
                  {row[c] || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── KPIカード ──────────────────────────────────────────
function KPICard({
  label, value, sub, icon: Icon, iconBg, iconColor, trend,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
  trend?: { value: number; label: string };
}) {
  const up = (trend?.value ?? 0) >= 0;
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-start gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon size={22} className={iconColor} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-400 mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-800 leading-none mb-1">{value}</p>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${up ? "text-emerald-600" : "text-red-500"}`}>
            {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(trend.value)}% {trend.label}
          </div>
        )}
        {sub && !trend && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

// ── チャートカード ─────────────────────────────────────
function ChartCard({ title, children, className = "" }: {
  title: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-700 mb-5">{title}</h3>
      {children}
    </div>
  );
}

// ── メインコンポーネント ────────────────────────────────
export default function DashboardPage() {
  const now = new Date();
  const [year, setYear]       = useState(now.getFullYear());
  const [month, setMonth]     = useState(now.getMonth() + 1);
  const [tab, setTab]         = useState<Tab>("概要");
  const [dataSource, setDataSource] = useState<DataSource>("db");
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sheetsError, setSheetsError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    setSheetsError(null);
    const url = dataSource === "sheets"
      ? `/api/sheets?year=${year}&month=${month}`
      : `/api/dashboard?year=${year}&month=${month}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setSheetsError(d.error); setLoading(false); return; }
        setData(d);
        setLoading(false);
      });
  }, [year, month, dataSource]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const periodSelector = (
    <div className="flex items-center gap-2 flex-wrap">
      {/* データソース切り替え */}
      <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
        <button onClick={() => setDataSource("db")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${dataSource === "db" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          <Database size={12} /> DB
        </button>
        <button onClick={() => setDataSource("sheets")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${dataSource === "sheets" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          <TableProperties size={12} /> スプレッドシート
        </button>
      </div>
      <select value={year} onChange={(e) => setYear(Number(e.target.value))}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-300">
        {[now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1].map(y=><option key={y}>{y}</option>)}
      </select>
      <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-300">
        {Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m}月</option>)}
      </select>
    </div>
  );

  if (sheetsError) {
    return (
      <AppLayout title="ダッシュボード" actions={periodSelector}>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center max-w-lg mx-auto mt-10">
          <TableProperties size={32} className="text-amber-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-amber-700 mb-1">スプレッドシート連携エラー</p>
          <p className="text-xs text-amber-600 mb-4">{sheetsError}</p>
          <p className="text-xs text-gray-500">
            Vercelの環境変数に <code className="bg-gray-100 px-1 rounded">GOOGLE_SHEETS_API_KEY</code> を設定してください。
          </p>
          <button onClick={() => setDataSource("db")}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition-colors">
            DBモードに切り替え
          </button>
        </div>
      </AppLayout>
    );
  }

  if (loading || !data) {
    return (
      <AppLayout title="ダッシュボード" actions={periodSelector}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-400">データを読み込み中...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const { kpis, statusCounts, monthlyTrend, salesPersonStats, funnelData, leadsByMedium, apoByMedium } = data;
  const statusPieData = Object.entries(statusCounts).map(([name,value])=>({name,value}));
  const targetDiff = kpis.thisMonthContracts - kpis.globalTarget;

  return (
    <AppLayout title="ダッシュボード" actions={periodSelector}>
      {/* タブ */}
      <div className="flex gap-1 bg-white rounded-2xl p-1.5 w-fit mb-6 shadow-sm border border-gray-100">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* ===== 概要 ===== */}
      {tab === "概要" && (
        <div className="space-y-6">
          {/* KPIカード4枚 */}
          {dataSource === "sheets" && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 mb-1">
              <TableProperties size={13} />
              スプレッドシートモード：全期間の累計を表示しています
            </div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label={dataSource === "sheets" ? "累計アポ数" : "今月のアポ数"}
              value={`${kpis.thisMonthApo}件`}
              icon={Users} iconBg="bg-indigo-50" iconColor="text-indigo-600"
              sub={dataSource === "sheets" ? "スプレッドシート全件" : `累計 ${kpis.totalCases}件`} />
            <KPICard
              label={dataSource === "sheets" ? "累計契約数" : "今月の契約数"}
              value={`${kpis.thisMonthContracts}件`}
              icon={TrendingUp} iconBg="bg-emerald-50" iconColor="text-emerald-600"
              trend={!dataSource && kpis.globalTarget > 0 ? { value: Math.round(targetDiff / kpis.globalTarget * 100), label: "vs目標" } : undefined}
              sub={dataSource === "sheets" ? "スプレッドシート全件" : kpis.globalTarget > 0 ? `目標 ${kpis.globalTarget}件` : undefined} />
            {dataSource === "sheets" ? (
              <KPICard label="後追い件数" value={`${statusCounts["後追い"] ?? 0}件`}
                icon={Megaphone} iconBg="bg-orange-50" iconColor="text-orange-500"
                sub="要フォローアップ" />
            ) : (
              <KPICard label="今月の売上" value={`¥${(kpis.thisMonthAmount/10000).toFixed(1)}万`}
                icon={DollarSign} iconBg="bg-amber-50" iconColor="text-amber-600"
                sub={`累計 ¥${(kpis.totalAmount/10000).toFixed(0)}万`} />
            )}
            <KPICard label="契約率" value={`${kpis.contractRate}%`}
              icon={Percent} iconBg="bg-purple-50" iconColor="text-purple-600"
              sub={dataSource === "sheets" ? "全期間 契約÷アポ" : kpis.apoRate != null ? `アポ率 ${kpis.apoRate}%` : "リード未入力"} />
          </div>

          {/* グラフ2列 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <ChartCard title="月別 アポ数・契約数の推移" className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthlyTrend}>
                  <defs>
                    <linearGradient id="colorApo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorContract" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#06B6D4" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="month" tick={{fontSize:10, fill:"#94A3B8"}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize:10, fill:"#94A3B8"}} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{borderRadius:"12px",border:"none",boxShadow:"0 4px 20px rgba(0,0,0,0.1)"}} />
                  <Legend />
                  <Area type="monotone" dataKey="apo" name="アポ数" stroke="#6366F1" strokeWidth={2} fill="url(#colorApo)" dot={false} />
                  <Area type="monotone" dataKey="contracts" name="契約数" stroke="#06B6D4" strokeWidth={2} fill="url(#colorContract)" dot={{r:4,fill:"#06B6D4"}} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="ステータス別件数">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusPieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3}>
                    {statusPieData.map((entry,i)=>(
                      <Cell key={i} fill={STATUS_COLORS[entry.name]??"#ccc"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{borderRadius:"12px",border:"none",boxShadow:"0 4px 20px rgba(0,0,0,0.1)"}} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5">
                {statusPieData.slice(0,4).map((s)=>(
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor:STATUS_COLORS[s.name]??"#ccc"}} />
                      <span className="text-gray-500 truncate">{s.name}</span>
                    </div>
                    <span className="font-semibold text-gray-700">{s.value}</span>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>

          {/* 売上推移 + ハイライトカード */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <ChartCard title="月別売上推移" className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthlyTrend} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="month" tick={{fontSize:10,fill:"#94A3B8"}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize:10,fill:"#94A3B8"}} axisLine={false} tickLine={false} tickFormatter={(v)=>`¥${(v/10000).toFixed(0)}万`} />
                  <Tooltip contentStyle={{borderRadius:"12px",border:"none",boxShadow:"0 4px 20px rgba(0,0,0,0.1)"}} formatter={(v)=>`¥${Number(v).toLocaleString()}`} />
                  <Bar dataKey="amount" name="売上" fill="#6366F1" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* ハイライトカード */}
            <div className="bg-indigo-600 rounded-2xl p-6 flex flex-col justify-between text-white">
              <div>
                <p className="text-indigo-200 text-xs font-medium mb-1">今月の累計売上</p>
                <p className="text-4xl font-bold leading-none mb-1">
                  ¥{(kpis.thisMonthAmount/10000).toFixed(1)}<span className="text-xl font-normal text-indigo-200">万</span>
                </p>
                <p className="text-indigo-300 text-xs mt-2">
                  {kpis.thisMonthContracts}件 × 平均¥{kpis.thisMonthContracts > 0 ? Math.round(kpis.thisMonthAmount/kpis.thisMonthContracts).toLocaleString() : 0}
                </p>
              </div>
              <div className="mt-4">
                <ResponsiveContainer width="100%" height={70}>
                  <AreaChart data={monthlyTrend.slice(-6)}>
                    <defs>
                      <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#fff" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#fff" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="amount" stroke="#fff" strokeWidth={2} fill="url(#sparkGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== 営業マン別 ===== */}
      {tab === "営業マン別" && (
        <div className="space-y-5">
          {salesPersonStats.length === 0 ? (
            <div className="bg-white rounded-2xl p-16 text-center border border-gray-100">
              <Users size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">営業担当者が設定された案件がありません</p>
            </div>
          ) : (
            <>
              {/* ランキングカード */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {salesPersonStats.slice(0,3).map((sp,i)=>{
                  const medals = ["🥇","🥈","🥉"];
                  return (
                    <div key={sp.name} className={`rounded-2xl p-5 border ${i===0?"bg-indigo-600 border-indigo-500 text-white":"bg-white border-gray-100"}`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-2xl">{medals[i]}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${i===0?"bg-indigo-500 text-white":"bg-gray-100 text-gray-500"}`}>
                          {i+1}位
                        </span>
                      </div>
                      <p className={`text-lg font-bold ${i===0?"text-white":"text-gray-800"}`}>{sp.name}</p>
                      <p className={`text-sm ${i===0?"text-indigo-200":"text-gray-400"} mb-3`}>{sp.apo}アポ → <span className="font-semibold">{sp.contracts}契約</span></p>
                      <div className="flex items-baseline gap-1">
                        <p className={`text-2xl font-bold ${i===0?"text-white":"text-indigo-600"}`}>¥{(sp.amount/10000).toFixed(1)}万</p>
                      </div>
                      {sp.contractAchievement != null && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className={i===0?"text-indigo-200":"text-gray-400"}>目標達成率</span>
                            <span className={`font-semibold ${i===0?"text-white":sp.contractAchievement>=100?"text-emerald-600":"text-red-500"}`}>
                              {sp.contractAchievement}%
                            </span>
                          </div>
                          <div className={`h-1.5 rounded-full ${i===0?"bg-indigo-500":"bg-gray-100"}`}>
                            <div className={`h-full rounded-full ${i===0?"bg-white":sp.contractAchievement>=100?"bg-emerald-500":"bg-amber-400"}`}
                              style={{width:`${Math.min(sp.contractAchievement,100)}%`}} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 詳細テーブル */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">{year}年{month}月 全員の実績</h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      {["順位","氏名","アポ","契約","契約率","売上","契約達成","売上達成"].map(h=>(
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {salesPersonStats.map((sp,i)=>(
                      <tr key={sp.name} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4 font-bold text-gray-400">{i+1}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                              <span className="text-indigo-700 font-bold text-xs">{sp.name.charAt(0)}</span>
                            </div>
                            <span className="font-semibold text-gray-800">{sp.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-500">{sp.apo}</td>
                        <td className="px-5 py-4 font-bold text-indigo-600">{sp.contracts}</td>
                        <td className="px-5 py-4 text-gray-600">{sp.contractRate}%</td>
                        <td className="px-5 py-4 font-semibold text-gray-700">¥{sp.amount.toLocaleString()}</td>
                        <td className="px-5 py-4">
                          {sp.contractAchievement != null
                            ? <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sp.contractAchievement>=100?"bg-emerald-50 text-emerald-700":"bg-red-50 text-red-500"}`}>{sp.contractAchievement}%</span>
                            : <span className="text-gray-300 text-xs">未設定</span>}
                        </td>
                        <td className="px-5 py-4">
                          {sp.amountAchievement != null
                            ? <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sp.amountAchievement>=100?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-700"}`}>{sp.amountAchievement}%</span>
                            : <span className="text-gray-300 text-xs">未設定</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 比較グラフ */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ChartCard title="契約数ランキング">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={salesPersonStats} layout="vertical" barSize={16}>
                      <XAxis type="number" tick={{fontSize:10,fill:"#94A3B8"}} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{fontSize:11,fill:"#64748B"}} axisLine={false} tickLine={false} width={45} />
                      <Tooltip contentStyle={{borderRadius:"12px",border:"none",boxShadow:"0 4px 20px rgba(0,0,0,0.1)"}} />
                      <Bar dataKey="contracts" name="契約数" fill="#6366F1" radius={[0,6,6,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="売上ランキング">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={salesPersonStats} layout="vertical" barSize={16}>
                      <XAxis type="number" tick={{fontSize:10,fill:"#94A3B8"}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/10000).toFixed(0)}万`} />
                      <YAxis type="category" dataKey="name" tick={{fontSize:11,fill:"#64748B"}} axisLine={false} tickLine={false} width={45} />
                      <Tooltip contentStyle={{borderRadius:"12px",border:"none",boxShadow:"0 4px 20px rgba(0,0,0,0.1)"}} formatter={v=>`¥${Number(v).toLocaleString()}`} />
                      <Bar dataKey="amount" name="売上" fill="#22C55E" radius={[0,6,6,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== ファネル分析 ===== */}
      {tab === "ファネル分析" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {funnelData.filter(f=>f.count>0).slice(0,4).map((f)=>(
              <div key={f.status} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="w-3 h-3 rounded-full mb-3" style={{backgroundColor:STATUS_COLORS[f.status]??"#ccc"}} />
                <p className="text-xs text-gray-400 mb-1 truncate">{f.status}</p>
                <p className="text-3xl font-bold text-gray-800">{f.count}<span className="text-sm font-normal text-gray-400 ml-1">件</span></p>
                <p className="text-xs text-gray-400 mt-1">平均滞留 <span className="font-semibold text-gray-600">{f.avgDays}日</span></p>
              </div>
            ))}
          </div>

          <ChartCard title="商談ファネル（全期間）">
            <div className="space-y-3">
              {funnelData.filter(f=>f.count>0).map((f,i)=>{
                const total = funnelData.reduce((s,x)=>s+x.count,0);
                const pct = total>0?Math.round(f.count/total*100):0;
                const max = Math.max(...funnelData.map(x=>x.count),1);
                const barPct = Math.round(f.count/max*100);
                return (
                  <div key={f.status} className="flex items-center gap-4">
                    <div className="w-32 text-right">
                      <span className="text-xs font-medium text-gray-600 truncate block">{f.status}</span>
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden">
                      <div className="h-full rounded-full flex items-center px-3 transition-all"
                        style={{width:`${Math.max(barPct,6)}%`, backgroundColor:STATUS_COLORS[f.status]??"#6366F1", opacity:0.85}}>
                        <span className="text-xs font-bold text-white">{f.count}件</span>
                      </div>
                    </div>
                    <div className="w-16 text-xs text-gray-400 text-right">{pct}%</div>
                    <div className="w-16 text-xs font-medium text-gray-500 text-right">{f.avgDays}日</div>
                  </div>
                );
              })}
            </div>
          </ChartCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCard title="ステージ別件数">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={funnelData.filter(f=>f.count>0)} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="status" tick={{fontSize:8,fill:"#94A3B8"}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize:10,fill:"#94A3B8"}} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{borderRadius:"12px",border:"none",boxShadow:"0 4px 20px rgba(0,0,0,0.1)"}} />
                  <Bar dataKey="count" name="件数" radius={[6,6,0,0]}>
                    {funnelData.filter(f=>f.count>0).map((entry,i)=>(
                      <Cell key={i} fill={STATUS_COLORS[entry.status]??"#6366F1"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="平均滞留日数">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={funnelData.filter(f=>f.count>0)} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="status" tick={{fontSize:8,fill:"#94A3B8"}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize:10,fill:"#94A3B8"}} axisLine={false} tickLine={false} unit="日" />
                  <Tooltip contentStyle={{borderRadius:"12px",border:"none",boxShadow:"0 4px 20px rgba(0,0,0,0.1)"}} formatter={v=>`${v}日`} />
                  <Bar dataKey="avgDays" name="平均滞留日数" fill="#A855F7" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>
      )}

      {/* ===== 広告分析 ===== */}
      {tab === "広告分析" && (
        <div className="space-y-5">
          {dataSource === "sheets" && data.sheetsMetrics && data.sheetsMetrics.length > 0 && (
            <SheetsMetricsTable metrics={data.sheetsMetrics} />
          )}
          {dataSource === "db" && <LeadInputSection year={year} month={month} onSaved={fetchData} />}

          {leadsByMedium.length === 0 ? (
            <div className="bg-white rounded-2xl p-16 text-center border border-gray-100">
              <Megaphone size={40} className="text-gray-200 mx-auto mb-3" />
              {dataSource === "sheets"
                ? <p className="text-gray-400 text-sm">スプレッドシートにリードデータが見つかりません。</p>
                : <p className="text-gray-400 text-sm">リードデータがありません。上のフォームから入力してください。</p>}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {leadsByMedium.map((l,i)=>(
                  <div key={l.medium} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                      style={{backgroundColor:`${MEDIUM_PALETTE[i%6]}1A`}}>
                      <Megaphone size={18} style={{color:MEDIUM_PALETTE[i%6]}} />
                    </div>
                    <p className="text-xs text-gray-400 mb-1">{l.medium}</p>
                    <p className="text-2xl font-bold text-gray-800">{l.count}<span className="text-sm font-normal text-gray-400 ml-1">件</span></p>
                  </div>
                ))}
                <div className="bg-indigo-600 rounded-2xl p-5 text-white">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center mb-3">
                    <Layers size={18} className="text-white" />
                  </div>
                  <p className="text-xs text-indigo-200 mb-1">合計リード数</p>
                  <p className="text-2xl font-bold">{leadsByMedium.reduce((s,l)=>s+l.count,0)}<span className="text-sm font-normal text-indigo-200 ml-1">件</span></p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ChartCard title="媒体別リード数">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={leadsByMedium} barSize={32}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                      <XAxis dataKey="medium" tick={{fontSize:11,fill:"#94A3B8"}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fontSize:10,fill:"#94A3B8"}} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{borderRadius:"12px",border:"none",boxShadow:"0 4px 20px rgba(0,0,0,0.1)"}} />
                      <Bar dataKey="count" name="リード数" radius={[6,6,0,0]}>
                        {leadsByMedium.map((_,i)=><Cell key={i} fill={MEDIUM_PALETTE[i%6]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="媒体別シェア">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={leadsByMedium} dataKey="count" nameKey="medium" innerRadius={55} outerRadius={85} paddingAngle={4}>
                        {leadsByMedium.map((_,i)=><Cell key={i} fill={MEDIUM_PALETTE[i%6]} />)}
                      </Pie>
                      <Tooltip contentStyle={{borderRadius:"12px",border:"none",boxShadow:"0 4px 20px rgba(0,0,0,0.1)"}} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-3 space-y-2">
                    {leadsByMedium.map((l,i)=>{
                      const total = leadsByMedium.reduce((s,x)=>s+x.count,0);
                      return (
                        <div key={l.medium} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{backgroundColor:MEDIUM_PALETTE[i%6]}} />
                            <span className="text-gray-500">{l.medium}</span>
                          </div>
                          <span className="font-semibold text-gray-700">{total>0?Math.round(l.count/total*100):0}%</span>
                        </div>
                      );
                    })}
                  </div>
                </ChartCard>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-gray-50">
                  <h3 className="text-sm font-semibold text-gray-700">媒体別アポ率</h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400">媒体</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400">リード数</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400">アポ率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apoByMedium.map((a,i)=>(
                      <tr key={a.medium} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{backgroundColor:MEDIUM_PALETTE[i%6]}} />
                            <span className="font-medium text-gray-700">{a.medium}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right text-gray-500">{a.leads}件</td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="font-semibold text-indigo-600">{a.apoRate}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </AppLayout>
  );
}

// ── リード入力 ─────────────────────────────────────────
const MEDIUMS = ["Google","Meta","TikTok","LINE","その他"];

function LeadInputSection({ year, month, onSaved }: { year:number; month:number; onSaved:()=>void }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0,10), medium:"Google", leadCount:0 });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/leads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({date:form.date,medium:form.medium,leadCount:form.leadCount})});
    setSaving(false); setSaved(true);
    setTimeout(()=>setSaved(false),2000);
    onSaved();
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
          <Megaphone size={16} className="text-indigo-600" />
        </div>
        <h3 className="text-sm font-semibold text-gray-700">リード数入力（{year}年{month}月）</h3>
      </div>
      <form onSubmit={handleSave} className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">日付</label>
          <input type="date" value={form.date} onChange={(e)=>setForm({...form,date:e.target.value})}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">媒体</label>
          <select value={form.medium} onChange={(e)=>setForm({...form,medium:e.target.value})}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
            {MEDIUMS.map(m=><option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">リード数</label>
          <input type="number" min={0} value={form.leadCount}
            onChange={(e)=>setForm({...form,leadCount:Number(e.target.value)})}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <button type="submit" disabled={saving}
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
          {saved ? "保存済み ✓" : saving ? "保存中..." : "保存"}
        </button>
      </form>
    </div>
  );
}
