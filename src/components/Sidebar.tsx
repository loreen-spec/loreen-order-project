"use client";
import { useState } from "react";
import {
  LayoutDashboard, ChevronDown, ChevronRight,
  ClipboardList, FilePlus, History,
  FileText, Archive, PlusSquare
} from "lucide-react";

export type SidebarPage =
  | "발주관리"
  | "발주서작성"
  | "발주이력"
  | "작업지시서목록"
  | "작업지시서작성";

interface Props {
  activePage: SidebarPage;
  onNavigate: (page: SidebarPage) => void;
}

const NAV = [
  {
    group: "WORK ORDER",
    icon: FileText,
    items: [
      { key: "작업지시서작성" as SidebarPage, label: "새 작업지시서",    icon: PlusSquare  },
      { key: "작업지시서목록" as SidebarPage, label: "작업지시서 목록",  icon: Archive     },
      { key: "발주관리"       as SidebarPage, label: "발주 관리",        icon: ClipboardList },
      { key: "발주서작성"     as SidebarPage, label: "발주서 작성",      icon: FilePlus    },
      { key: "발주이력"       as SidebarPage, label: "발주 이력",        icon: History     },
    ],
  },
];

export default function Sidebar({ activePage, onNavigate }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({ ORDER: true, "WORK ORDER": true });

  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 bg-white border-r border-gray-100 flex flex-col">
      {/* 로고 */}
      <div className="h-14 flex items-center gap-2.5 px-5 border-b border-gray-100">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
          <LayoutDashboard size={14} className="text-white" />
        </div>
        <div>
          <div className="font-bold text-gray-900 text-sm leading-tight">OZ Dashboard</div>
          <div className="text-gray-400 text-[10px] leading-tight">제품디자인팀</div>
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {NAV.map((group) => {
          const Icon = group.icon;
          const isOpen = open[group.group] ?? true;
          return (
            <div key={group.group} className="mb-2">
              <button
                onClick={() => setOpen((o) => ({ ...o, [group.group]: !o[group.group] }))}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <Icon size={15} className="text-indigo-500" />
                <span className="flex-1 text-left font-bold text-xs text-gray-500 tracking-widest uppercase">{group.group}</span>
                {isOpen
                  ? <ChevronDown size={13} className="text-gray-300" />
                  : <ChevronRight size={13} className="text-gray-300" />}
              </button>

              {isOpen && (
                <div className="mt-1 space-y-0.5 pl-2">
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    const active = activePage === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => onNavigate(item.key)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                          active
                            ? "bg-indigo-50 text-indigo-700"
                            : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                        }`}
                      >
                        <ItemIcon size={15} className={active ? "text-indigo-600" : "text-gray-400"} />
                        {item.label}
                        {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-gray-100">
        <div className="text-[10px] text-gray-300 text-center">오즈키즈 · 제품디자인팀</div>
      </div>
    </aside>
  );
}
