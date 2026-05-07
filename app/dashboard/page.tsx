"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  "未実行": "#90A4AE",
  "見込み（高）": "#42A5F5",
  "見込み（中）": "#66BB6A",
  "見込み（低）": "#FFA726",
  "申し込みフォーム返送待ち": "#AB47BC",
  "NG": "#EF5350",
  "契約": "#26C6DA",
};

interface CaseData {
  _id: string;
  customerName: string;
  status: string;
  nextMeeting?: string;
  salesPerson?: string;
  appointer?: string;
  contractedAt?: string;
  createdAt: string;
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [cases, setCases] = useState<CaseData[]>([]);
  const [target, setTarget] = useState(0);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  useEffect(() => {
    Promise.all([
      fetch("/api/cases").then((r) => r.json()),
      fetch(`/api/targets?year=${year}&month=${month}`).then((r) => r.json()),
    ]).then(([casesData, targetData]) => {
      setCases(casesData);
      setTarget(targetData.targetCount ?? 0);
      setLoading(false);
    });
  }, [year, month]);

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-gray-400">読み込み中...</p>
        </main>
      </div>
    );
  }

  const contracted = cases.filter((c) => c.status === "契約");
  const totalContracts = contracted.length;
  const thisMonthContracts = contracted.filter((c) => {
    if (!c.contractedAt) return false;
    const d = new Date(c.contractedAt);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  }).length;
  const diff = thisMonthContracts - target;

  const thisMonthCases = cases.filter((c) => {
    const d = new Date(c.createdAt);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  const unexecutedCount = cases.filter((c) => c.status === "未実行").length;
  const unexecutedRate = cases.length > 0 ? ((unexecutedCount / cases.length) * 100).toFixed(1) : "0.0";

  const overdue = cases.filter((c) => {
    if (c.status !== "未実行" || !c.nextMeeting) return false;
    return new Date(c.nextMeeting) < now;
  });

  // ステータス別集計
  const statusCounts = Object.entries(
    cases.reduce<Record<string, number>>((acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  // 月別契約数
  const monthlyMap: Record<string, number> = {};
  contracted.forEach((c) => {
    if (!c.contractedAt) return;
    const d = new Date(c.contractedAt);
    const key = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyMap[key] = (monthlyMap[key] ?? 0) + 1;
  });
  const monthlyData = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));

  // アポインター別集計
  const appointerMap: Record<string, { total: number; contracts: number; executed: number }> = {};
  cases.forEach((c) => {
    const ap = c.appointer?.trim();
    if (!ap) return;
    if (!appointerMap[ap]) appointerMap[ap] = { total: 0, contracts: 0, executed: 0 };
    appointerMap[ap].total++;
    if (c.status === "契約") appointerMap[ap].contracts++;
    if (c.status !== "未実行") appointerMap[ap].executed++;
  });
  const appointerData = Object.entries(appointerMap).map(([name, d]) => ({
    name,
    契約率: d.total > 0 ? Math.round((d.contracts / d.total) * 100) : 0,
    実行率: d.total > 0 ? Math.round((d.executed / d.total) * 100) : 0,
  }));

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">ダッシュボード</h2>

        {overdue.length > 0 && (
          <div className="bg-amber-50 border-l-4 border-amber-400 rounded-lg p-4 mb-6">
            <p className="text-amber-800 font-medium text-sm">
              ⚠️ 次回商談日が過ぎている未実行案件が {overdue.length}件 あります
            </p>
            <ul className="mt-2 space-y-1">
              {overdue.map((c) => (
                <li key={c._id} className="text-xs text-amber-700">
                  {c.customerName} — {new Date(c.nextMeeting!).toLocaleDateString("ja-JP")}
                  {c.salesPerson && ` / 営業: ${c.salesPerson}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 契約実績 */}
        <section className="mb-8">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">契約実績</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="累計契約者数" value={`${totalContracts} 件`} />
            <MetricCard label="今月の契約者数" value={`${thisMonthContracts} 件`} />
            <MetricCard label="今月の目標" value={`${target} 件`} />
            <MetricCard
              label="目標との差分"
              value={`${diff >= 0 ? "+" : ""}${diff} 件`}
              sub={diff >= 0 ? "目標達成" : "未達"}
            />
          </div>
        </section>

        {/* アポ・実行率 */}
        <section className="mb-8">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">アポ・実行率（今月）</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard label="今月の登録件数" value={`${thisMonthCases.length} 件`} />
            <MetricCard label="未実行率（全体）" value={`${unexecutedRate}%`} />
            <MetricCard label="全案件数" value={`${cases.length} 件`} />
          </div>
        </section>

        {/* グラフ */}
        {cases.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">ステータス別件数</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={statusCounts} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                    {statusCounts.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.name] ?? "#ccc"} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">月別契約数の推移</h3>
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={monthlyData}>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="契約数" fill="#26C6DA" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-400 text-sm text-center mt-16">契約データがまだありません</p>
              )}
            </div>
          </div>
        )}

        {/* アポインター別分析 */}
        {appointerData.length > 0 && (
          <section className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">アポインター別 契約率・実行率</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={appointerData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend />
                <Bar dataKey="契約率" fill="#26C6DA" radius={[4, 4, 0, 0]} />
                <Bar dataKey="実行率" fill="#66BB6A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}

        {cases.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p>案件データがありません。「案件管理」から登録してください。</p>
          </div>
        )}
      </main>
    </div>
  );
}
