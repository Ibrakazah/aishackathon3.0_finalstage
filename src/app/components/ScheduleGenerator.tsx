import React, { useState } from "react";
import {
  Sparkles, Settings, Calendar, BarChart3, Wand2, AlertTriangle,
  CheckCircle2, Loader2, RefreshCw, Download, ChevronRight, Users,
  BookOpen, DoorOpen, Zap, Info
} from "lucide-react";
import { MatrixPanel } from "./schedule-gen/MatrixPanel";
import { LentPanel }   from "./schedule-gen/LentPanel";
import { GeneratePanel } from "./schedule-gen/GeneratePanel";
import { HeatmapPanel }  from "./schedule-gen/HeatmapPanel";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════
export interface SubjectLoad {
  subject: string;
  hoursPerWeek: number;
}

export interface TeacherConstraint {
  name: string;
  subjects: string[];
  maxHoursPerDay: number;
  unavailableDays?: string[];
}

export interface RoomConstraint {
  name: string;
  type: "classroom" | "gym" | "lab" | "techpark";
  capacity: number;
}

export interface LentConfig {
  id: string;
  parallelClasses: string[];  // e.g. ["7A","7B","7C"]
  subject: string;            // e.g. "Ағылшын тілі"
  groups: number;             // e.g. 4 (Beginner, Pre-Int, Int, Upper)
  fixedDay: string;           // e.g. "Вторник"
  fixedTime: string;          // e.g. "10:10-10:55"
}

export interface GeneratedCell {
  subject: string;
  teacher: string;
  room: string;
  isLent?: boolean;
  lentGroup?: string;
  isConflict?: boolean;
}

export type GeneratedSchedule = Record<string, Record<string, Record<string, GeneratedCell>>>;

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT — TAB SHELL
// ═══════════════════════════════════════════════════════════════
type TabId = "matrix" | "lents" | "generate" | "heatmap";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
  color: string;
}

const TABS: Tab[] = [
  { id: "matrix", label: "Матрица нагрузки", icon: Settings, color: "blue" },
  { id: "lents",  label: "Ленты (ERP)",      icon: Zap,      color: "purple" },
  { id: "generate", label: "Генерация",      icon: Wand2,    color: "emerald" },
  { id: "heatmap",  label: "Тепловая карта", icon: BarChart3, color: "amber" },
];

const TAB_COLORS: Record<string, string> = {
  blue:    "bg-blue-600 text-white shadow-blue-500/30",
  purple:  "bg-purple-600 text-white shadow-purple-500/30",
  emerald: "bg-emerald-600 text-white shadow-emerald-500/30",
  amber:   "bg-amber-600 text-white shadow-amber-500/30",
};

const TAB_INACTIVE: Record<string, string> = {
  blue:    "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-blue-100 dark:border-blue-900",
  purple:  "text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 border-purple-100 dark:border-purple-900",
  emerald: "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900",
  amber:   "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 border-amber-100 dark:border-amber-900",
};

export function ScheduleGenerator() {
  const [activeTab, setActiveTab] = useState<TabId>("matrix");
  const [generatedSchedule, setGeneratedSchedule] = useState<GeneratedSchedule | null>(null);
  const [generationStats, setGenerationStats] = useState<{
    totalLessons: number;
    conflicts: number;
    lentsPlaced: number;
    timeMs: number;
  } | null>(null);

  return (
    <div className="space-y-6">
      {/* ══════════════ HEADER ══════════════ */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
        {/* Gradient accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600" />

        <div className="p-6 lg:p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-violet-500/30 flex-shrink-0">
                <Wand2 className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-[0.2em]">
                    AI-ГЕНЕРАТОР • МОДУЛЬ 3
                  </span>
                </div>
                <h1 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">
                  Умное расписание
                  <span className="text-violet-600 dark:text-violet-400"> с нуля</span>
                </h1>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                  Задайте ограничения → ИИ генерирует расписание без конфликтов за секунды
                </p>
              </div>
            </div>

            {/* Status badges */}
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl">
                <Users className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                <span className="text-xs font-bold text-violet-700 dark:text-violet-300">NP-Hard Solver</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Conflict Detection</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300">Ленты ERP</span>
              </div>
            </div>
          </div>

          {/* Info banner */}
          <div className="mt-5 flex items-start gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-2xl">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 dark:text-blue-300 font-medium leading-relaxed">
              <strong>Как работает:</strong> 1) Задайте матрицу нагрузки (часы в неделю для каждого класса) →
              2) Настройте «ленты» (кросс-классовый English) →
              3) Нажмите «Генерировать» — алгоритм автоматически построит сетку без накладок кабинетов и учителей.
            </p>
          </div>
        </div>

        {/* ══════════════ TABS ══════════════ */}
        <div className="px-6 lg:px-8 pb-0 border-t border-gray-100 dark:border-slate-800">
          <div className="flex gap-1 pt-3 pb-0 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-t-xl font-black text-xs uppercase tracking-widest transition-all border-t border-x whitespace-nowrap flex-shrink-0 ${
                    isActive
                      ? `${TAB_COLORS[tab.color]} shadow-lg -mb-px border-transparent`
                      : `bg-white dark:bg-slate-900 ${TAB_INACTIVE[tab.color]} border-gray-100 dark:border-slate-800`
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══════════════ TAB CONTENT ══════════════ */}
      <div className="min-h-[500px]">
        {activeTab === "matrix" && <MatrixPanel />}
        {activeTab === "lents"  && <LentPanel />}
        {activeTab === "generate" && (
          <GeneratePanel
            generatedSchedule={generatedSchedule}
            setGeneratedSchedule={setGeneratedSchedule}
            generationStats={generationStats}
            setGenerationStats={setGenerationStats}
          />
        )}
        {activeTab === "heatmap" && (
          <HeatmapPanel generatedSchedule={generatedSchedule} />
        )}
      </div>
    </div>
  );
}

export default ScheduleGenerator;
