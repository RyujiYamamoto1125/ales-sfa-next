"use client";

import { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, PieChart, Pie, Cell, CartesianGrid,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  "未実行": "#90A4AE", "見込み（高）": "#42A5F5", "見込み（中）": "#66BB6A",
  "見込み（低）": "#FFA726", "申し込みフォーム返送待ち": "#AB47BC",
  "NG": "#EF5350", "契約": "#26C6DA",
};

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
}

function KPICard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color ?? "text-gray-800"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

const TABS = ["概要", "営業マン別", "ファネル分析", "広告分析"] as const;
type Tab = typeof TABS[number];

export default function DashboardPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState<Tab>("概要");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`/api/dashboard?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, [year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !data) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-gray-400">読み込み中...</p>
        </main>
      </div>
    );
  }

  const { kpis, statusCounts, monthlyTrend, salesPersonStats, funnelData, leadsByMedium, apoByMedium } = data;
  const statusPieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {/* ヘッダー */}
        <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-xl font-bold text-gray-800">ダッシュボード</h2>
          <div className="flex items-center gap-3">
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}月</option>
              ))}
            </select>
          </div>
        </div>

        {/* タブ */}
        <div className="px-8 pt-5">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === t ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="px-8 pb-10">

          {/* ===== 概要タブ ===== */}
          {tab === "概要" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard label="今月のアポ数" value={`${kpis.thisMonthApo} 件`} />
                <KPICard label="今月の契約数" value={`${kpis.thisMonthContracts} 件`}
                  sub={kpis.globalTarget > 0 ? `目標 ${kpis.globalTarget} 件` : undefined} />
                <KPICard label="今月の売上" value={`¥${kpis.thisMonthAmount.toLocaleString()}`} color="text-[#26C6DA]" />
                <KPICard label="今月の契約率"
                  value={`${kpis.contractRate}%`}
                  sub={kpis.apoRate != null ? `アポ率 ${kpis.apoRate}%` : undefined} />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard label="累計案件数" value={`${kpis.totalCases} 件`} />
                <KPICard label="累計契約数" value={`${kpis.totalContracts} 件`} />
                <KPICard label="累計売上" value={`¥${kpis.totalAmount.toLocaleString()}`} />
                <KPICard label="今月リード数" value={kpis.totalLeads > 0 ? `${kpis.totalLeads} 件` : "未入力"} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">ステータス別件数（全期間）</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={statusPieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                        {statusPieData.map((entry, i) => (
                          <Cell key={i} fill={STATUS_COLORS[entry.name] ?? "#ccc"} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">月別 契約数・アポ数の推移</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="apo" name="アポ数" stroke="#90A4AE" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="contracts" name="契約数" stroke="#26C6DA" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">月別売上推移</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`} />
                    <Tooltip formatter={(v) => `¥${Number(v).toLocaleString()}`} />
                    <Bar dataKey="amount" name="売上" fill="#26C6DA" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ===== 営業マン別タブ ===== */}
          {tab === "営業マン別" && (
            <div className="space-y-6">
              {salesPersonStats.length === 0 ? (
                <p className="text-gray-400 text-center py-20">営業担当者が設定された案件がありません</p>
              ) : (
                <>
                  {/* ランキングテーブル */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-700">{year}年{month}月　営業マン別実績</h3>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {["順位", "氏名", "アポ数", "契約数", "契約率", "売上", "契約達成率", "売上達成率"].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {salesPersonStats.map((sp, i) => (
                          <tr key={sp.name} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <span className={`font-bold ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-600" : "text-gray-400"}`}>
                                {i + 1}位
                              </span>
                            </td>
                            <td className="px-4 py-3 font-semibold text-gray-800">{sp.name}</td>
                            <td className="px-4 py-3 text-gray-600">{sp.apo}</td>
                            <td className="px-4 py-3 font-semibold text-[#26C6DA]">{sp.contracts}</td>
                            <td className="px-4 py-3">{sp.contractRate}%</td>
                            <td className="px-4 py-3 font-semibold">¥{sp.amount.toLocaleString()}</td>
                            <td className="px-4 py-3">
                              {sp.contractAchievement != null ? (
                                <span className={sp.contractAchievement >= 100 ? "text-green-600 font-bold" : "text-red-500"}>
                                  {sp.contractAchievement}%
                                </span>
                              ) : <span className="text-gray-300">目標未設定</span>}
                            </td>
                            <td className="px-4 py-3">
                              {sp.amountAchievement != null ? (
                                <span className={sp.amountAchievement >= 100 ? "text-green-600 font-bold" : "text-red-500"}>
                                  {sp.amountAchievement}%
                                </span>
                              ) : <span className="text-gray-300">目標未設定</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 棒グラフ比較 */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-700 mb-4">契約数ランキング</h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={salesPersonStats} layout="vertical">
                          <XAxis type="number" tick={{ fontSize: 10 }} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={50} />
                          <Tooltip />
                          <Bar dataKey="contracts" name="契約数" fill="#26C6DA" radius={[0, 4, 4, 0]} />
                          {salesPersonStats.some((s) => s.targetContracts > 0) && (
                            <Bar dataKey="targetContracts" name="目標" fill="#E0F7FA" radius={[0, 4, 4, 0]} />
                          )}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-700 mb-4">売上ランキング</h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={salesPersonStats} layout="vertical">
                          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={50} />
                          <Tooltip formatter={(v) => `¥${Number(v).toLocaleString()}`} />
                          <Bar dataKey="amount" name="売上" fill="#66BB6A" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* 契約率グラフ */}
                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">契約率・アポ数比較</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={salesPersonStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="apo" name="アポ数" fill="#90A4AE" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="right" dataKey="contractRate" name="契約率(%)" fill="#FFA726" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ===== ファネル分析タブ ===== */}
          {tab === "ファネル分析" && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-6">商談ファネル（全期間）</h3>
                <div className="space-y-3">
                  {funnelData.filter((f) => f.count > 0 || f.status === "未実行").map((f, i) => {
                    const max = Math.max(...funnelData.map((x) => x.count), 1);
                    const pct = Math.round((f.count / max) * 100);
                    return (
                      <div key={f.status} className="flex items-center gap-4">
                        <div className="w-36 text-right">
                          <span className="text-sm font-medium text-gray-700">{f.status}</span>
                        </div>
                        <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                          <div
                            className="h-full rounded-full flex items-center pl-3 transition-all"
                            style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: Object.values(STATUS_COLORS)[i] ?? "#26C6DA" }}
                          >
                            <span className="text-xs font-bold text-white">{f.count}件</span>
                          </div>
                        </div>
                        <div className="w-24 text-sm text-gray-500">
                          平均 <span className="font-semibold text-gray-700">{f.avgDays}</span> 日
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">ステージ別件数</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={funnelData.filter((f) => f.count > 0)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="status" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="件数" radius={[4, 4, 0, 0]}>
                        {funnelData.filter((f) => f.count > 0).map((entry, i) => (
                          <Cell key={i} fill={STATUS_COLORS[entry.status] ?? "#ccc"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">ステージ別 平均滞留日数</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={funnelData.filter((f) => f.count > 0)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="status" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 10 }} unit="日" />
                      <Tooltip formatter={(v) => `${v}日`} />
                      <Bar dataKey="avgDays" name="平均滞留日数" fill="#AB47BC" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 通過率テーブル */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700">ステージ別詳細</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">ステータス</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">件数</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">割合</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">平均滞留日数</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {funnelData.map((f) => {
                      const total = funnelData.reduce((s, x) => s + x.count, 0);
                      const pct = total > 0 ? Math.round((f.count / total) * 100) : 0;
                      return (
                        <tr key={f.status} className="hover:bg-gray-50">
                          <td className="px-5 py-3">
                            <span className="inline-block w-3 h-3 rounded-full mr-2"
                              style={{ backgroundColor: STATUS_COLORS[f.status] ?? "#ccc" }} />
                            {f.status}
                          </td>
                          <td className="px-5 py-3 text-right font-semibold">{f.count} 件</td>
                          <td className="px-5 py-3 text-right text-gray-500">{pct}%</td>
                          <td className="px-5 py-3 text-right text-gray-500">{f.avgDays} 日</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== 広告分析タブ ===== */}
          {tab === "広告分析" && (
            <div className="space-y-6">
              <LeadInputSection year={year} month={month} onSaved={fetchData} />

              {leadsByMedium.length === 0 ? (
                <p className="text-gray-400 text-center py-10">リードデータがありません。上のフォームから入力してください。</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {leadsByMedium.map((l) => (
                      <KPICard key={l.medium} label={`${l.medium} リード数`} value={`${l.count} 件`} />
                    ))}
                    <KPICard label="合計リード数" value={`${leadsByMedium.reduce((s, l) => s + l.count, 0)} 件`} color="text-[#26C6DA]" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-700 mb-4">媒体別リード数</h3>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={leadsByMedium}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="medium" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Bar dataKey="count" name="リード数" fill="#42A5F5" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-700 mb-4">媒体別シェア</h3>
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie data={leadsByMedium} dataKey="count" nameKey="medium" innerRadius={50} outerRadius={90}>
                            {leadsByMedium.map((_, i) => (
                              <Cell key={i} fill={["#42A5F5", "#66BB6A", "#FFA726", "#AB47BC", "#EF5350", "#26C6DA"][i % 6]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-700">媒体別アポ率（今月全アポ数を各媒体リード数で割った参考値）</h3>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">媒体</th>
                          <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">リード数</th>
                          <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">アポ率</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {apoByMedium.map((a) => (
                          <tr key={a.medium} className="hover:bg-gray-50">
                            <td className="px-5 py-3 font-medium">{a.medium}</td>
                            <td className="px-5 py-3 text-right">{a.leads} 件</td>
                            <td className="px-5 py-3 text-right font-semibold text-[#26C6DA]">{a.apoRate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ── リード入力コンポーネント ──
const MEDIUMS = ["Google", "Meta", "TikTok", "LINE", "その他"];

function LeadInputSection({ year, month, onSaved }: { year: number; month: number; onSaved: () => void }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), medium: "Google", leadCount: 0 });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: form.date, medium: form.medium, leadCount: form.leadCount }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSaved();
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">リード数入力（{year}年{month}月）</h3>
      <form onSubmit={handleSave} className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">日付</label>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">媒体</label>
          <select value={form.medium} onChange={(e) => setForm({ ...form, medium: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            {MEDIUMS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">リード数</label>
          <input type="number" min={0} value={form.leadCount}
            onChange={(e) => setForm({ ...form, leadCount: Number(e.target.value) })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-24" />
        </div>
        <button type="submit" disabled={saving}
          className="px-5 py-2 bg-[#26C6DA] text-white rounded-lg text-sm font-medium hover:bg-[#00ACC1] disabled:opacity-50 transition-colors">
          {saved ? "保存済み ✓" : saving ? "保存中..." : "保存"}
        </button>
      </form>
    </div>
  );
}
