"use client";

import { useEffect, useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, CartesianGrid, AreaChart, Area, LineChart, Line,
} from "recharts";
import { TrendingUp, Users, Percent, AlertCircle, RefreshCw } from "lucide-react";

// ── 定数 ──────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  "見込み（高）": "#6366F1", "見込み（中）": "#22C55E", "見込み（低）": "#F59E0B",
  "後追い": "#F97316", "NG": "#EF4444", "契約": "#06B6D4",
  "不参加": "#64748B", "契約書返送待ち": "#8B5CF6", "未設定": "#94A3B8",
};
const SP_COLORS: Record<string, string> = {
  "山本": "#6366F1",
  "隅田": "#06B6D4",
  "片野": "#22C55E",
};
const PALETTE = ["#6366F1","#06B6D4","#22C55E","#F59E0B","#EF4444","#A855F7","#F97316","#64748B"];

// ── 型 ────────────────────────────────────────────────
interface SpStat {
  name: string;
  apo: number;
  contracts: number;
  followUps: number;
  ngs: number;
  prospects: number;
  contractRate: number;
  monthlyBreakdown: { month: string; apo: number; contracts: number }[];
}

interface SheetsData {
  cumulative: {
    totalApo: number; totalContracts: number; followUps: number;
    contractRate: number; prospectHigh: number; prospectMid: number; prospectLow: number;
  };
  salesPersonStats: SpStat[];
  monthly:    { month: string; apo: number; contracts: number }[];
  bySource:   { source: string; apo: number; contracts: number; rate: number }[];
  byAppointer:{ appointer: string; apo: number; contracts: number; rate: number }[];
  byStatus:   { status: string; count: number }[];
}

