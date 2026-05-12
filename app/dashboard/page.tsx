"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, CartesianGrid, AreaChart, Area, LineChart, Line,
} from "recharts";
import { TrendingUp, Users, Percent, AlertCircle, RefreshCw, Clock } from "lucide-react";

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
const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5分

type Period = "all" | "thisMonth" | "lastMonth";
const PERIOD_LABELS: Record<Period, string> = {
  all:       "全期間",
  thisMonth: "今月",
  lastMonth: "先月",
};

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
  monthly:     { month: string; apo: number; contracts: number }[];
  allMonthly:  { month: string; apo: number; contracts: number }[];
  bySource:    { source: string; apo: number; contracts: number; rate: number }[];
  byAppointer: { appointer: string; apo: number; contracts: number; rate: number }[];
  byStatus:    { status: string; count: number }[];
  fetchedAt:   string;
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
        {sp.apo}アポ
      </p>

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

      <div className={`flex gap-4 text-xs ${isTop ? "text-white/70" : "text-gray-400"}`}>
        <span>後追い <span className={`font-bold ${isTop ? "text-white" : "text-orange-500"}`}>{sp.followUps}</span></span>
        <span>NG <span className={`font-bold ${isTop ? "text-white" : "text-red-500"}`}>{sp.ngs}</span></span>
        <span>見込み <span className={`font-bold ${isTop ? "text-white" : "text-purple-600"}`}>{sp.prospects}</span></span>
      </div>

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

// ── アポインターカード ──────────────────────────────────
function AppointerCard({ ap, idx }: { ap: { appointer: string; apo: number; contracts: number; rate: number }; idx: number }) {
  const color = PALETTE[idx % PALETTE.length];
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white shrink-0"
        style={{ backgroundColor: color }}>
        {ap.appointer.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 text-sm mb-1">{ap.appointer}</p>
        <div className="flex gap-3 text-xs text-gray-500">
          <span>アポ <span className="font-bold text-gray-700">{ap.apo}</span></span>
          <span>契約 <span className="font-bold text-indigo-600">{ap.contracts}</span></span>
          <span className={`font-bold px-1.5 py-0.5 rounded-full ${ap.rate >= 20 ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
            {ap.rate}%
          </span>
        </div>
        <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(ap.rate, 100)}%`, backgroundColor: color }} />
        </div>
      </div>
    </div>
  );
}

// ── メインコンポーネント ────────────────────────────────
export default function DashboardPage() {
  const [data, setData]         = useState<SheetsData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [period, setPeriod]     = useState<Period>("thisMonth");
  const [spinning, setSpinning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback((p: Period, silent = false) => {
    if (!silent) setLoading(true);
    else setSpinning(true);
    setError(null);
    fetch(`/api/sheets?period=${p}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError("データの取得に失敗しました"))
      .finally(() => { setLoading(false); setSpinning(false); });
  }, []);

  useEffect(() => {
    fetchData(period, false);
  }, [period, fetchData]);

  // 5分ごとの自動更新
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const schedule = () => {
      timerRef.current = setTimeout(() => {
        fetchData(period, true);
        schedule();
      }, AUTO_REFRESH_MS);
    };
    schedule();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [period, fetchData]);

  const lastUpdated = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
    : null;

  const periodTabs = (
    <div className="flex items-center gap-2">
      {lastUpdated && (
        <span className="text-xs text-gray-400 flex items-center gap-1 mr-2">
          <Clock size={11} /> {lastUpdated} 更新
        </span>
      )}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
        {(["thisMonth", "lastMonth", "all"] as Period[]).map(p => (
          <button key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              period === p
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}>
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>
      <button onClick={() => fetchData(period, true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors ${spinning ? "opacity-50 pointer-events-none" : ""}`}>
        <RefreshCw size={13} className={spinning ? "animate-spin" : ""} /> 更新
      </button>
    </div>
  );

  if (loading) {
    return (
      <AppLayout title="ダッシュボード" actions={periodTabs}>
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
      <AppLayout title="ダッシュボード" actions={periodTabs}>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center max-w-lg mx-auto mt-10">
          <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-red-700 mb-2">{error}</p>
          <button onClick={() => fetchData(period)} className="px-4 py-2 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700">再試行</button>
        </div>
      </AppLayout>
    );
  }

  if (!data) return null;
  const { cumulative, salesPersonStats, allMonthly, bySource, byAppointer, byStatus } = data;

  const sortedSP = [...salesPersonStats].sort((a, b) => b.contracts - a.contracts);

  const allMonths = [...new Set([
    ...allMonthly.map(m => m.month),
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

  const periodLabel = PERIOD_LABELS[period];

  return (
    <AppLayout title="ダッシュボード" actions={periodTabs}>
      <div className="space-y-6">

        {/* ── 全体KPI ── */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            {periodLabel}の実績
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label={`${periodLabel} アポ数`} value={`${cumulative.totalApo}件`}
              icon={Users} iconBg="bg-indigo-50" iconColor="text-indigo-600" sub="スプレッドシート連携" />
            <KPICard label={`${periodLabel} 契約数`} value={`${cumulative.totalContracts}件`}
              icon={TrendingUp} iconBg="bg-emerald-50" iconColor="text-emerald-600" sub="スプレッドシート連携" />
            <KPICard label="後追い中" value={`${cumulative.followUps}件`}
              icon={AlertCircle} iconBg="bg-orange-50" iconColor="text-orange-500" sub="要フォローアップ" />
            <KPICard label="契約率" value={`${cumulative.contractRate}%`}
              icon={Percent} iconBg="bg-purple-50" iconColor="text-purple-600"
              sub={`見込(高)${cumulative.prospectHigh} 中${cumulative.prospectMid} 低${cumulative.prospectLow}`} />
          </div>
        </div>

        {/* ── 営業マン別カード ── */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            営業マン別 実績（{periodLabel}）
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sortedSP.map((sp, i) => (
              <SalesPersonCard key={sp.name} sp={sp} rank={i} />
            ))}
          </div>
        </div>

        {/* ── アポインター別カード ── */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            アポインター別 実績（{periodLabel}）
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {byAppointer.map((ap, i) => (
              <AppointerCard key={ap.appointer} ap={ap} idx={i} />
            ))}
          </div>
        </div>

        {/* ── 営業マン別 月別推移（全期間固定） ── */}
        <ChartCard title="営業マン別 月別契約数の推移（全期間）">
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
          <ChartCard title="月別 アポ数・契約数の推移（全期間）" className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={allMonthly}>
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

        {/* ── 流入経路別 ── */}
        <ChartCard title={`流入経路別 アポ数・契約数（${periodLabel}）`}>
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
    </AppLayout>
  );
}
