// ── Задача 5 ── Тепловая карта нагрузки учителей
import React, { useMemo } from "react";
import { BarChart3, AlertTriangle, CheckCircle2, Flame, Info } from "lucide-react";

const DAYS = ["Понедельник","Вторник","Среда","Четверг","Пятница"];
const TIME_SLOTS = [
  "08:00-08:45","09:05-09:50","10:10-10:55","11:00-11:45","11:50-12:35",
  "13:05-13:50","14:20-15:00","15:05-15:45",
];

type GeneratedSchedule = Record<string, Record<string, Record<string, {
  subject: string; teacher: string; room: string; isLent?: boolean; lentGroup?: string;
}>>>;

interface TeacherLoad {
  name: string;
  totalLessons: number;
  perDay: Record<string, number>;
  maxDay: string;
  maxDayLoad: number;
  isOverloaded: boolean;
  subjects: Set<string>;
}

function buildTeacherLoadMap(schedule: GeneratedSchedule): TeacherLoad[] {
  const map: Record<string, TeacherLoad> = {};

  for (const cls of Object.values(schedule)) {
    for (const [day, slots] of Object.entries(cls)) {
      for (const cell of Object.values(slots)) {
        if (!cell.teacher || cell.teacher === "Воспитатель" || cell.teacher === "") continue;
        if (!map[cell.teacher]) {
          map[cell.teacher] = {
            name: cell.teacher,
            totalLessons: 0,
            perDay: Object.fromEntries(DAYS.map(d => [d, 0])),
            maxDay: DAYS[0],
            maxDayLoad: 0,
            isOverloaded: false,
            subjects: new Set(),
          };
        }
        map[cell.teacher].totalLessons++;
        map[cell.teacher].perDay[day] = (map[cell.teacher].perDay[day] ?? 0) + 1;
        if (cell.subject) map[cell.teacher].subjects.add(cell.subject);
      }
    }
  }

  return Object.values(map).map(t => {
    const maxDay = DAYS.reduce((a, b) => (t.perDay[a] ?? 0) >= (t.perDay[b] ?? 0) ? a : b);
    const maxDayLoad = t.perDay[maxDay] ?? 0;
    return { ...t, maxDay, maxDayLoad, isOverloaded: maxDayLoad > 6 };
  }).sort((a, b) => b.totalLessons - a.totalLessons);
}

