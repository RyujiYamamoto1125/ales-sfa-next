"use client";

import Sidebar from "./Sidebar";
import ChatBot from "./ChatBot";
import { Bell, Search } from "lucide-react";
import { useSession } from "next-auth/react";

interface Props {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export default function AppLayout({ title, actions, children }: Props) {
  const { data: session } = useSession();

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F8FC]">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center px-8 gap-4 shrink-0">
          <h1 className="text-lg font-bold text-gray-800 mr-auto">{title}</h1>

          {/* 検索 */}
          <div className="relative hidden md:block">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="検索..."
              className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-52"
            />
          </div>

          {actions}

          {/* 通知 */}
          <button className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
            <Bell size={17} className="text-gray-500" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-600" />
          </button>

          {/* アバター */}
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
            <span className="text-indigo-700 font-bold text-sm">
              {session?.user?.name?.charAt(0) ?? "U"}
            </span>
          </div>
        </header>

        {/* コンテンツ */}
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>

      <ChatBot />
    </div>
  );
}
