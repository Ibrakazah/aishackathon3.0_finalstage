// ── Задача 4 ── Алгоритм генерации расписания + отображение результата
import React, { useState } from "react";
import {
  Wand2, Loader2, CheckCircle2, AlertTriangle, RefreshCw,
  Download, ChevronDown, ChevronUp, ZoomIn, ZoomOut
} from "lucide-react";
import { loadMatrixStore } from "./MatrixPanel";

// ── Types ──
export interface GeneratedCell {
  subject: string;
  teacher: string;
  room: string;
  isLent?: boolean;
  lentGroup?: string;
  isConflict?: boolean;
}
export type GeneratedSchedule = Record<string, Record<string, Record<string, GeneratedCell>>>;

interface LentConfig {
  id: string;
  parallelClasses: string[];
  subject: string;
  groups: number;
  groupNames: string[];
  fixedDay: string;
  fixedTime: string;
  teachers: string[];
  rooms: string[];
}

const DAYS = ["Понедельник","Вторник","Среда","Четверг","Пятница"];
const TIME_SLOTS = [
  "08:00-08:45","09:05-09:50","10:10-10:55","11:00-11:45","11:50-12:35",
  "13:05-13:50","14:20-15:00","15:05-15:45",
];

function loadLents(): LentConfig[] {
  try {
    const raw = localStorage.getItem("sg_lents");
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

// ═══════════════════════════════════════════════════════════════
// CONSTRAINT-BASED GREEDY SCHEDULER
// ═══════════════════════════════════════════════════════════════
function generateSchedule(
  matrix: ReturnType<typeof loadMatrixStore>,
  lents: LentConfig[],
): { schedule: GeneratedSchedule; stats: { totalLessons: number; conflicts: number; lentsPlaced: number; timeMs: number } } {

  const t0 = performance.now();
  const schedule: GeneratedSchedule = {};
  const classes = matrix.classes as string[];
  const subjects = matrix.subjects as { subject: string; hoursPerWeek: number }[];
  const teachers  = matrix.teachers as { name: string; subjects: string[]; maxHoursPerDay: number }[];
  const rooms     = matrix.rooms    as { name: string; type: string }[];

  // Initialize empty grid
  for (const cls of classes) {
    schedule[cls] = {};
    for (const day of DAYS) {
      schedule[cls][day] = {};
    }
  }

  // Track occupation
  // teacherBusy[teacher][day][time] = true
  const teacherBusy: Record<string, Record<string, Record<string, boolean>>> = {};
  const roomBusy:    Record<string, Record<string, Record<string, boolean>>> = {};
  const classBusy:   Record<string, Record<string, Record<string, boolean>>> = {};

  const markTeacher = (t: string, day: string, time: string) => {
    teacherBusy[t] = teacherBusy[t] ?? {};
    teacherBusy[t][day] = teacherBusy[t][day] ?? {};
    teacherBusy[t][day][time] = true;
  };
  const markRoom = (r: string, day: string, time: string) => {
    roomBusy[r] = roomBusy[r] ?? {};
    roomBusy[r][day] = roomBusy[r][day] ?? {};
    roomBusy[r][day][time] = true;
  };
  const markClass = (c: string, day: string, time: string) => {
    classBusy[c] = classBusy[c] ?? {};
    classBusy[c][day] = classBusy[c][day] ?? {};
    classBusy[c][day][time] = true;
  };
  const isTeacherFree = (t: string, day: string, time: string) => !teacherBusy[t]?.[day]?.[time];
  const isRoomFree    = (r: string, day: string, time: string) => !roomBusy[r]?.[day]?.[time];
  const isClassFree   = (c: string, day: string, time: string) => !classBusy[c]?.[day]?.[time];

  // Teacher load per day counter
  const teacherDayLoad: Record<string, Record<string, number>> = {};
  const incLoad = (t: string, day: string) => {
    teacherDayLoad[t] = teacherDayLoad[t] ?? {};
    teacherDayLoad[t][day] = (teacherDayLoad[t][day] ?? 0) + 1;
  };
  const getLoad = (t: string, day: string) => teacherDayLoad[t]?.[day] ?? 0;

  let totalLessons = 0;
  let conflicts    = 0;
  let lentsPlaced  = 0;

  // ── STEP 1: Place LENTS first (they have fixed slots) ──
  for (const lent of lents) {
    const { parallelClasses, fixedDay, fixedTime, groups, groupNames, teachers: lentTeachers, rooms: lentRooms } = lent;

    for (let gi = 0; gi < groups; gi++) {
      const teacher = lentTeachers[gi] ?? "";
      const room    = lentRooms[gi]    ?? "";

      // Assign one group per class in round-robin
      const assignedClasses = parallelClasses.filter((_, i) => i % groups === gi);
      for (const cls of assignedClasses) {
        if (!isClassFree(cls, fixedDay, fixedTime)) { conflicts++; continue; }

        const cell: GeneratedCell = {
          subject: lent.subject,
          teacher: teacher,
          room:    room,
          isLent:  true,
          lentGroup: groupNames[gi] ?? `Группа ${gi + 1}`,
        };

        schedule[cls][fixedDay][fixedTime] = cell;
        markClass(cls, fixedDay, fixedTime);
        if (teacher) { markTeacher(teacher, fixedDay, fixedTime); incLoad(teacher, fixedDay); }
        if (room)    markRoom(room, fixedDay, fixedTime);
        totalLessons++;
      }
    }
    lentsPlaced++;
  }

  // ── STEP 2: Place regular subjects ──
  // Build list: (class, subject, remainingHours)
  const queue: { cls: string; subject: string; hours: number }[] = [];
  for (const cls of classes) {
    for (const { subject, hoursPerWeek } of subjects) {
      // subtract lent hours for this subject
      let lentHoursForClass = 0;
      for (const lent of lents) {
        if (lent.parallelClasses.includes(cls) && lent.subject === subject) {
          lentHoursForClass++;
        }
      }
      const remaining = Math.max(0, hoursPerWeek - lentHoursForClass);
      if (remaining > 0) queue.push({ cls, subject, hours: remaining });
    }
  }

  // Shuffle slightly for better distribution
  queue.sort(() => Math.random() - 0.5);

  // For each (class, subject), find a suitable slot
  for (const item of queue) {
    let placed = 0;
    const dayOrder = [...DAYS].sort(() => Math.random() - 0.5);

    outerLoop:
    for (let attempt = 0; placed < item.hours && attempt < item.hours * 10; attempt++) {
      for (const day of dayOrder) {
        if (placed >= item.hours) break outerLoop;
        
        const slotOrder = [...TIME_SLOTS].sort(() => Math.random() - 0.5);
        for (const time of slotOrder) {
          if (placed >= item.hours) break outerLoop;
          if (!isClassFree(item.cls, day, time)) continue;

          // Find a free teacher who can teach this subject
          const capable = teachers.filter(t => 
            t.subjects.includes(item.subject) &&
            isTeacherFree(t.name, day, time) &&
            getLoad(t.name, day) < t.maxHoursPerDay
          );

          if (capable.length === 0) { conflicts++; continue; }

          // Prefer teacher with fewer total lessons
          const teacher = capable[0];

          // Find a free room  (prefer lab for Physics/Chemistry/Biology, gym for PE)
          const physSubjects = ["Физика","Химия","Биология"];
          const peSubjects   = ["Дене шынықтыру"];
          const preferredTypes = peSubjects.includes(item.subject)
            ? ["gym"]
            : physSubjects.includes(item.subject) ? ["lab","classroom"] : ["classroom","lab"];

          const freeRoom = rooms
            .filter(r => isRoomFree(r.name, day, time) && preferredTypes.includes(r.type))
            .sort((a, b) => preferredTypes.indexOf(a.type) - preferredTypes.indexOf(b.type))[0]
            ?? rooms.find(r => isRoomFree(r.name, day, time));

          if (!freeRoom) { conflicts++; continue; }

          schedule[item.cls][day][time] = {
            subject: item.subject,
            teacher: teacher.name,
            room:    freeRoom.name,
          };

          markClass(item.cls, day, time);
          markTeacher(teacher.name, day, time);
          markRoom(freeRoom.name, day, time);
          incLoad(teacher.name, day);
          totalLessons++;
          placed++;
          break; // found a slot for this item
        }
      }
    }

    if (placed < item.hours) {
      // Could not place all: mark as conflict
      conflicts += (item.hours - placed);
    }
  }

  const timeMs = Math.round(performance.now() - t0);
  return { schedule, stats: { totalLessons, conflicts, lentsPlaced, timeMs } };
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════
interface Props {
  generatedSchedule: GeneratedSchedule | null;
  setGeneratedSchedule: (s: GeneratedSchedule) => void;
  generationStats: { totalLessons: number; conflicts: number; lentsPlaced: number; timeMs: number } | null;
  setGenerationStats: (s: any) => void;
}

export function GeneratePanel({ generatedSchedule, setGeneratedSchedule, generationStats, setGenerationStats }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(0.75);
  const [showClass, setShowClass] = useState<string | null>(null);

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const matrix = loadMatrixStore();
      const lents  = loadLents();
      const { schedule, stats } = generateSchedule(matrix, lents);
      setGeneratedSchedule(schedule);
      setGenerationStats(stats);
      setIsGenerating(false);
      if (!showClass && matrix.classes.length > 0) setShowClass(matrix.classes[0]);
    }, 800); // slight delay for UX feedback
  };

  const classes = generatedSchedule ? Object.keys(generatedSchedule).sort() : [];

  const downloadCSV = () => {
    if (!generatedSchedule) return;
    const rows: string[] = ["Класс,День,Время,Предмет,Учитель,Кабинет,Тип"];
    for (const cls of classes) {
      for (const day of DAYS) {
        for (const time of TIME_SLOTS) {
          const cell = generatedSchedule[cls]?.[day]?.[time];
          if (cell) {
            rows.push(`${cls},${day},${time},${cell.subject},${cell.teacher},${cell.room},${cell.isLent ? "Лента" : "Обычный"}`);
          }
        }
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "schedule_generated.csv"; a.click();
  };

  return (
    <div className="space-y-5">
      {/* Action bar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-gray-200 dark:border-slate-800 p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-gray-900 dark:text-white text-lg">Генерация расписания</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
              Алгоритм прочитает матрицу нагрузки и ленты, расставит уроки без накладок
            </p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            {generatedSchedule && (
              <button
                onClick={downloadCSV}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
              >
                <Download className="w-4 h-4" /> CSV
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-violet-500/30 hover:opacity-90 transition-all active:scale-95 disabled:opacity-70"
            >
              {isGenerating
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Генерация...</>
                : generatedSchedule
                  ? <><RefreshCw className="w-4 h-4" /> Перегенерировать</>
                  : <><Wand2 className="w-4 h-4" /> Генерировать</>
              }
            </button>
          </div>
        </div>

        {/* Stats */}
        {generationStats && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Уроков размещено", value: generationStats.totalLessons, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
              { label: "Конфликтов",       value: generationStats.conflicts,     color: generationStats.conflicts > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400", bg: generationStats.conflicts > 0 ? "bg-red-50 dark:bg-red-950/30" : "bg-emerald-50 dark:bg-emerald-950/30" },
              { label: "Лент размещено",   value: generationStats.lentsPlaced,   color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/30" },
              { label: "Время (мс)",       value: generationStats.timeMs,         color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-950/30" },
            ].map(st => (
              <div key={st.label} className={`${st.bg} rounded-2xl p-4 border border-gray-100 dark:border-slate-800`}>
                <p className={`text-2xl font-black ${st.color}`}>{st.value}</p>
                <p className="text-xs font-bold text-gray-500 dark:text-slate-400 mt-1">{st.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule table */}
      {generatedSchedule && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
          {/* Controls */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/60 gap-3 flex-wrap">
            {/* Class selector */}
            <div className="flex flex-wrap gap-1.5">
              {classes.map(cls => (
                <button
                  key={cls}
                  onClick={() => setShowClass(showClass === cls ? null : cls)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border ${
                    showClass === cls
                      ? "bg-violet-600 text-white border-violet-500 shadow"
                      : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-violet-400"
                  }`}
                >
                  {cls}
                </button>
              ))}
            </div>

            {/* Zoom */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-1 rounded-xl border border-gray-200 dark:border-slate-700">
              <button onClick={() => setZoomLevel(z => Math.max(0.4, z - 0.1))} className="p-1 text-gray-400 hover:text-violet-600"><ZoomOut className="w-4 h-4" /></button>
              <span className="text-[10px] font-black w-10 text-center dark:text-slate-400">{Math.round(zoomLevel * 100)}%</span>
              <button onClick={() => setZoomLevel(z => Math.min(1.2, z + 0.1))} className="p-1 text-gray-400 hover:text-violet-600"><ZoomIn className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Grid */}
          {showClass && (
            <div className="overflow-auto p-4">
              <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: "top left", width: `${100 / zoomLevel}%`, transition: "transform 0.2s" }}>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-800 dark:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest">
                      <th className="p-3 w-24 border border-white/5 bg-gray-900 dark:bg-slate-950 text-left">Время</th>
                      {DAYS.map(d => <th key={d} className="p-3 border border-white/5">{d}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {TIME_SLOTS.map(time => (
                      <tr key={time} className="hover:bg-blue-50/50 dark:hover:bg-indigo-900/10 transition-all group">
                        <td className="p-3 border border-gray-100 dark:border-slate-800 font-bold text-gray-400 dark:text-slate-500 text-[10px] bg-gray-50/50 dark:bg-slate-950/30">{time}</td>
                        {DAYS.map(day => {
                          const cell = generatedSchedule[showClass]?.[day]?.[time];
                          return (
                            <td key={day} className="p-2 border border-gray-100 dark:border-slate-800 text-center min-w-[110px]">
                              {cell ? (
                                <div className={`flex flex-col gap-1 items-center p-1.5 rounded-xl ${
                                  cell.isLent     ? "bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50" :
                                  cell.isConflict ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50" :
                                  "bg-blue-50/50 dark:bg-blue-900/10"
                                }`}>
                                  {cell.isLent && (
                                    <span className="text-[8px] bg-purple-600 text-white px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                                      Лента · {cell.lentGroup}
                                    </span>
                                  )}
                                  <span className="font-black text-gray-900 dark:text-slate-100 text-[11px] leading-tight text-center">{cell.subject}</span>
                                  <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500 text-center leading-tight">{cell.teacher}</span>
                                  <span className="mt-0.5 px-2 py-0.5 font-black rounded text-[9px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">{cell.room}</span>
                                </div>
                              ) : (
                                <div className="text-gray-200 dark:text-slate-800 text-lg text-center py-4">—</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!showClass && (
            <div className="py-16 text-center text-gray-400 dark:text-slate-600 font-bold text-sm">
              Выберите класс выше для просмотра расписания
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!generatedSchedule && !isGenerating && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-gray-200 dark:border-slate-800 py-24 flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-violet-100 dark:bg-violet-900/30 rounded-2xl flex items-center justify-center">
            <Wand2 className="w-8 h-8 text-violet-500" />
          </div>
          <p className="font-black text-gray-900 dark:text-white text-lg">Расписание не сгенерировано</p>
          <p className="text-sm text-gray-400 dark:text-slate-500 max-w-sm text-center">
            Настройте матрицу нагрузки и ленты, затем нажмите «Генерировать»
          </p>
        </div>
      )}
    </div>
  );
}
