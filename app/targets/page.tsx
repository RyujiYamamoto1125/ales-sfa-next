"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";

interface TargetData {
  year: number;
  month: number;
  targetCount: number;
}

export default function TargetsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [targetCount, setTargetCount] = useState(0);
  const [allTargets, setAllTargets] = useState<TargetData[]>([]);
  const [saved, setSaved] = useState(false);

  function fetchTargets() {
    fetch("/api/targets").then((r) => r.json()).then(setAllTargets);
  }

  useEffect(() => { fetchTargets(); }, []);

  useEffect(() => {
    fetch(`/api/targets?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((d) => setTargetCount(d.targetCount ?? 0));
  }, [year, month]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month, targetCount }),
    });
    setSaved(true);
    fetchTargets();
    setTimeout(() => setSaved(false), 2000);
  }

  const yearOptions = Array.from({ length: 4 }, (_, i) => now.getFullYear() - 1 + i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">目標設定</h2>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 max-w-md mb-8">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">年</label>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#26C6DA]"
                >
                  {yearOptions.map((y) => <option key={y}>{y}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">月</label>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#26C6DA]"
                >
                  {monthOptions.map((m) => <option key={m}>{m}月</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {year}年{month}月の契約目標件数
              </label>
              <input
                type="number"
                min={0}
                value={targetCount}
                onChange={(e) => setTargetCount(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#26C6DA]"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#26C6DA] hover:bg-[#00ACC1] text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
            >
              {saved ? "保存しました ✓" : "保存する"}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden max-w-md">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">設定済みの目標一覧</h3>
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
                    <td className="px-5 py-3 text-gray-800">{t.year}</td>
                    <td className="px-5 py-3 text-gray-800">{t.month}月</td>
                    <td className="px-5 py-3 text-right font-semibold text-[#26C6DA]">{t.targetCount} 件</td>
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