// Returns a tailwind-compatible color class based on load (0-8+)
function heatColor(n: number): { bg: string; text: string; border: string } {
  if (n === 0) return { bg: "bg-gray-50 dark:bg-slate-800/40", text: "text-gray-300 dark:text-slate-700", border: "border-gray-100 dark:border-slate-800" };
  if (n === 1) return { bg: "bg-blue-50 dark:bg-blue-950/40",    text: "text-blue-500 dark:text-blue-400",    border: "border-blue-100 dark:border-blue-900" };
  if (n === 2) return { bg: "bg-cyan-50 dark:bg-cyan-950/40",    text: "text-cyan-600 dark:text-cyan-400",    border: "border-cyan-100 dark:border-cyan-900" };
  if (n === 3) return { bg: "bg-green-50 dark:bg-green-950/40",  text: "text-green-600 dark:text-green-400",  border: "border-green-100 dark:border-green-900" };
  if (n === 4) return { bg: "bg-lime-50 dark:bg-lime-950/40",    text: "text-lime-600 dark:text-lime-400",    border: "border-lime-100 dark:border-lime-900" };
  if (n === 5) return { bg: "bg-yellow-50 dark:bg-yellow-950/40", text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-100 dark:border-yellow-900" };
  if (n === 6) return { bg: "bg-orange-50 dark:bg-orange-950/40", text: "text-orange-600 dark:text-orange-400", border: "border-orange-100 dark:border-orange-900" };
  return { bg: "bg-red-50 dark:bg-red-950/40", text: "text-red-600 dark:text-red-400", border: "border-red-200 dark:border-red-900" };
}

interface Props {
  generatedSchedule: GeneratedSchedule | null;
}

export function HeatmapPanel({ generatedSchedule }: Props) {
  const teacherLoads = useMemo(
    () => generatedSchedule ? buildTeacherLoadMap(generatedSchedule) : [],
    [generatedSchedule]
  );

  const overloaded  = teacherLoads.filter(t => t.isOverloaded);
  const optimal     = teacherLoads.filter(t => !t.isOverloaded && t.totalLessons > 0);
  const maxLoad     = Math.max(...teacherLoads.map(t => t.totalLessons), 1);

  if (!generatedSchedule) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-gray-200 dark:border-slate-800 py-24 flex flex-col items-center gap-4">
        <BarChart3 className="w-12 h-12 text-amber-400 opacity-40" />
        <p className="font-black text-gray-900 dark:text-white">Нет данных</p>
        <p className="text-sm text-gray-400 dark:text-slate-500">Сначала сгенерируйте расписание</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users2, label: "Всего учителей",  value: teacherLoads.length, color: "blue" },
          { icon: Flame,  label: "Перегружено (>6)", value: overloaded.length,   color: "red"  },
          { icon: CheckCircle2, label: "Оптимальная нагрузка", value: optimal.length, color: "emerald" },
          { icon: BarChart3, label: "Макс. уроков (нед.)", value: maxLoad, color: "amber" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className={`bg-${color}-50 dark:bg-${color}-950/30 rounded-2xl p-4 border border-${color}-100 dark:border-${color}-900/40`}>
            <p className={`text-2xl font-black text-${color}-600 dark:text-${color}-400`}>{value}</p>
            <p className="text-xs font-bold text-gray-500 dark:text-slate-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-4 flex items-center gap-3 flex-wrap">
        <span className="text-[10px] font-black text-gray-500 dark:text-slate-500 uppercase tracking-widest">Тепловая шкала:</span>
        {[0,1,2,3,4,5,6,7].map(n => {
          const c = heatColor(n);
          return (
            <div key={n} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${c.bg} ${c.border}`}>
              <span className={`text-xs font-black ${c.text}`}>{n}</span>
              <span className="text-[10px] text-gray-400 dark:text-slate-500">ур.</span>
            </div>
          );
        })}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-300 dark:border-red-800">
          <Flame className="w-3 h-3 text-red-500 animate-pulse" />
          <span className="text-xs font-bold text-red-600 dark:text-red-400">Перегрузка</span>
        </div>
      </div>

      {/* Overloaded warning */}
      {overloaded.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/30 rounded-2xl border border-red-200 dark:border-red-900/50 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-black text-red-800 dark:text-red-300 text-sm mb-1">⚠ Обнаружена перегрузка учителей</p>
            <p className="text-xs text-red-600 dark:text-red-400">
              {overloaded.map(t => `${t.name} (${t.maxDayLoad} ур. в ${t.maxDay})`).join(" · ")}
            </p>
          </div>
        </div>
      )}

      {/* Main heatmap grid */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 bg-gray-50 dark:bg-slate-950/60 border-b border-gray-100 dark:border-slate-800">
          <h3 className="font-black text-gray-900 dark:text-white text-sm uppercase tracking-widest flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-500" />
            Нагрузка учителей по дням
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <th className="p-3 text-left border-b border-gray-200 dark:border-slate-700 sticky left-0 bg-gray-100 dark:bg-slate-800 min-w-[160px]">Учитель</th>
                {DAYS.map(d => <th key={d} className="p-3 text-center border-b border-gray-200 dark:border-slate-700 min-w-[90px]">{d.slice(0,3)}</th>)}
                <th className="p-3 text-center border-b border-gray-200 dark:border-slate-700">Всего</th>
                <th className="p-3 text-left border-b border-gray-200 dark:border-slate-700">Предметы</th>
              </tr>
            </thead>
            <tbody>
              {teacherLoads.map(t => {
                const totalColor = heatColor(Math.round(t.totalLessons / 5));
                return (
                  <tr key={t.name} className={`${t.isOverloaded ? "bg-red-50/30 dark:bg-red-950/10" : ""} hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors`}>
                    <td className="p-3 border-b border-gray-100 dark:border-slate-800 sticky left-0 bg-white dark:bg-slate-900 font-bold text-gray-900 dark:text-white text-xs">
                      <div className="flex items-center gap-2">
                        {t.isOverloaded && <Flame className="w-3 h-3 text-red-500 flex-shrink-0" />}
                        <span>{t.name}</span>
                      </div>
                    </td>
                    {DAYS.map(day => {
                      const n = t.perDay[day] ?? 0;
                      const c = heatColor(n);
                      return (
                        <td key={day} className="p-2 border-b border-gray-100 dark:border-slate-800 text-center">
                          <div className={`inline-flex items-center justify-center w-8 h-8 rounded-xl font-black text-sm border ${c.bg} ${c.text} ${c.border}`}>
                            {n > 0 ? n : <span className="opacity-20">·</span>}
                          </div>
                        </td>
                      );
                    })}
                    <td className="p-2 border-b border-gray-100 dark:border-slate-800 text-center">
                      <div className={`inline-flex items-center justify-center px-3 py-1 rounded-xl font-black text-sm border ${totalColor.bg} ${totalColor.text} ${totalColor.border}`}>
                        {t.totalLessons}
                      </div>
                    </td>
                    <td className="p-3 border-b border-gray-100 dark:border-slate-800">
                      <div className="flex flex-wrap gap-1">
                        {Array.from(t.subjects).slice(0, 3).map(s => (
                          <span key={s} className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-[9px] font-bold rounded border border-indigo-100 dark:border-indigo-900/40">
                            {s.length > 10 ? s.slice(0, 10) + "…" : s}
                          </span>
                        ))}
                        {t.subjects.size > 3 && (
                          <span className="text-[9px] text-gray-400 dark:text-slate-500 font-bold">+{t.subjects.size - 3}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Inline icon helper (no extra import needed)
function Users2({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
