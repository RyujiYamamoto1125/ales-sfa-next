"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Mail, Lock, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setError("メールアドレスまたはパスワードが正しくありません");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex bg-[#F7F8FC]">
      {/* 左パネル */}
      <div className="hidden lg:flex lg:w-1/2 bg-indigo-600 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <span className="text-white font-bold text-xl tracking-tight">営業 SFA</span>
        </div>

        <div>
          <h2 className="text-4xl font-bold text-white leading-snug mb-4">
            チームの営業力を<br />数値で可視化する
          </h2>
          <p className="text-indigo-200 text-base leading-relaxed">
            アポ数・契約数・売上・広告効果をリアルタイムで把握。<br />
            営業マンごとの目標達成率を一目で確認できます。
          </p>
        </div>

        {/* 装飾カード */}
        <div className="space-y-3">
          {[
            { label: "今月の契約数", value: "24件", color: "bg-white/10" },
            { label: "目標達成率", value: "112%", color: "bg-white/10" },
            { label: "今月の売上", value: "¥2,400万", color: "bg-white/10" },
          ].map((item) => (
            <div key={item.label} className={`${item.color} rounded-2xl px-5 py-3 flex items-center justify-between`}>
              <span className="text-indigo-200 text-sm">{item.label}</span>
              <span className="text-white font-bold">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 右パネル */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="font-bold text-gray-800">営業 SFA</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-800 mb-1">ログイン</h1>
          <p className="text-gray-400 text-sm mb-8">アカウント情報を入力してください</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">メールアドレス</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  placeholder="admin@ales-sfa.local"
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">パスワード</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <p className="text-red-600 text-sm text-center">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 mt-2">
              {loading ? "ログイン中..." : <>ログイン <ArrowRight size={16} /></>}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-8">
            社内専用システムです。IDとパスワードは管理者にお問い合わせください。
          </p>
        </div>
      </div>
    </div>
  );
}
