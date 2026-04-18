import React, { useState, useEffect } from "react";
import {
  Save, Edit2, X, Check, ZoomIn, ZoomOut, ClipboardList, ChevronDown, ChevronUp,
  Brain, Sparkles, DoorOpen, UserX, Loader2, AlertTriangle, CheckCircle2, Undo2
} from "lucide-react";
import { REAL_SCHEDULE_DATA } from "../data/realScheduleData";
import { type ScheduleCell } from "../utils/scheduleTypes";
import { VoiceInput } from "./VoiceInput";

const DAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница"];
const TIME_SLOTS = [
  "08:00-08:45", "09:05-09:50", "10:10-10:55", "11:00-11:45", "11:50-12:35",
  "13:05-13:50", "14:20-15:00", "15:05-15:45", "16:00-16:45", "16:45-17:30",
];

const ALL_CLASSES = Object.keys(REAL_SCHEDULE_DATA).sort((a, b) => {
  const numA = parseInt(a);
  const numB = parseInt(b);
  return numA === numB ? a.localeCompare(b) : numA - numB;
});

// ═══ Collect unique rooms & teachers from schedule data ═══
function collectRooms(data: typeof REAL_SCHEDULE_DATA): string[] {
  const rooms = new Set<string>();
  Object.values(data).forEach(days =>
    Object.values(days).forEach(slots =>
      Object.values(slots).forEach(cell => { if (cell.room) rooms.add(cell.room); })
    )
  );
  return Array.from(rooms).sort();
}

function collectTeachers(data: typeof REAL_SCHEDULE_DATA): string[] {
  const teachers = new Set<string>();
  Object.values(data).forEach(days =>
    Object.values(days).forEach(slots =>
      Object.values(slots).forEach(cell => { if (cell.teacher) teachers.add(cell.teacher); })
    )
  );
  return Array.from(teachers).sort();
}

// ═══ Собираем карту: кто какой предмет преподает (компетенции) ═══
function getTeacherCompetencies(data: typeof REAL_SCHEDULE_DATA): Record<string, Set<string>> {
  const map: Record<string, Set<string>> = {};
  Object.values(data).forEach(days =>
    Object.values(days).forEach(slots =>
      Object.values(slots).forEach(cell => {
        if (cell.teacher && cell.subject) {
          if (!map[cell.teacher]) map[cell.teacher] = new Set();
          map[cell.teacher].add(cell.subject);
        }
      })
    )
  );
  return map;
}

const TEACHER_COMPETENCIES = getTeacherCompetencies(REAL_SCHEDULE_DATA);

