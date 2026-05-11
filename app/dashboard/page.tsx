"use client";

import { useEffect, useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, CartesianGrid, AreaChart, Area,
} from "recharts";
import {
  TrendingUp, Users, Percent, AlertCircle, TableProperties, RefreshCw,
} from "lucide-react";

// ── 定数 ──────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  "見込み（高）": "#6366F1", "見込み（中）": "#22C55E", "見込み（低）": "#F59E0B",
  "後追い": "#F97316", "NG": "#EF4444", "契約": "#06B6D4",
  "不参加": "#64748B", "契約書返送待ち": "#8B5CF6", "未設定": "#94A3B8",
};
const PALETTE = ["#6366F1","#22C55E","#F59E0B","#EF4444","#A855F7","#06B6D4","#F97316","#64748B"];

// ── 型 ────────────────────────────────────────────────
interface SheetsData {
  cumulative: {
    totalApo: number; totalContracts: number; followUps: number; ngs: number;
    contractRate: number; prospectHigh: number; prospectMid: number; prospectLow: number;
  };
  monthly:       { month: string; apo: number; contracts: number }[];
  bySource:      { source: string; apo: number; contracts: number; rate: number }[];
  byAppointer:   { appointer: string; apo: number; contracts: number; rate: number }[];
  bySalesPerson: { name: string; apo: number; contracts: number; rate: number }[];
  byStatus:      { status: string; count: number }[];
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

  const refreshButton = (
    <button onClick={fetchData}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
      <RefreshCw size={13} /> 更新
    </button>
  );

  if (loading) {
    return (
      <AppLayout title="ダッシュボード" actions={refreshButton}>
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
      <AppLayout title="ダッシュボード" actions={refreshButton}>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center max-w-lg mx-auto mt-10">
          <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-red-700 mb-1">エラー</p>
          <p className="text-xs text-red-600 mb-4">{error}</p>
          <button onClick={fetchData}
            className="px-4 py-2 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition-colors">
            再試行
          </button>
        </div>
      </AppLayout>
    );
  }

  if (!data) return null;
  const { cumulative, monthly, bySource, byAppointer, bySalesPerson, byStatus } = data;

  return (
    <AppLayout title="ダッシュボード" actions={refreshButton}>
      <div className="space-y-6">

        {/* ── KPI 累計カード ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard label="累計アポ数" value={`${cumulative.totalApo}件`}
            icon={Users} iconBg="bg-indigo-50" iconColor="text-indigo-600"
            sub="全期間合計" />
          <KPICard label="累計契約数" value={`${cumulative.totalContracts}件`}
            icon={TrendingUp} iconBg="bg-emerald-50" iconColor="text-emerald-600"
            sub="全期間合計" />
          <KPICard label="後追い中" value={`${cumulative.followUps}件`}
            icon={AlertCircle} iconBg="bg-orange-50" iconColor="text-orange-500"
            sub="要フォローアップ" />
          <KPICard label="全期間契約率" value={`${cumulative.contractRate}%`}
            icon={Percent} iconBg="bg-purple-50" iconColor="text-purple-600"
            sub={`見込(高)${cumulative.prospectHigh} 中${cumulative.prospectMid} 低${cumulative.prospectLow}`} />
        </div>

        {/* ── 月別推移 + 商談結果 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <ChartCard title="月別 アポ数・契約数の推移" className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthly}>
                <defs>
                  <linearGradient id="gApo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gContract" x1="0" y1="0" x2="0" y2="1">
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
                <Area type="monotone" dataKey="contracts" name="契約数" stroke="#06B6D4" strokeWidth={2} fill="url(#gContract)" dot={{r:4,fill:"#06B6D4"}} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="商談結果の内訳">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={byStatus} dataKey="count" nameKey="status" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {byStatus.map((e, i) => <Cell key={i} fill={STATUS_COLORS[e.status] ?? PALETTE[i % 8]} />)}
                </Pie>
                <Tooltip contentStyle={{borderRadius:"12px",border:"none",boxShadow:"0 4px 20px rgba(0,0,0,0.1)"}} />
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

        {/* ── 流入経路別 + アポ獲得者別 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ChartCard title="流入経路別 アポ数・契約数">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={bySource} layout="vertical" barSize={14} barCategoryGap="30%">
                <XAxis type="number" tick={{fontSize:10,fill:"#94A3B8"}} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="source" tick={{fontSize:9,fill:"#64748B"}} axisLine={false} tickLine={false} width={130} />
                <Tooltip contentStyle={{borderRadius:"12px",border:"none",boxShadow:"0 4px 20px rgba(0,0,0,0.1)"}} />
                <Legend />
                <Bar dataKey="apo" name="アポ" fill="#6366F1" radius={[0,4,4,0]} />
                <Bar dataKey="contracts" name="契約" fill="#06B6D4" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="アポ獲得者別 実績">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 rounded-xl">
                    {["獲得者","アポ","契約","契約率"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byAppointer.map((a, i) => (
                    <tr key={a.appointer} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                            style={{backgroundColor: PALETTE[i % 8]}}>
                            {a.appointer.charAt(0)}
                          </div>
                          <span className="font-medium text-gray-700 text-xs">{a.appointer}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">{a.apo}</td>
                      <td className="px-4 py-3 font-bold text-indigo-600 text-sm">{a.contracts}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${a.rate >= 20 ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                          {a.rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </div>

        {/* ── 商談担当者別 ── */}
        <ChartCard title="商談担当者別 実績（全期間）">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {["担当者","アポ数","契約数","契約率"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bySalesPerson.map((sp, i) => (
                    <tr key={sp.name} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                            <span className="text-indigo-700 font-bold text-xs">{sp.name.charAt(0)}</span>
                          </div>
                          <span className="font-semibold text-gray-800">{sp.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{sp.apo}</td>
                      <td className="px-4 py-3 font-bold text-indigo-600">{sp.contracts}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sp.rate >= 15 ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                          {sp.rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={bySalesPerson} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" tick={{fontSize:11,fill:"#94A3B8"}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize:10,fill:"#94A3B8"}} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{borderRadius:"12px",border:"none",boxShadow:"0 4px 20px rgba(0,0,0,0.1)"}} />
                <Legend />
                <Bar dataKey="apo" name="アポ" fill="#6366F1" radius={[6,6,0,0]} />
                <Bar dataKey="contracts" name="契約" fill="#06B6D4" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

      </div>
    </AppLayout>
  );
}
