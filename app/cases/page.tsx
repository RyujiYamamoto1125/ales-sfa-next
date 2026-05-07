"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";

const STATUS_OPTIONS = [
  "未実行", "見込み（高）", "見込み（中）", "見込み（低）",
  "申し込みフォーム返送待ち", "NG", "契約",
];

const STATUS_COLORS: Record<string, string> = {
  "未実行": "bg-slate-100 text-slate-600",
  "見込み（高）": "bg-blue-100 text-blue-700",
  "見込み（中）": "bg-green-100 text-green-700",
  "見込み（低）": "bg-orange-100 text-orange-700",
  "申し込みフォーム返送待ち": "bg-purple-100 text-purple-700",
  "NG": "bg-red-100 text-red-700",
  "契約": "bg-cyan-100 text-cyan-700",
};

interface CaseData {
  id: string;
  customer_name: string;
  status: string;
  next_meeting?: string;
  sales_person?: string;
  appointer?: string;
  notes?: string;
  contracted_at?: string;
  created_at: string;
}

const EMPTY_FORM = {
  customerName: "", status: "未実行", nextMeeting: "",
  salesPerson: "", appointer: "", notes: "", amount: 0,
};

export default function CasesPage() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "sales";
  const isAdmin = role === "admin";
  const isSales = role === "sales";
  const isAppointer = role === "appointer";

  const [cases, setCases] = useState<CaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("すべて");
  const [filterAppointer, setFilterAppointer] = useState("");
  const [filterSales, setFilterSales] = useState("");
  const [tab, setTab] = useState<"list" | "add">("list");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function fetchCases() {
    return fetch("/api/cases").then((r) => r.json()).then((data) => {
      setCases(data);
      setLoading(false);
    });
  }

  useEffect(() => { fetchCases(); }, []);

  const filtered = cases.filter((c) => {
    if (filterStatus !== "すべて" && c.status !== filterStatus) return false;
    if (filterAppointer && !c.appointer?.includes(filterAppointer)) return false;
    if (filterSales && !c.sales_person?.includes(filterSales)) return false;
    return true;
  });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm(EMPTY_FORM);
    await fetchCases();
    setSaving(false);
    setTab("list");
  }

  async function handleSave(id: string) {
    setSaving(true);
    await fetch(`/api/cases/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setEditId(null);
    await fetchCases();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("この案件を削除しますか？")) return;
    await fetch(`/api/cases/${id}`, { method: "DELETE" });
    fetchCases();
  }

  function startEdit(c: CaseData) {
    setEditId(c.id);
    setEditForm({
      customerName: c.customer_name,
      status: c.status,
      nextMeeting: c.next_meeting ? new Date(c.next_meeting).toISOString().slice(0, 16) : "",
      salesPerson: c.sales_person ?? "",
      appointer: c.appointer ?? "",
      notes: c.notes ?? "",
      amount: (c as { amount?: number }).amount ?? 0,
    });
  }

  function downloadCSV() {
    const header = ["顧客名", "ステータス", "次回商談日時", "営業担当者", "アポインター", "備考", "登録日時"];
    const rows = filtered.map((c) => [
      c.customer_name, c.status,
      c.next_meeting ? new Date(c.next_meeting).toLocaleString("ja-JP") : "",
      c.sales_person ?? "", c.appointer ?? "", c.notes ?? "",
      new Date(c.created_at).toLocaleString("ja-JP"),
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sfa_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">案件管理</h2>

        <div className="flex gap-2 mb-6">
          {(["list", "add"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t ? "bg-[#26C6DA] text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}>
              {t === "list" ? "案件一覧" : "新規登録"}
            </button>
          ))}
        </div>

        {tab === "list" && (
          <>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4 flex flex-wrap gap-3">
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="すべて">すべてのステータス</option>
                {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
              <input placeholder="アポインター名で絞り込み" value={filterAppointer}
                onChange={(e) => setFilterAppointer(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <input placeholder="営業担当者名で絞り込み" value={filterSales}
                onChange={(e) => setFilterSales(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <div className="flex-1" />
              <span className="text-sm text-gray-400 self-center">{filtered.length} 件</span>
              {(isAdmin || isSales) && (
                <button onClick={downloadCSV}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">
                  CSVダウンロード
                </button>
              )}
            </div>

            {loading ? (
              <p className="text-gray-400 text-center py-10">読み込み中...</p>
            ) : filtered.length === 0 ? (
              <p className="text-gray-400 text-center py-10">該当する案件がありません</p>
            ) : (
              <div className="space-y-3">
                {filtered.map((c) => (
                  <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50"
                      onClick={() => setEditId(editId === c.id ? null : c.id)}>
                      <div className="flex items-center gap-4">
                        <span className="font-semibold text-gray-800">{c.customer_name}</span>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {c.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        {c.sales_person && <span>営業: {c.sales_person}</span>}
                        {c.appointer && <span>アポ: {c.appointer}</span>}
                        <span className="text-gray-300">{editId === c.id ? "▲" : "▼"}</span>
                      </div>
                    </div>

                    {editId === c.id && (
                      <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">顧客名</label>
                            <input value={editForm.customerName}
                              onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                          </div>

                          {!isAppointer && (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">ステータス</label>
                              <select value={editForm.status}
                                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                                {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                              </select>
                            </div>
                          )}

                          {!isAppointer && (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">営業担当者名</label>
                              <input value={editForm.salesPerson}
                                onChange={(e) => setEditForm({ ...editForm, salesPerson: e.target.value })}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                            </div>
                          )}

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">アポインター名</label>
                            <input value={editForm.appointer}
                              onChange={(e) => setEditForm({ ...editForm, appointer: e.target.value })}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">次回商談日時</label>
                            <input type="datetime-local" value={editForm.nextMeeting}
                              onChange={(e) => setEditForm({ ...editForm, nextMeeting: e.target.value })}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">備考</label>
                            <textarea value={editForm.notes} rows={2}
                              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                          </div>

                          {!isAppointer && (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">売上金額（円）</label>
                              <input type="number" min={0} value={editForm.amount}
                                onChange={(e) => setEditForm({ ...editForm, amount: Number(e.target.value) })}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <button onClick={() => handleSave(c.id)} disabled={saving}
                            className="px-5 py-2 bg-[#26C6DA] text-white rounded-lg text-sm font-medium hover:bg-[#00ACC1] disabled:opacity-50 transition-colors">
                            保存する
                          </button>
                          {isAdmin && (
                            <button onClick={() => handleDelete(c.id)}
                              className="px-5 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">
                              削除する
                            </button>
                          )}
                          <button onClick={() => setEditId(null)}
                            className="px-5 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                            キャンセル
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "add" && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 max-w-2xl">
            <h3 className="text-base font-semibold text-gray-700 mb-5">新規案件登録</h3>
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">顧客名 <span className="text-red-500">*</span></label>
                <input required value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#26C6DA]" />
              </div>

              {!isAppointer && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">ステータス</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#26C6DA]">
                    {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              )}

              {!isAppointer && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">営業担当者名</label>
                  <input value={form.salesPerson} onChange={(e) => setForm({ ...form, salesPerson: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#26C6DA]" />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">アポインター名</label>
                <input value={form.appointer} onChange={(e) => setForm({ ...form, appointer: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#26C6DA]" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">次回商談日時</label>
                <input type="datetime-local" value={form.nextMeeting}
                  onChange={(e) => setForm({ ...form, nextMeeting: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#26C6DA]" />
              </div>

              {!isAppointer && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">備考</label>
                  <textarea value={form.notes} rows={2}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#26C6DA]" />
                </div>
              )}

              {!isAppointer && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">売上金額（円）</label>
                  <input type="number" min={0} value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#26C6DA]" />
                </div>
              )}

              <div className="md:col-span-2">
                <button type="submit" disabled={saving}
                  className="px-8 py-2.5 bg-[#26C6DA] text-white rounded-lg text-sm font-semibold hover:bg-[#00ACC1] disabled:opacity-50 transition-colors">
                  {saving ? "登録中..." : "登録する"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