// ── 共通コンポーネント ─────────────────────────────────
function KPICard({ label, value, sub, icon: Icon, iconBg, iconColor }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-start gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon size={22} className={iconColor} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-400 mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-800 leading-none mb-1">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

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

// ── 営業マンカード ─────────────────────────────────────
function SalesPersonCard({ sp, rank }: { sp: SpStat; rank: number }) {
  const medals = ["🥇", "🥈", "🥉"];
  const color  = SP_COLORS[sp.name] ?? "#6366F1";
  const isTop  = rank === 0;

  return (
    <div className={`rounded-2xl p-6 border ${isTop
      ? "text-white border-transparent"
      : "bg-white border-gray-100"}`}
      style={isTop ? { background: `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)` } : {}}>

      <div className="flex items-center justify-between mb-4">
        <span className="text-3xl">{medals[rank]}</span>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isTop ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
          {rank + 1}位
        </span>
      </div>

      <p className={`text-2xl font-bold mb-1 ${isTop ? "text-white" : "text-gray-800"}`}>{sp.name}</p>
      <p className={`text-sm mb-5 ${isTop ? "text-white/70" : "text-gray-400"}`}>
        全期間 {sp.apo}アポ
      </p>

      {/* 主要数値 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className={`rounded-xl p-3 ${isTop ? "bg-white/20" : "bg-gray-50"}`}>
          <p className={`text-xs mb-0.5 ${isTop ? "text-white/60" : "text-gray-400"}`}>契約数</p>
          <p className={`text-2xl font-bold ${isTop ? "text-white" : "text-indigo-600"}`}>{sp.contracts}</p>
        </div>
        <div className={`rounded-xl p-3 ${isTop ? "bg-white/20" : "bg-gray-50"}`}>
          <p className={`text-xs mb-0.5 ${isTop ? "text-white/60" : "text-gray-400"}`}>契約率</p>
          <p className={`text-2xl font-bold ${isTop ? "text-white" : "text-emerald-600"}`}>{sp.contractRate}%</p>
        </div>
      </div>

      {/* サブ数値 */}
      <div className={`flex gap-4 text-xs ${isTop ? "text-white/70" : "text-gray-400"}`}>
        <span>後追い <span className={`font-bold ${isTop ? "text-white" : "text-orange-500"}`}>{sp.followUps}</span></span>
        <span>NG <span className={`font-bold ${isTop ? "text-white" : "text-red-500"}`}>{sp.ngs}</span></span>
        <span>見込み <span className={`font-bold ${isTop ? "text-white" : "text-purple-600"}`}>{sp.prospects}</span></span>
      </div>

      {/* ミニ棒グラフ */}
      <div className="mt-4">
        <ResponsiveContainer width="100%" height={60}>
          <BarChart data={sp.monthlyBreakdown.slice(-6)} barSize={10} barCategoryGap="30%">
            <Bar dataKey="contracts" fill={isTop ? "rgba(255,255,255,0.7)" : color} radius={[3,3,0,0]} />
            <Tooltip
              contentStyle={{borderRadius:"8px",border:"none",boxShadow:"0 4px 12px rgba(0,0,0,0.1)",fontSize:"11px"}}
              formatter={(v) => [`${v}件`, "契約"]}
              labelFormatter={(l) => l}
            />
          </BarChart>
        </ResponsiveContainer>
        <p className={`text-xs text-right mt-1 ${isTop ? "text-white/50" : "text-gray-300"}`}>直近6ヶ月の月別契約数</p>
      </div>
    </div>
  );
}

// ── メインコンポーネント ────────────────────────────────
export default function DashboardPage() {
  const [data, setData]       = useState<SheetsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/sheets")
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return; }
        setData(d);
        setLoading(false);
      })
      .catch(() => { setError("データの取得に失敗しました"); setLoading(false); });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const refreshBtn = (
    <button onClick={fetchData}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
      <RefreshCw size={13} /> 更新
    </button>
  );

  if (loading) {
    return (
      <AppLayout title="ダッシュボード" actions={refreshBtn}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-400">スプレッドシートを読み込み中...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title="ダッシュボード" actions={refreshBtn}>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center max-w-lg mx-auto mt-10">
          <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-red-700 mb-2">{error}</p>
          <button onClick={fetchData} className="px-4 py-2 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700">再試行</button>
        </div>
      </AppLayout>
    );
  }

  if (!data) return null;
  const { cumulative, salesPersonStats, monthly, bySource, byAppointer, byStatus } = data;

  // 月別・担当者別グラフ用データ（全月を合わせる）
  const allMonths = [...new Set([
    ...monthly.map(m => m.month),
    ...salesPersonStats.flatMap(sp => sp.monthlyBreakdown.map(m => m.month)),
  ])].sort();

  const spMonthlyChartData = allMonths.map(month => {
    const row: Record<string, string | number> = { month };
    salesPersonStats.forEach(sp => {
      const found = sp.monthlyBreakdown.find(m => m.month === month);
      row[`${sp.name}_apo`]       = found?.apo ?? 0;
      row[`${sp.name}_contracts`] = found?.contracts ?? 0;
    });
    return row;
  });

  return (
    <AppLayout title="ダッシュボード" actions={refreshBtn}>
      <div className="space-y-6">

        {/* ── 全体KPI ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard label="累計アポ数" value={`${cumulative.totalApo}件`}
            icon={Users} iconBg="bg-indigo-50" iconColor="text-indigo-600" sub="全期間合計" />
          <KPICard label="累計契約数" value={`${cumulative.totalContracts}件`}
            icon={TrendingUp} iconBg="bg-emerald-50" iconColor="text-emerald-600" sub="全期間合計" />
          <KPICard label="後追い中" value={`${cumulative.followUps}件`}
            icon={AlertCircle} iconBg="bg-orange-50" iconColor="text-orange-500" sub="要フォローアップ" />
          <KPICard label="全期間契約率" value={`${cumulative.contractRate}%`}
            icon={Percent} iconBg="bg-purple-50" iconColor="text-purple-600"
            sub={`見込(高)${cumulative.prospectHigh} 中${cumulative.prospectMid} 低${cumulative.prospectLow}`} />
        </div>

        {/* ── 営業マン別カード ── */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">営業マン別 実績</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {salesPersonStats.map((sp, i) => (
              <SalesPersonCard key={sp.name} sp={sp} rank={i} />
            ))}
          </div>
        </div>

        {/* ── 営業マン別 月別推移（契約数） ── */}
        <ChartCard title="営業マン別 月別契約数の推移">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={spMonthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{fontSize:10,fill:"#94A3B8"}} axisLine={false} tickLine={false} />
              <YAxis tick={{fontSize:10,fill:"#94A3B8"}} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{borderRadius:"12px",border:"none",boxShadow:"0 4px 20px rgba(0,0,0,0.1)"}} />
              <Legend />
              {salesPersonStats.map(sp => (
                <Line key={sp.name} type="monotone"
                  dataKey={`${sp.name}_contracts`} name={`${sp.name} 契約`}
                  stroke={SP_COLORS[sp.name] ?? "#ccc"} strokeWidth={2}
                  dot={{r:4, fill: SP_COLORS[sp.name] ?? "#ccc"}}
                  connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* ── 全体月別推移 + 商談結果 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <ChartCard title="月別 アポ数・契約数の推移（全体）" className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={monthly}>
                <defs>
                  <linearGradient id="gApo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gCon" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#06B6D4" stopOpacity={0}/>
                  </linearGradient>
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
                    <span className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{backgroundColor: STATUS_COLORS[s.status] ?? PALETTE[i % 8]}} />
                    <span className="text-gray-500 truncate">{s.status}</span>
                  </div>
                  <span className="font-semibold text-gray-700">{s.count}件</span>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>

        {/* ── アポ獲得者別 + 流入経路別 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ChartCard title="アポ獲得者別 実績">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {["獲得者","アポ","契約","契約率"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byAppointer.map((a, i) => (
                  <tr key={a.appointer} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                          style={{backgroundColor: PALETTE[i % 8]}}>
                          {a.appointer.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-700 text-xs">{a.appointer}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{a.apo}</td>
                    <td className="px-4 py-3 font-bold text-indigo-600">{a.contracts}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${a.rate >= 20 ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                        {a.rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ChartCard>

          <ChartCard title="流入経路別 アポ数・契約数">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bySource} layout="vertical" barSize={12} barCategoryGap="30%">
                <XAxis type="number" tick={{fontSize:10,fill:"#94A3B8"}} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="source" tick={{fontSize:9,fill:"#64748B"}} axisLine={false} tickLine={false} width={130} />
                <Tooltip contentStyle={{borderRadius:"12px",border:"none",boxShadow:"0 4px 20px rgba(0,0,0,0.1)"}} />
                <Legend />
                <Bar dataKey="apo" name="アポ" fill="#6366F1" radius={[0,4,4,0]} />
                <Bar dataKey="contracts" name="契約" fill="#06B6D4" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

      </div>
    </AppLayout>
  );
}
