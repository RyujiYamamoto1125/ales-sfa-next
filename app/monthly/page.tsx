"use client";

import { useCallback, useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from "recharts";
import {
  Users, Phone, MessageSquare, TrendingUp, Megaphone, RefreshCw, Clock,
} from "lucide-react";

interface MonthlySummary {
  month: string;
  leads: number;
  apo: number;
  meetings: number;
  contracts: number;
  adSpend: number;
}

const fmtYen = (n: number) => {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}億円`;
  if (n >= 10_000) { const m = n / 10_000; return `${Number.isInteger(m) ? m : m.toFixed(1)}万円`; }
  return `${n.toLocaleString()}円`;
};

function rate(a: number, b: number) {
  return b > 0 ? Math.round((a / b) * 100) : 0;
}

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

function RateBadge({ value, thresholds }: { value: number; thresholds: [number, number] }) {
  const cls = value >= thresholds[0]
    ? "bg-emerald-50 text-emerald-700"
    : value >= thresholds[1]
    ? "bg-amber-50 text-amber-700"
    : "bg-gray-50 text-gray-500";
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>
      {value > 0 ? `${value}%` : "—"}
    </span>
  );
}

export default function MonthlyPage() {
  const [rows, setRows]           = useState<MonthlySummary[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const fetchData = useCallback((silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    setError(null);
    fetch("/api/monthly-summary")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        // 新レスポンス形式 { monthly: [...], totalLeadsAllChannels: N } に対応
        setRows(Array.isArray(d) ? d : (d.monthly ?? []));
        setUpdatedAt(new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }));
      })
      .catch(() => setError("データの取得に失敗しました"))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { fetchData(false); }, [fetchData]);

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonth = rows.find((r) => r.month === currentMonthKey);
  const chartData = [...rows].reverse().slice(-12);

  const headerActions = (
    <div className="flex items-center gap-2">
      {updatedAt && (
        <span className="text-xs text-gray-400 flex items-center gap-1 mr-1">
          <Clock size={11} /> {updatedAt} 更新
        </span>
      )}
      <button
        onClick={() => fetchData(true)}
        disabled={refreshing}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors ${refreshing ? "opacity-50 pointer-events-none" : ""}`}
      >
        <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
        更新
      </button>
    </div>
  );

  if (loading) return (
    <AppLayout title="月次数値確認" actions={headerActions}>
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    </AppLayout>
  );

  if (error) return (
    <AppLayout title="月次数値確認" actions={headerActions}>
      <p className="text-red-500 text-sm p-8">{error}</p>
    </AppLayout>
  );

  return (
    <AppLayout title="月次数値確認" actions={headerActions}>
      <div className="space-y-6">

        {/* 当月サマリ */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            当月実績（{currentMonthKey}）
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <KPICard label="獲得リード数" value={`${currentMonth?.leads ?? 0}件`}
              icon={Users} iconBg="bg-indigo-50" iconColor="text-indigo-600"
              sub="当月リード獲得数" />
            <KPICard label="アポ取得数" value={`${currentMonth?.apo ?? 0}件`}
              icon={Phone} iconBg="bg-cyan-50" iconColor="text-cyan-600"
              sub="当月スケジュール済み" />
            <KPICard label="商談実行数" value={`${currentMonth?.meetings ?? 0}件`}
              icon={MessageSquare} iconBg="bg-violet-50" iconColor="text-violet-600"
              sub="初回商談日時で集計" />
            <KPICard label="契約数" value={`${currentMonth?.contracts ?? 0}件`}
              icon={TrendingUp} iconBg="bg-emerald-50" iconColor="text-emerald-600"
              sub="当月契約締結数" />
            <KPICard label="消化広告費" value={currentMonth?.adSpend ? fmtYen(currentMonth.adSpend) : "—"}
              icon={Megaphone} iconBg="bg-orange-50" iconColor="text-orange-500"
              sub="当月広告消化額" />
          </div>
        </div>

        {/* 月別推移グラフ */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-5">月別推移（直近12ヶ月）</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} barGap={2} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
              <Legend />
              <Bar dataKey="leads"     name="リード" fill="#6366F1" radius={[4,4,0,0]} />
              <Bar dataKey="apo"       name="アポ"   fill="#06B6D4" radius={[4,4,0,0]} />
              <Bar dataKey="meetings"  name="商談"   fill="#8B5CF6" radius={[4,4,0,0]} />
              <Bar dataKey="contracts" name="契約"   fill="#10B981" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 月別テーブル */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="font-semibold text-gray-800 text-sm">月別詳細一覧</p>
            <p className="text-xs text-gray-400 mt-0.5">契約率 = 契約数 ÷ リード獲得数　／　転換率 = 契約数 ÷ アポ取得数</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[750px]">
              <thead className="bg-gray-50">
                <tr>
                  {["月", "リード獲得", "アポ取得", "商談実行", "契約数", "契約率", "転換率", "消化広告費"].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isCurrentMonth = row.month === currentMonthKey;
                  const contractRate = rate(row.contracts, row.leads);
                  const apoRate = rate(row.contracts, row.apo);
                  return (
                    <tr key={row.month}
                      className={`border-t border-gray-50 transition-colors ${isCurrentMonth ? "bg-indigo-50/40" : "hover:bg-gray-50/50"}`}>
                      <td className={`py-3 px-4 font-medium text-xs ${isCurrentMonth ? "text-indigo-600" : "text-gray-600"}`}>
                        {row.month}
                        {isCurrentMonth && (
                          <span className="ml-1.5 text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">今月</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-gray-700">{row.leads > 0 ? `${row.leads.toLocaleString()}件` : "—"}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-cyan-600">{row.apo > 0 ? `${row.apo}件` : "—"}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-violet-600">{row.meetings > 0 ? `${row.meetings}件` : "—"}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-emerald-600">{row.contracts > 0 ? `${row.contracts}件` : "—"}</span>
                      </td>
                      <td className="py-3 px-4">
                        <RateBadge value={contractRate} thresholds={[10, 5]} />
                      </td>
                      <td className="py-3 px-4">
                        <RateBadge value={apoRate} thresholds={[30, 15]} />
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-gray-600">
                        {row.adSpend > 0 ? fmtYen(row.adSpend) : "—"}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-gray-400">
                      データがありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