export function Schedule() {
  const [scheduleMode, setScheduleMode] = useState<"classic" | "lent">("classic");
  const [showConstraints, setShowConstraints] = useState(false);
  const [maxTeacherLoad, setMaxTeacherLoad] = useState(6);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [scheduleData, setScheduleData] = useState(REAL_SCHEDULE_DATA);
  const [originalData] = useState(REAL_SCHEDULE_DATA); // keep copy for undo
  const [zoomLevel, setZoomLevel] = useState(1);
  const [changeLog, setChangeLog] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  // ═══ AI Panel State ═══
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiMode, setAiMode] = useState<"room" | "teacher" | null>(null);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [selectedDay, setSelectedDay] = useState(DAYS[0]);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiResult, setAiResult] = useState<{ changes: number; conflicts: number } | null>(null);

  // ═══ Cell edit state ═══
  const [editingCell, setEditingCell] = useState<{ classKey: string; day: string; time: string } | null>(null);
  const [editForm, setEditForm] = useState<ScheduleCell>({ subject: "", teacher: "", room: "" });

  const allRooms = collectRooms(originalData);
  const allTeachers = collectTeachers(originalData);

  const handleEdit = (classKey: string, day: string, time: string) => {
    const cellData = scheduleData[classKey]?.[day]?.[time] || { subject: "", teacher: "", room: "" };
    setEditForm(cellData);
    setEditingCell({ classKey, day, time });
  };

  const handleSave = () => {
    if (!editingCell) return;
    setValidationError(null);

    const checkConstraints = (): boolean => {
      // 1. Room Double Booking
      if (editForm.room && !editForm.room.toLowerCase().includes("спортзал") && editForm.room !== "СВОБОДНЫЙ КАБ.") {
        for (const cKey in scheduleData) {
          if (cKey !== editingCell.classKey) {
            const existingCell = scheduleData[cKey]?.[editingCell.day]?.[editingCell.time];
            if (existingCell && existingCell.room === editForm.room) {
              setValidationError(`HARD BLOCK: Кабинет ${editForm.room} уже занят классом ${cKey} в это время.`);
              return false;
            }
          }
        }
      }
      
      // 2. Teacher Double Booking & Load Limit
      if (editForm.teacher && editForm.teacher.trim() !== "") {
        let teacherCountToday = 0;
        
        for (const cKey in scheduleData) {
          // Check simultaneous lessons
          if (cKey !== editingCell.classKey) {
            const existingCell = scheduleData[cKey]?.[editingCell.day]?.[editingCell.time];
            if (existingCell && existingCell.teacher === editForm.teacher) {
              setValidationError(`HARD BLOCK: Учитель ${editForm.teacher} уже ведет урок в ${cKey} в это время.`);
              return false;
            }
          }
          // Count total load for the day
          if (scheduleData[cKey]?.[editingCell.day]) {
            Object.values(scheduleData[cKey][editingCell.day]).forEach((cell: any) => {
               if (cell && cell.teacher === editForm.teacher) teacherCountToday++;
            });
          }
        }

        if (teacherCountToday >= maxTeacherLoad) {
           setValidationError(`HARD BLOCK: Лимит нагрузки. У ${editForm.teacher} уже ${teacherCountToday} уроков в ${editingCell.day} (Максимум ${maxTeacherLoad}).`);
           return false;
        }
      }
      return true;
    };

    if (!checkConstraints()) {
       setTimeout(() => setValidationError(null), 5000);
       return; // Abort save
    }

    setScheduleData(prev => ({
      ...prev,
      [editingCell.classKey]: {
        ...prev[editingCell.classKey],
        [editingCell.day]: {
          ...(prev[editingCell.classKey]?.[editingCell.day] || {}),
          [editingCell.time]: editForm
        }
      }
    }));
    setEditingCell(null);
  };

  const scrollToDay = (day: string) => {
    const el = document.getElementById(`day-${day}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ═══ ROOM UNAVAILABLE — Reassign rooms ═══
  const handleRoomUnavailable = () => {
    if (selectedRooms.length === 0) return;
    setAiProcessing(true);
    setAiResult(null);

    setTimeout(() => {
      setScheduleData(prev => {
        const newData = JSON.parse(JSON.stringify(prev));
        let totalChanges = 0;
        let conflicts = 0;
        const logs: string[] = [];

        // Find all rooms NOT in the blocked list
        const freeRoomPool = allRooms.filter(r => !selectedRooms.includes(r));

        // For each blocked room, check which slots use it and reassign
        const getRoomForSlot = (day: string, time: string, currentData: typeof prev): string => {
          // Collect rooms in use at this slot
          const usedRooms = new Set<string>();
          Object.values(currentData).forEach((days: any) => {
            if (days[day]?.[time]?.room) usedRooms.add(days[day][time].room);
          });
          // Find first free room from pool
          for (const r of freeRoomPool) {
            if (!usedRooms.has(r) && !selectedRooms.includes(r)) return r;
          }
          conflicts++;
          return "СВОБОДНЫЙ КАБ.";
        };

        Object.keys(newData).forEach(classKey => {
          DAYS.forEach(day => {
            if (!newData[classKey][day]) return;
            Object.keys(newData[classKey][day]).forEach(time => {
              const cell = newData[classKey][day][time];
              if (cell && selectedRooms.includes(cell.room)) {
                const newRoom = getRoomForSlot(day, time, newData);
                logs.push(`${classKey} | ${day} ${time}: каб. ${cell.room} → ${newRoom}`);
                newData[classKey][day][time] = {
                  ...cell,
                  room: newRoom,
                  isRoomChanged: true,
                };
                totalChanges++;
              }
            });
          });
        });

        setChangeLog(logs);
        if (logs.length > 0) setShowLogs(true);
        setAiResult({ changes: totalChanges, conflicts });
        setAiProcessing(false);

        if (totalChanges > 0) {
          window.dispatchEvent(new CustomEvent("ai-notification", {
            detail: {
              type: "success",
              title: "AQBOBEK AI: Кабинеты",
              message: `Перераспределено ${totalChanges} уроков. Конфликтов: ${conflicts}.`,
              route: "/", sectionName: "Расписание", confidence: 99,
            },
          }));
        }

        return newData;
      });
    }, 1500);
  };

  // ═══ TEACHER ABSENT — Find replacements ═══
  const handleTeacherAbsent = () => {
    if (!selectedTeacher) return;
    setAiProcessing(true);
    setAiResult(null);

    setTimeout(() => {
      setScheduleData(prev => {
        const newData = JSON.parse(JSON.stringify(prev));
        let totalChanges = 0;
        let conflictsResolved = 0;
        const logs: string[] = [];

        const allTeachersSet = new Set<string>();
        Object.values(prev).forEach(days =>
          Object.values(days).forEach(slots =>
            Object.values(slots).forEach(cell => { if (cell.teacher) allTeachersSet.add(cell.teacher); })
          )
        );

        const isTeacherBusy = (teacherName: string, checkDay: string, timeSlot: string, currentData: typeof prev) => {
          for (const cKey in currentData) {
            if (currentData[cKey][checkDay]?.[timeSlot]?.teacher === teacherName) return true;
          }
          return false;
        };

        const getFreeTeacher = (subject: string, checkDay: string, timeSlot: string, currentData: typeof prev, excludeStr: string) => {
          // Ищем среди ресурсов только тех, кто умеет вести этот предмет
          const qualifiedTeachers = allTeachers.filter(t => 
            TEACHER_COMPETENCIES[t]?.has(subject) && !t.toLowerCase().includes(excludeStr.toLowerCase())
          );

          for (const t of qualifiedTeachers) {
            if (!isTeacherBusy(t, checkDay, timeSlot, currentData)) return t;
          }
          
          conflictsResolved++;
          return "Резерв (Предметник не найден)";
        };

        Object.keys(newData).forEach(classKey => {
          if (newData[classKey][selectedDay]) {
            Object.keys(newData[classKey][selectedDay]).forEach(time => {
              const cell = newData[classKey][selectedDay][time];
              if (cell && cell.teacher === selectedTeacher) {
                const replacement = getFreeTeacher(cell.subject, selectedDay, time, newData, selectedTeacher);
                logs.push(`${classKey} | ${time}: ${cell.teacher} → ${replacement} (${cell.subject})`);
                newData[classKey][selectedDay][time] = {
                  ...cell,
                  teacher: replacement,
                  isSubstitute: true,
                };
                totalChanges++;
              }
            });
          }
        });

        setChangeLog(logs);
        if (logs.length > 0) setShowLogs(true);
        setAiResult({ changes: totalChanges, conflicts: conflictsResolved });
        setAiProcessing(false);

        if (totalChanges > 0) {
          window.dispatchEvent(new CustomEvent("ai-notification", {
            detail: {
              type: "success",
              title: "AQBOBEK AI: Замена учителя",
              message: `Заменено ${totalChanges} уроков для «${selectedTeacher}» (${selectedDay}).`,
              route: "/", sectionName: "Расписание", confidence: 99,
            },
          }));
          window.dispatchEvent(new CustomEvent("staff-status-update", {
            detail: { name: selectedTeacher, status: "absent", reason: "Отсутствие (ИИ)" },
          }));
          scrollToDay(selectedDay);
        }

        return newData;
      });
    }, 1500);
  };

  const handleUndo = () => {
    setScheduleData(REAL_SCHEDULE_DATA);
    setChangeLog([]);
    setShowLogs(false);
    setAiResult(null);
  };

  const toggleRoom = (room: string) => {
    setSelectedRooms(prev => prev.includes(room) ? prev.filter(r => r !== room) : [...prev, room]);
  };

  // ═══ Legacy: SessionStorage support ═══
  useEffect(() => {
    const pendingAbsence = sessionStorage.getItem("pendingTeacherAbsence");
    if (pendingAbsence) {
      sessionStorage.removeItem("pendingTeacherAbsence");
      try {
        const { absentTeacher, day } = JSON.parse(pendingAbsence);
        if (absentTeacher && day) {
          setSelectedTeacher(absentTeacher);
          setSelectedDay(day);
          setShowAiPanel(true);
          setAiMode("teacher");
        }
      } catch (e) { /* ignore */ }
    }

    const pendingMassDelete = sessionStorage.getItem("pendingMassDelete");
    if (pendingMassDelete) {
      sessionStorage.removeItem("pendingMassDelete");
      // handle mass delete legacy
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════ */}
      {/* HEADER BAR                                  */}
      {/* ═══════════════════════════════════════════ */}
      <div className="flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 lg:p-6">
          <div className="flex-1">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Управление Расписанием</h1>
            <p className="text-sm text-blue-600 dark:text-blue-400 font-bold mt-1 flex items-center gap-2">
              <Brain className="w-4 h-4 opacity-70" />
              AQBOBEK AI
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* AI Panel Toggle */}
            <button
              onClick={() => { setShowAiPanel(!showAiPanel); setAiResult(null); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-md active:scale-95 ${showAiPanel
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-purple-500/30"
                  : "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40"
                }`}
            >
              <Sparkles className="w-4 h-4" />
              {showAiPanel ? "Скрыть ИИ" : "ИИ-Корректировка"}
            </button>

            {changeLog.length > 0 && (
              <>
                <button onClick={() => setShowLogs(!showLogs)} className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-xs shadow-sm transition-all ${showLogs ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900 hover:bg-indigo-50 dark:hover:bg-indigo-900/40'}`}>
                  <ClipboardList className="w-4 h-4" />
                  Лог ({changeLog.length})
                  {showLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <button onClick={handleUndo} className="flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-xs shadow-sm bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-all active:scale-95">
                  <Undo2 className="w-4 h-4" /> Отменить всё
                </button>
              </>
            )}

            <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700">
              <button onClick={() => setScheduleMode("classic")} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${scheduleMode === "classic" ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-md" : "text-gray-500 hover:text-gray-700 dark:hover:text-slate-300"}`}>КЛАССИКА</button>
              <button onClick={() => setScheduleMode("lent")} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${scheduleMode === "lent" ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-md" : "text-gray-500 hover:text-gray-700 dark:hover:text-slate-300"}`}>ЛЕНТЫ (ERP)</button>
            </div>

            <button onClick={() => setShowConstraints(!showConstraints)} className={`px-4 py-2 rounded-xl border text-xs font-black transition-all shadow-sm ${showConstraints ? "bg-orange-500 text-white border-orange-600" : "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800 hover:bg-orange-100"}`}>
               ОГРАНИЧЕНИЯ
            </button>

            <div className="flex items-center gap-1 bg-gray-50 dark:bg-slate-800 px-2 py-1 rounded-xl border border-gray-200 dark:border-slate-700">
              <button onClick={() => setZoomLevel(prev => Math.max(0.4, prev - 0.1))} className="p-1 text-gray-400 hover:text-blue-600"><ZoomOut className="w-4 h-4" /></button>
              <span className="text-[10px] font-black w-10 text-center dark:text-slate-400 tracking-tighter">{Math.round(zoomLevel * 100)}%</span>
              <button onClick={() => setZoomLevel(prev => Math.min(1.2, prev + 0.1))} className="p-1 text-gray-400 hover:text-blue-600"><ZoomIn className="w-4 h-4" /></button>
            </div>

            <button className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 dark:bg-blue-600 text-white rounded-xl hover:scale-105 transition-all shadow-xl font-bold text-xs uppercase tracking-widest active:scale-95">
              <Save className="w-4 h-4" /> Сохранить
            </button>
          </div>
        </div>

        {validationError && (
          <div className="fixed top-20 right-8 z-[100] bg-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl shadow-red-600/30 animate-in slide-in-from-top-4 flex flex-col max-w-md border border-red-400">
            <div className="flex items-center gap-3">
               <AlertTriangle className="w-6 h-6 animate-pulse" />
               <span className="font-black text-sm uppercase tracking-widest">Блок. Конфликт</span>
            </div>
            <p className="mt-2 text-sm font-bold opacity-90 leading-tight">{validationError}</p>
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* CONSTRAINTS PANEL                           */}
        {/* ═══════════════════════════════════════════ */}
        {showConstraints && (
           <div className="px-6 pb-6 pt-2 border-t border-gray-100 dark:border-slate-800 animate-in slide-in-from-top duration-300">
             <div className="bg-orange-50 dark:bg-orange-950/30 rounded-2xl p-6 shadow-inner border border-orange-200 dark:border-orange-900/50">
                <h3 className="font-black text-orange-800 dark:text-orange-400 uppercase tracking-widest text-sm mb-4">Настройка глобальных ограничений</h3>
                <div className="flex items-center gap-6">
                   <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-3 rounded-xl border border-orange-100 dark:border-orange-900 border-l-4 border-l-orange-500">
                      <span className="text-xs font-bold text-gray-600 dark:text-slate-300">Макс. уроков в день для учителя:</span>
                      <input 
                         type="number" 
                         value={maxTeacherLoad} 
                         onChange={e => setMaxTeacherLoad(Number(e.target.value))}
                         className="w-16 bg-orange-100 dark:bg-slate-800 px-2 py-1 flex text-center font-black rounded outline-none border focus:border-orange-500 text-orange-900 dark:text-orange-300"
                         min="2" max="10"
                      />
                   </div>
                   <p className="text-xs text-orange-600/80 dark:text-orange-400/80 font-bold max-w-sm">
                      * Если перетащить (или назначить) учителя сверх этой нормы, система выдаст HARD BLOCK и не сохранит расписание.
                   </p>
                </div>
             </div>
           </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* AI PANEL (collapsible)                      */}
        {/* ═══════════════════════════════════════════ */}
        {showAiPanel && (
          <div className="px-6 pb-6 pt-2 border-t border-gray-100 dark:border-slate-800 animate-in slide-in-from-top duration-300">
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl p-6 shadow-2xl border border-purple-500/20 relative overflow-hidden">
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-600/10 blur-[80px] rounded-full pointer-events-none"></div>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-white uppercase tracking-tight text-sm">ИИ-Корректировка расписания</h3>
                  <p className="text-xs text-slate-400 font-medium">Выберите сценарий и параметры</p>
                </div>
              </div>

              {/* Scenario Tabs */}
              <div className="flex gap-3 mb-6">
                <button
                  onClick={() => { setAiMode("room"); setAiResult(null); }}
                  className={`flex-1 flex items-center justify-center gap-3 px-5 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border-2 ${aiMode === "room"
                      ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-lg shadow-amber-500/10"
                      : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-300"
                    }`}
                >
                  <DoorOpen className="w-5 h-5" />
                  Кабинет недоступен
                </button>
                <button
                  onClick={() => { setAiMode("teacher"); setAiResult(null); }}
                  className={`flex-1 flex items-center justify-center gap-3 px-5 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border-2 ${aiMode === "teacher"
                      ? "bg-red-500/20 border-red-500 text-red-300 shadow-lg shadow-red-500/10"
                      : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-300"
                    }`}
                >
                  <UserX className="w-5 h-5" />
                  Учитель отсутствует
                </button>
              </div>

              {/* ─── ROOM UNAVAILABLE FORM ─── */}
              {aiMode === "room" && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <p className="text-xs text-slate-300 font-medium leading-relaxed">
                    Выберите кабинеты, которые <strong className="text-amber-400">недоступны</strong>. ИИ автоматически переместит все уроки в другие свободные кабинеты.
                  </p>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                    {allRooms.map(room => (
                      <button
                        key={room}
                        onClick={() => toggleRoom(room)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${selectedRooms.includes(room)
                            ? "bg-amber-500 text-white border-amber-400 shadow-lg shadow-amber-500/30"
                            : "bg-white/5 text-slate-300 border-white/10 hover:border-amber-500/50 hover:text-amber-300"
                          }`}
                      >
                        {room}
                      </button>
                    ))}
                  </div>
                  {selectedRooms.length > 0 && (
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-amber-400 font-bold">
                        Заблокировано: {selectedRooms.length} каб. ({selectedRooms.join(", ")})
                      </p>
                      <button
                        onClick={handleRoomUnavailable}
                        disabled={aiProcessing}
                        className="flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-amber-600/20 active:scale-95"
                      >
                        {aiProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {aiProcessing ? "Обработка..." : "Перераспределить"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ─── TEACHER ABSENT FORM ─── */}
              {aiMode === "teacher" && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <p className="text-xs text-slate-300 font-medium leading-relaxed">
                    Укажите <strong className="text-red-400">отсутствующего учителя</strong> и день. ИИ найдёт свободного заместителя для каждого урока.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Учитель</label>
                      <select
                        value={selectedTeacher}
                        onChange={(e) => setSelectedTeacher(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                      >
                        <option value="" className="text-black">— Выберите учителя —</option>
                        {allTeachers.map(t => <option key={t} value={t} className="text-black">{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">День</label>
                      <select
                        value={selectedDay}
                        onChange={(e) => setSelectedDay(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                      >
                        {DAYS.map(d => <option key={d} value={d} className="text-black">{d}</option>)}
                      </select>
                    </div>
                  </div>
                  {selectedTeacher && (
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-red-400 font-bold">
                        Замена: {selectedTeacher} ({selectedDay})
                      </p>
                      <button
                        onClick={handleTeacherAbsent}
                        disabled={aiProcessing}
                        className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 disabled:bg-red-800 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-red-600/20 active:scale-95"
                      >
                        {aiProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                        {aiProcessing ? "Ищем замену..." : "Найти замену"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ─── AI RESULT ─── */}
              {aiResult && (
                <div className={`mt-5 p-4 rounded-2xl border flex items-center gap-4 animate-in zoom-in duration-300 ${aiResult.changes > 0
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-yellow-500/10 border-yellow-500/30"
                  }`}>
                  {aiResult.changes > 0 ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0" />
                  )}
                  <div>
                    <p className={`text-sm font-bold ${aiResult.changes > 0 ? "text-emerald-300" : "text-yellow-300"}`}>
                      {aiResult.changes > 0
                        ? `Успешно! Изменено ${aiResult.changes} ячеек расписания.`
                        : "Изменений не требуется — всё уже в порядке."
                      }
                    </p>
                    {aiResult.conflicts > 0 && (
                      <p className="text-xs text-slate-400 mt-1">Конфликтов (нет свободного ресурса): {aiResult.conflicts}</p>
                    )}
                  </div>
                </div>
              )}

              {!aiMode && (
                <div className="text-center py-6">
                  <p className="text-sm text-slate-500 font-medium">Выберите сценарий выше для начала работы</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ CHANGE LOG ═══ */}
        {showLogs && changeLog.length > 0 && (
          <div className="px-6 pb-6 pt-2 border-t border-gray-100 dark:border-slate-800 animate-in slide-in-from-top duration-300">
            <div className="bg-indigo-50/50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 p-5 shadow-inner">
              <h3 className="text-xs font-black text-indigo-900 dark:text-indigo-300 mb-4 flex items-center gap-2 uppercase tracking-widest">
                <ClipboardList className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Журнал изменений ({changeLog.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {changeLog.map((log, idx) => (
                  <div key={idx} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900 shadow-sm flex flex-col gap-1.5 transition-all hover:shadow-md">
                    <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter">{log.split('|')[0]?.trim()}</span>
                    <span className="text-[11px] font-bold text-gray-700 dark:text-slate-200">{log.split('|').slice(1).join('|').trim()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* SCHEDULE TABLE                              */}
      {/* ═══════════════════════════════════════════ */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-slate-800 overflow-hidden relative min-h-[600px] transition-colors duration-500">
        <div className="overflow-auto bg-gray-100 dark:bg-slate-950 p-6">
          <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: "top left", width: `${Math.max(100, 100 / zoomLevel)}%`, transition: "transform 0.2s" }}>
            {DAYS.map(day => (
                  <div key={day} id={`day-${day}`} className="bg-white dark:bg-slate-900 mb-10 rounded-3xl shadow-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
                    <div className="bg-green-600 dark:bg-green-700 p-5 text-white font-black text-xl uppercase tracking-[0.2em] text-center shadow-lg">{day}</div>
                    <table className="w-full border-collapse table-fixed">
                      <thead>
                        <tr className="bg-gray-800 dark:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest">
                          <th className="p-4 w-28 border border-white/5 bg-gray-900 dark:bg-slate-950">Уақыт</th>
                          {ALL_CLASSES.map(cls => <th key={cls} className="p-4 border border-white/5">{cls}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {TIME_SLOTS.map((time, tIdx) => (
                          <React.Fragment key={time}>
                            {(tIdx === 2 || tIdx === 4) && (
                              <tr className="bg-yellow-100/80 dark:bg-yellow-900/20 text-[10px] font-black text-yellow-800 dark:text-yellow-400 text-center uppercase tracking-[0.3em]">
                                <td className="p-2 border border-yellow-200/50 dark:border-yellow-900/50 font-black">{time}</td>
                                <td className="p-2 border border-yellow-200/50 dark:border-yellow-900/50" colSpan={ALL_CLASSES.length}>Үзіліс / ПЕРЕРЫВ</td>
                              </tr>
                            )}
                            <tr className="hover:bg-blue-50/50 dark:hover:bg-indigo-900/10 transition-all group">
                              <td className="p-4 border border-gray-100 dark:border-slate-800 font-bold text-gray-400 dark:text-slate-500 text-[10px] text-center bg-gray-50/50 dark:bg-slate-950/30">{time}</td>
                              {ALL_CLASSES.map(classKey => {
                                const cell = scheduleData[classKey]?.[day]?.[time];
                                const isLentBlock = scheduleMode === "lent" && cell && (cell.subject.includes("/") || cell.subject.toLowerCase().includes("ағылшын"));

                                return (
                                  <td key={classKey} className={`p-4 border border-gray-100 dark:border-slate-800 text-center group cursor-pointer transition-colors relative
                                     ${isLentBlock ? "bg-purple-50 dark:bg-purple-900/20" : "hover:bg-white dark:hover:bg-slate-800"}
                                  `} onClick={() => handleEdit(classKey, day, time)}>
                                    {isLentBlock && (
                                       <div className="absolute inset-0 border-2 border-purple-400 dark:border-purple-600 rounded-lg opacity-40 pointer-events-none z-0"></div>
                                    )}
                                    <div className="relative z-10 w-full h-full flex flex-col justify-center">
                                      {cell ? (
                                        <div className="flex flex-col gap-1.5 items-center">
                                          <span className="font-black text-gray-900 dark:text-slate-100 text-[13px] leading-tight tracking-tight">{cell.subject}</span>
                                          <span className={`text-[10px] font-bold uppercase tracking-tighter ${cell.isSubstitute ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-400'}`}>{cell.teacher}</span>
                                          <span className={`mt-1 px-2.5 py-1 font-black rounded-lg text-[10px] border shadow-sm ${cell.isRoomChanged ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700' : 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 border-blue-100 dark:border-blue-800'}`}>{cell.room}</span>
                                        </div>
                                      ) : <div className="text-gray-200 dark:text-slate-800 text-[20px] font-thin text-center w-full py-8">—</div>}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
        </div>
      </div>

      {/* ═══ EDIT MODAL ═══ */}
      {editingCell && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] p-10 max-w-sm w-full border border-gray-200 dark:border-slate-800 relative overflow-hidden animate-in zoom-in duration-300">
            <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-blue-600 to-indigo-700"></div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-8 flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-2xl flex items-center justify-center">
                <Edit2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              ПРАВКА
            </h2>
            <div className="space-y-6">
              <div className="bg-gray-100/50 dark:bg-slate-800/50 p-4 rounded-2xl border border-gray-200 dark:border-slate-700 text-[11px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest flex items-center justify-between">
                <span>{editingCell.classKey} Класс</span>
                <span className="text-blue-600 dark:text-blue-400">{editingCell.day} | {editingCell.time}</span>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Пән / Предмет</label>
                  <div className="flex gap-2">
                    <input className="flex-1 p-4 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/20 outline-none transition-all dark:text-white" value={editForm.subject} onChange={e => setEditForm({ ...editForm, subject: e.target.value })} />
                    <VoiceInput onTranscription={(t) => setEditForm({ ...editForm, subject: t })} placeholder="" className="bg-white dark:bg-slate-800 border-2 border-blue-100 dark:border-blue-900 hover:border-blue-500 rounded-2xl p-2" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Мұғалім / Учитель</label>
                  <input className="w-full p-4 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/20 outline-none transition-all dark:text-white" value={editForm.teacher} onChange={e => setEditForm({ ...editForm, teacher: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Кабинет</label>
                  <input className="w-full p-4 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/20 outline-none transition-all dark:text-white" value={editForm.room} onChange={e => setEditForm({ ...editForm, room: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="flex gap-4 mt-10">
              <button onClick={handleSave} className="flex-[1.5] bg-blue-600 text-white p-5 rounded-[1.2rem] font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/30 flex items-center justify-center gap-3 uppercase tracking-widest text-xs active:scale-95">
                <Check className="w-5 h-5" /> Сақтау
              </button>
              <button onClick={() => setEditingCell(null)} className="flex-1 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-300 p-5 rounded-[1.2rem] font-black hover:bg-gray-200 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs active:scale-95">
                <X className="w-5 h-5" /> Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CellDisplay({ data, onEdit }: { data: ScheduleCell; onEdit: () => void }) {
  const isChanged = data.isSubstitute;
  const isDeleted = data.isDeleted;
  const isRoomChanged = (data as any).isRoomChanged;
  const isSpecial = isChanged || isDeleted || isRoomChanged;

  const ringClass = isDeleted ? 'ring-[3px] ring-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)] bg-red-50/10' :
    isChanged ? 'ring-[3px] ring-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)] bg-emerald-50/10' :
      isRoomChanged ? 'ring-[3px] ring-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.4)] bg-amber-50/10' : '';
  const badgeClass = isDeleted ? 'from-red-500 to-rose-600 border-red-300' :
    isRoomChanged ? 'from-amber-500 to-orange-600 border-amber-300' :
      'from-emerald-500 to-teal-600 border-emerald-300';
  const badgeText = isDeleted ? 'Отменен' : isRoomChanged ? 'Каб. ↻' : 'Замена';

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-slate-900 transition-all group p-1.5 rounded-xl relative ${ringClass}`}>
      {isSpecial && (
        <div className={`absolute -top-3 -right-2 bg-gradient-to-r ${badgeClass} text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full shadow-lg z-10 border animate-pulse`}>
          {badgeText}
        </div>
      )}
      <div className="flex items-start justify-between">
        <h4 className={`font-black text-[14px] leading-tight pr-5 tracking-tight ${isDeleted ? 'text-red-700 dark:text-red-400' : isChanged ? 'text-emerald-700 dark:text-emerald-400' : isRoomChanged ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-slate-100'}`}>{data.subject}</h4>
        <button onClick={onEdit} className="opacity-0 group-hover:opacity-100 p-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/50 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-xl transition-all absolute top-2 right-2 shadow-sm border border-blue-100 dark:border-blue-800">
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className={`text-[10px] mt-2.5 font-bold uppercase tracking-widest leading-none ${isDeleted ? 'text-red-600 dark:text-red-500' : isChanged ? 'text-emerald-600 dark:text-emerald-500' : 'text-gray-500 dark:text-slate-400'}`}>{data.teacher}</p>
      <div className="mt-auto pt-5">
        <span className={`inline-block px-3 py-1.5 text-[10px] font-black rounded-lg border w-full text-center shadow-inner ${isDeleted ? 'bg-red-100/50 text-red-800 border-red-200' : isRoomChanged ? 'bg-amber-100/50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700' : isChanged ? 'bg-emerald-100/50 text-emerald-800 border-emerald-200' : 'bg-blue-50/50 dark:bg-indigo-900/30 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900/50'}`}>
          {data.room}
        </span>
      </div>
    </div>
  );
}

export default Schedule;
