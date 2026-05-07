"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";

interface TargetData { year: number; month: number; target_count: number; }
interface SalesTarget {
  id: number; sales_person: string; year: number; month: number;
  target_contracts: number; target_amount: number;
}

export default function TargetsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  // 全体目標
  const [targetCount, setTargetCount] = useState(0);
  const [allTargets, setAllTargets] = useState<TargetData[]>([]);
  const [savedGlobal, setSavedGlobal] = useState(false);

  // 個人目標
  const [salesTargets, setSalesTargets] = useState<SalesTarget[]>([]);
  const [spForm, setSpForm] = useState({ salesPerson: "", targetContracts: 0, targetAmount: 0 });
  const [savedSp, setSavedSp] = useState(false);

  const yearOptions = Array.from({ length: 4 }, (_, i) => now.getFullYear() - 1 + i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  function fetchGlobal() {
    fetch("/api/targets").then((r) => r.json()).then(setAllTargets);
    fetch(`/api/targets?year=${year}&month=${month}`)
      .then((r) => r.json()).then((d) => setTargetCount(d.targetCount ?? 0));
  }

  function fetchSalesTargets() {
    fetch(`/api/sales-targets?year=${year}&month=${month}`)
      .then((r) => r.json()).then(setSalesTargets);
  }

  useEffect(() => { fetchGlobal(); fetchSalesTargets(); }, [year, month]);

  async function handleSaveGlobal(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month, targetCount }),
    });
    setSavedGlobal(true);
    fetchGlobal();
    setTimeout(() => setSavedGlobal(false), 2000);
  }

  async function handleSaveSp(e: React.FormEvent) {
    e.preventDefault();
    if (!spForm.salesPerson.trim()) return;
    await fetch("/api/sales-targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...spForm, year, month }),
    });
    setSpForm({ salesPerson: "", targetContracts: 0, targetAmount: 0 });
    setSavedSp(true);
    fetchSalesTargets();
    setTimeout(() => setSavedSp(false), 2000);
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">目標設定</h2>

        {/* 年月選択 */}
        <div className="flex gap-3 mb-6">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            {yearOptions.map((y) => <option key={y}>{y}</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            {monthOptions.map((m) => <option key={m} value={m}>{m}月</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 全体目標 */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">全体目標（{year}年{month}月）</h3>
            <form onSubmit={handleSaveGlobal} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">月次契約目標件数</label>
                <input type="number" min={0} value={targetCount}
                  onChange={(e) => setTargetCount(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#26C6DA]" />
              </div>
              <button type="submit"
                className="w-full bg-[#26C6DA] hover:bg-[#00ACC1] text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">
                {savedGlobal ? "保存しました ✓" : "保存する"}
              </button>
            </form>
          </div>

          {/* 個人目標 */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">個人目標追加（{year}年{month}月）</h3>
            <form onSubmit={handleSaveSp} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">営業担当者名</label>
                <input value={spForm.salesPerson} placeholder="例：隅田"
                  onChange={(e) => setSpForm({ ...spForm, salesPerson: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26C6DA]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">目標契約数</label>
                  <input type="number" min={0} value={spForm.targetContracts}
                    onChange={(e) => setSpForm({ ...spForm, targetContracts: Number(e.target.value) })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26C6DA]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">目標売上（円）</label>
                  <input type="number" min={0} value={spForm.targetAmount}
                    onChange={(e) => setSpForm({ ...spForm, targetAmount: Number(e.target.value) })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#26C6DA]" />
                </div>
              </div>
              <button type="submit"
                className="w-full bg-[#0D1B2A] hover:bg-[#1a2d42] text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">
                {savedSp ? "保存しました ✓" : "個人目標を保存"}
              </button>
            </form>
          </div>
        </div>

        {/* 個人目標一覧 */}
        {salesTargets.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">{year}年{month}月 個人目標一覧</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">氏名</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">目標契約数</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">目標売上</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {salesTargets.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium">{t.sales_person}</td>
                    <td className="px-5 py-3 text-right text-[#26C6DA] font-semibold">{t.target_contracts} 件</td>
                    <td className="px-5 py-3 text-right font-semibold">¥{Number(t.target_amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 全体目標履歴 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">全体目標 履歴</h3>
          </div>
          {allTargets.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">まだ目標が設定されていません</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">年</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">月</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">目標件数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {allTargets.map((t) => (
                  <tr key={`${t.year}-${t.month}`} className="hover:bg-gray-50">
                    <td className="px-5 py-3">{t.year}</td>
                    <td className="px-5 py-3">{t.month}月</td>
                    <td className="px-5 py-3 text-right font-semibold text-[#26C6DA]">{t.target_count} 件</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
