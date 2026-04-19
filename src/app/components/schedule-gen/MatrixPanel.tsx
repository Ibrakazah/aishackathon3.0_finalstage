// ── Задача 2 ── Матрица нагрузки (учителя / предметы / часы)
import React, { useState } from "react";
import { Plus, Trash2, BookOpen, Users, DoorOpen, Save, CheckCircle2, Edit2, Zap } from "lucide-react";

// ═══ Default data (seeded from real schedule) ═══
const DEFAULT_CLASSES = ["7A","7B","7C","8A","8B","8C","8Д","9A","9B","10A","10B","11A","11B"];

const h = (val: number) => ({ "7": val, "8": val, "9": val, "10": val, "11": val });

import { TEACHER_ASSIGNMENTS } from "../../data/teacherAssignments";

const uniqueSubjects = new Map<string, { subject: string; hoursPerWeek: Record<string, number> }>();

// Force inject the top 5 core subjects so they are NOT empty even if the teacher dataset has missing info
const TOP_5: Record<string, { name: string, hours: number }> = {
  "алгебра": { name: "Алгебра", hours: 3 },
  "геометрия": { name: "Геометрия", hours: 2 },
  "қазақ тілі": { name: "Қазақ тілі", hours: 3 },
  "қазақ әдебиеті": { name: "Қазақ әдебиеті", hours: 2 },
  "орыс тілі": { name: "Орыс тілі", hours: 2 }
};

Object.entries(TOP_5).forEach(([key, info]) => {
  const defaultHours = {} as Record<string, number>;
  DEFAULT_CLASSES.forEach(c => defaultHours[c] = info.hours);
  uniqueSubjects.set(key, { subject: info.name, hoursPerWeek: defaultHours });
});

TEACHER_ASSIGNMENTS.forEach(t => {
   Object.keys(t.subjects).forEach(subj => {
      const key = subj.toLowerCase();
      if (!uniqueSubjects.has(key)) {
         uniqueSubjects.set(key, { subject: subj, hoursPerWeek: {} });
      }
      
      const subjData = uniqueSubjects.get(key)!;
      const classMap = t.subjects[subj] as Record<string, number>;
      
      Object.entries(classMap).forEach(([className, hours]) => {
         const stdClass = className
            .replace("10А", "10A").replace("10В", "10B")
            .replace("11А", "11A").replace("11В", "11B")
            .replace("8D", "8Д");
            
         // If it's one of the top 5 core subjects, we already seeded it with a strict baseline
         // but we can trust the teacher's exact hours if they exist, or just leave the baseline.
         // Overwriting it with the teacher's hours to match exact teacher config if present.
         if (TOP_5[key]) {
             subjData.hoursPerWeek[stdClass] = hours;
         } else {
             subjData.hoursPerWeek[stdClass] = (subjData.hoursPerWeek[stdClass] || 0) + hours;
         }
      });
   });
});

const DEFAULT_SUBJECTS = Array.from(uniqueSubjects.values());


const DEFAULT_TEACHERS = TEACHER_ASSIGNMENTS.map(ta => ({
  name: ta.name,
  subjects: Object.keys(ta.subjects),
  maxHoursPerDay: 6,
  maxHoursPerWeek: ta.weekly_hours > 0 ? ta.weekly_hours : 24,
  assignments: ta.subjects as Record<string, Record<string, number>>
}));

const DEFAULT_ROOMS = [
  { name: "110",       type: "classroom" as const, capacity: 30 },
  { name: "201",       type: "lab"       as const, capacity: 25 },
  { name: "203",       type: "lab"       as const, capacity: 25 },
  { name: "204",       type: "classroom" as const, capacity: 30 },
  { name: "205",       type: "classroom" as const, capacity: 30 },
  { name: "206",       type: "classroom" as const, capacity: 30 },
  { name: "209",       type: "lab"       as const, capacity: 25 },
  { name: "210",       type: "classroom" as const, capacity: 30 },
  { name: "211",       type: "lab"       as const, capacity: 25 },
  { name: "301",       type: "classroom" as const, capacity: 30 },
  { name: "302",       type: "classroom" as const, capacity: 30 },
  { name: "303",       type: "classroom" as const, capacity: 30 },
  { name: "304",       type: "classroom" as const, capacity: 30 },
  { name: "305",       type: "classroom" as const, capacity: 30 },
  { name: "309",       type: "classroom" as const, capacity: 30 },
  { name: "310",       type: "classroom" as const, capacity: 30 },
  { name: "311",       type: "classroom" as const, capacity: 30 },
  { name: "104",       type: "lab"       as const, capacity: 25 },
  { name: "107",       type: "techpark"  as const, capacity: 20 },
  { name: "Спортзал",  type: "gym"       as const, capacity: 100 },
];

// ── shared store via localStorage ──
const MATRIX_VERSION = 6; // bump this to force reset of stale data

export function loadMatrixStore() {
  try {
    const raw = localStorage.getItem("sg_matrix");
    if (raw) {
       const parsed = JSON.parse(raw);
       // If data version is outdated, reset to defaults
       if (!parsed._version || parsed._version < MATRIX_VERSION) {
         localStorage.removeItem("sg_matrix");
         return {
           _version: MATRIX_VERSION,
           classes:  DEFAULT_CLASSES,
           subjects: DEFAULT_SUBJECTS,
           teachers: DEFAULT_TEACHERS,
           rooms:    DEFAULT_ROOMS,
         };
       }
       // Migrate class names (fix Cyrillic/Latin mismatches)
       const classNameMap: Record<string, string> = {
         "10\u0410": "10A", "10\u0412": "10B", "11\u0410": "11A", "11\u0412": "11B", "8D": "8\u0414"
       };
       if (parsed.classes) {
         parsed.classes = parsed.classes.map((c: string) => classNameMap[c] || c);
         // deduplicate
         parsed.classes = [...new Set(parsed.classes)];
       }
       // Migrate subjects AND ENSURE DEFAULT SUBJECTS EXIST
       if (!parsed.subjects) parsed.subjects = [];
       
       // Add any missing default subjects
       for (const ds of DEFAULT_SUBJECTS) {
          if (!parsed.subjects.find((s:any) => s.subject.toLowerCase() === ds.subject.toLowerCase())) {
             parsed.subjects.push(ds);
          }
       }
       
       if (parsed.subjects.length > 0 && parsed.subjects[0].hoursPerWeek && parsed.subjects[0].hoursPerWeek["7"] !== undefined) {
           parsed.subjects = parsed.subjects.map((s: any) => {
              const newHrs: Record<string, number> = {};
              parsed.classes.forEach((cls: string) => {
                 const grade = cls.match(/\d+/)?.[0] || "7";
                 newHrs[cls] = s.hoursPerWeek[grade] || 0;
              });
              return { ...s, hoursPerWeek: newHrs };
           });
        }
       
       // Migrate teachers
       if (parsed.teachers) {
          parsed.teachers = parsed.teachers.map((t: any) => {
             const defaultMatch = DEFAULT_TEACHERS.find(dt => dt.name === t.name);
             // Also fix class names inside teacher assignments
             if (t.assignments) {
               for (const subj of Object.keys(t.assignments)) {
                 const classMap = t.assignments[subj];
                 for (const oldName of Object.keys(classNameMap)) {
                   if (classMap[oldName] !== undefined) {
                     classMap[classNameMap[oldName]] = classMap[oldName];
                     delete classMap[oldName];
                   }
                 }
               }
             }
             return {
               ...t,
               maxHoursPerWeek: t.maxHoursPerWeek || (t.maxHoursPerDay * 5),
               assignments: t.assignments || (defaultMatch ? defaultMatch.assignments : undefined)
             };
          });
          // If DEFAULT_TEACHERS has entirely new teachers, add them
          for (const dt of DEFAULT_TEACHERS) {
             if (!parsed.teachers.find((t:any) => t.name === dt.name)) {
                parsed.teachers.push(dt);
             }
          }
       }
       return parsed;
    }
  } catch {}
  
  return {
    _version: MATRIX_VERSION,
    classes:  DEFAULT_CLASSES,
    subjects: DEFAULT_SUBJECTS,
    teachers: DEFAULT_TEACHERS,
    rooms:    DEFAULT_ROOMS,
  };
}

export function saveMatrixStore(data: ReturnType<typeof loadMatrixStore>) {
  localStorage.setItem("sg_matrix", JSON.stringify({ ...data, _version: MATRIX_VERSION }));
}

export async function fetchMatrixStoreAsync() {
  try {
    const res = await fetch("http://localhost:8000/api/matrix");
    if (res.ok) {
      const data = await res.json();
      if (data && data.classes) {
        if (data._version && data._version >= MATRIX_VERSION) {
          // Trust the DB if it is same or newer version
          saveMatrixStore(data);
          return data;
        } else {
          console.warn("DB matrix is outdated. Falling back to fresh default calculations.");
        }
      }
    }
  } catch (e) {
    console.error("Failed to fetch matrix from SQL DB", e);
  }
  return loadMatrixStore();
}

export async function saveMatrixStoreAsync(data: ReturnType<typeof loadMatrixStore>) {
  saveMatrixStore(data);
  try {
     await fetch("http://localhost:8000/api/matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, _version: MATRIX_VERSION })
     });
  } catch (e) {
     console.error("Failed to save matrix to SQL DB", e);
  }
}

// ═══════════════════════════════════════════════════════════════
export function MatrixPanel() {
  const [store, setStore] = useState(loadMatrixStore());
  const [isInitializing, setIsInitializing] = useState(true);
  const [saved, setSaved] = useState(false);
  const [section, setSection] = useState<"subjects"|"teachers"|"rooms">("subjects");
  const [editingTeacherIdx, setEditingTeacherIdx] = useState<number | null>(null);
  
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: "global" | "subject" | "newClass";
    title: string;
    grade?: string;
    subjIdx?: number;
    value: string;
  } | null>(null);

  React.useEffect(() => {
    fetchMatrixStoreAsync().then((data) => {
      setStore(data);
      setIsInitializing(false);
    });
  }, []);

  const handleModalSubmit = () => {
    if (!modalState) return;
    const { type, grade, subjIdx, value } = modalState;
    if (type === "newClass" && value.trim()) {
      setStore(prev => ({ ...prev, classes: [...prev.classes, value.trim()].sort() }));
    } else if (type === "global" && grade) {
      const cleanVal = value.trim().replace(/\s/g, '');
      const isRel = cleanVal.startsWith("+") || cleanVal.startsWith("-");
      const dlt = Number(cleanVal);
      if (!isNaN(dlt)) {
        setStore(prev => {
          const newSubjects = prev.subjects.map((s: any) => {
            const newHrs = { ...(s.hoursPerWeek || {}) };
            prev.classes.forEach((c: string) => {
              if (c.startsWith(grade)) {
                const currentHrs = Number(newHrs[c]) || 0;
                newHrs[c] = isRel ? Math.max(0, currentHrs + dlt) : Math.max(0, dlt);
              }
            });
            return { ...s, hoursPerWeek: newHrs };
          });
          return { ...prev, subjects: newSubjects };
        });
      }
    } else if (type === "subject" && grade && subjIdx !== undefined) {
      setGradeBulk(subjIdx, grade, value);
    }
    setModalState(null);
  };

  // ── subject helpers ──
  const addSubject = () => {
    const updated = { ...store, subjects: [...store.subjects, { subject: "Новый предмет", hoursPerWeek: { "7": 2, "8": 2, "9": 2, "10": 2, "11": 2 } }] };
    setStore(updated);
  };
  const removeSubject = (i: number) => {
    const updated = { ...store, subjects: store.subjects.filter((_: any, idx: number) => idx !== i) };
    setStore(updated);
  };
  const updateSubject = (i: number, field: string, val: any) => {
    const subjects = store.subjects.map((s: any, idx: number) => idx === i ? { ...s, [field]: val } : s);
    setStore({ ...store, subjects });
  };

  const setGradeBulk = (subjIdx: number, grade: string, inputVal: string) => {
    const cleanVal = inputVal.trim().replace(/\s/g, '');
    const isRelative = cleanVal.startsWith("+") || cleanVal.startsWith("-");
    const delta = Number(cleanVal);
    if (isNaN(delta)) return;

    setStore(prev => {
      const subjects = [...prev.subjects];
      const s = { ...subjects[subjIdx] };
      const newHrs = { ...(s.hoursPerWeek || {}) };

      prev.classes.forEach((cls: string) => {
        if (cls.startsWith(grade)) {
          const currentHrs = Number(newHrs[cls]) || 0;
          if (isRelative) {
            newHrs[cls] = Math.max(0, currentHrs + delta);
          } else {
            newHrs[cls] = Math.max(0, delta);
          }
        }
      });
      
      s.hoursPerWeek = newHrs;
      subjects[subjIdx] = s;
      return { ...prev, subjects };
    });
  };

  // ── teacher helpers ──
  const toggleTeacherSubject = (tIdx: number, subj: string) => {
    const teachers = store.teachers.map((t: any, idx: number) => {
      if (idx !== tIdx) return t;
      const has = t.subjects.includes(subj);
      return { ...t, subjects: has ? t.subjects.filter((s: string) => s !== subj) : [...t.subjects, subj] };
    });
    setStore({ ...store, teachers });
  };

  const saveConfig = async () => {
    setSaved(true);
    await saveMatrixStoreAsync(store);
    setTimeout(() => setSaved(false), 2000);
  };

  if (isInitializing) {
     return <div className="p-10 flex justify-center text-gray-500 font-bold animate-pulse">Загрузка матрицы из базы данных...</div>;
  }

  const ROOM_TYPE_BADGE: Record<string, string> = {
    classroom: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
    lab:       "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
    gym:       "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
    techpark:  "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
      {/* Sub-tabs */}
      <div className="flex gap-1 p-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/60">
        {[
          { id: "subjects", label: "Предметы и часы", icon: BookOpen },
          { id: "teachers", label: "Учителя",         icon: Users    },
          { id: "rooms",    label: "Кабинеты",         icon: DoorOpen },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSection(id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
              section === id
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "text-gray-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-blue-600"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}

        <div className="ml-auto">
          <button
            onClick={saveConfig}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-md ${
              saved
                ? "bg-emerald-500 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? "Сохранено!" : "Сохранить"}
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* ── SUBJECTS ── */}
        {section === "subjects" && (
          <div className="space-y-6">
            <div className="flex flex-col bg-blue-600 dark:bg-indigo-600 rounded-[2.5rem] p-6 text-white mb-8 shadow-xl shadow-blue-500/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-all duration-700">
                <Users className="w-32 h-32" />
              </div>
              <div className="relative z-10">
                <h3 className="text-base font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-400" /> Глобальное управление
                </h3>
                <p className="text-xs text-blue-100 font-medium mb-5 max-w-sm">
                  Установите или добавьте часы для целой параллели сразу во ВСЕХ предметах. Например: "+1" ко всем урокам 7-х классов.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["7", "8", "9", "10", "11"].map(grade => (
                    <button
                      key={grade}
                      onClick={() => {
                        setModalState({
                          isOpen: true,
                          type: "global",
                          grade,
                          title: `ОБЩЕЕ действие для всех ${grade}-х классов во ВСЕХ предметах (например, +1 или 2):`,
                          value: "1"
                        });
                      }}
                      className="px-4 py-2 bg-white/20 hover:bg-white text-white hover:text-blue-600 rounded-xl text-xs font-black transition-all backdrop-blur-md border border-white/20"
                    >
                      Для всей {grade} пар.
                    </button>
                  ))}
                  <div className="w-[1px] h-8 bg-white/20 mx-2 self-center" />
                  <button
                    onClick={() => {
                      setModalState({
                        isOpen: true,
                        type: "newClass",
                        title: "Введите название нового класса (например, 7Г):",
                        value: ""
                      });
                    }}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-xs font-black transition-all shadow-lg"
                  >
                    + Добавить класс
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-gray-900 dark:text-white text-sm uppercase tracking-widest">
                Нагрузка по предметам
              </h3>
              <button onClick={addSubject} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-all">
                <Plus className="w-3.5 h-3.5" /> Добавить предмет
              </button>
            </div>
            
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-6">
              Укажите количество часов для каждого класса. Используйте кнопки "Массово" для быстрой установки часов внутри предмета.
            </p>
            
            <div className="flex flex-col gap-6">
              {store.subjects.map((s: any, i: number) => (
                <div key={i} className="bg-gray-50 dark:bg-slate-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 shadow-sm relative overflow-hidden group">
                  {/* Subject Header */}
                  <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 mb-6 relative z-10">
                    <div className="flex items-center gap-4 flex-1">
                       <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner">
                         <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                       </div>
                       <div className="flex flex-col">
                         <input
                          value={s.subject}
                          onChange={e => updateSubject(i, "subject", e.target.value)}
                          className="text-lg font-black text-gray-900 dark:text-white bg-transparent outline-none focus:text-blue-600 transition-colors w-full"
                         />
                         <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">название предмета</span>
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
                      <span className="px-3 text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2 hidden sm:inline">Массово:</span>
                      {["7", "8", "9", "10", "11"].map(grade => (
                        <button
                          key={grade}
                          onClick={() => {
                            setModalState({
                              isOpen: true,
                              type: "subject",
                              subjIdx: i,
                              grade,
                              title: `Установить часы для всех ${grade}-х классов по предмету "${s.subject}" (например, 2 или +1):`,
                              value: "2"
                            });
                          }}
                          className="px-3 py-1.5 hover:bg-blue-600 hover:text-white bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400 rounded-xl text-[10px] font-black transition-all border border-transparent hover:shadow-md"
                        >
                          {grade} кл
                        </button>
                      ))}
                      <div className="w-[1px] h-6 bg-gray-100 dark:bg-slate-700 mx-2" />
                      <button onClick={() => removeSubject(i)} className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Class Grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-12 gap-3 relative z-10">
                    {store.classes.map((cls: string) => (
                      <div key={cls} className="flex flex-col items-center gap-1.5 p-2 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm transition-all hover:shadow-md group/item">
                        <span className="text-[10px] font-black text-gray-400 group-hover/item:text-blue-500 transition-colors uppercase">{cls}</span>
                        <input
                          type="number" min={0} max={15}
                          value={s.hoursPerWeek?.[cls] ?? 0}
                          onChange={e => {
                            const newHrs = { ...s.hoursPerWeek, [cls]: Number(e.target.value) };
                            updateSubject(i, "hoursPerWeek", newHrs);
                          }}
                          className="w-full text-center text-sm font-black text-gray-900 dark:text-white bg-gray-50 dark:bg-slate-800 rounded-xl py-2 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TEACHERS ── */}
        {section === "teachers" && (
          <div className="space-y-3">
            <h3 className="font-black text-gray-900 dark:text-white text-sm uppercase tracking-widest mb-4">
              Матрица компетенций учителей
            </h3>
            <div className="space-y-3">
              {store.teachers.map((t: any, tIdx: number) => (
                <div key={tIdx} className="bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <span className="font-black text-gray-900 dark:text-white text-sm">{t.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 font-bold">Неделя:</span>
                        <input
                          type="number" min={1} max={40}
                          value={t.maxHoursPerWeek ?? (t.maxHoursPerDay * 5)}
                          onChange={e => {
                            const teachers = store.teachers.map((tt: any, i: number) =>
                              i === tIdx ? { ...tt, maxHoursPerWeek: Number(e.target.value) } : tt
                            );
                            setStore({ ...store, teachers });
                          }}
                          className="w-12 text-center text-xs font-black bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg py-1 outline-none focus:border-blue-500 dark:text-white"
                        />
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 font-bold">День:</span>
                        <input
                          type="number" min={1} max={10}
                          value={t.maxHoursPerDay}
                          onChange={e => {
                            const teachers = store.teachers.map((tt: any, i: number) =>
                              i === tIdx ? { ...tt, maxHoursPerDay: Number(e.target.value) } : tt
                            );
                            setStore({ ...store, teachers });
                          }}
                          className="w-12 text-center text-xs font-black bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg py-1 outline-none focus:border-blue-500 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {t.subjects.map((subj: string) => (
                      <span key={subj} className={`relative group px-2.5 py-1 rounded-lg text-[11px] font-bold shadow ${editingTeacherIdx === tIdx ? "bg-indigo-600 text-white pr-6" : "bg-indigo-600 text-white"}`}>
                        {subj}
                        {editingTeacherIdx === tIdx && (
                           <button onClick={() => toggleTeacherSubject(tIdx, subj)} className="absolute top-1 right-1 w-4 h-4 bg-red-400/80 rounded-full text-white flex items-center justify-center hover:bg-red-500 transition-colors">
                             <Trash2 className="w-2.5 h-2.5" />
                           </button>
                        )}
                      </span>
                    ))}
                    
                    {editingTeacherIdx === tIdx ? (
                      <div className="flex items-center gap-2 ml-1">
                        <select 
                          onChange={e => { 
                            if (e.target.value) toggleTeacherSubject(tIdx, e.target.value); 
                            e.target.value = ""; 
                          }} 
                          className="text-[11px] font-bold bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg py-1 px-2 outline-none text-indigo-600 dark:text-indigo-400 shadow-sm"
                          defaultValue=""
                        >
                          <option value="" disabled>+ Предмет</option>
                          {store.subjects.filter((s:any) => !t.subjects.includes(s.subject)).map((s:any) => (
                            <option key={s.subject} value={s.subject}>{s.subject}</option>
                          ))}
                        </select>
                        <button onClick={() => setEditingTeacherIdx(null)} className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold hover:bg-emerald-200 transition-colors">
                           Готово
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setEditingTeacherIdx(tIdx)} className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 flex items-center justify-center text-gray-500 dark:text-slate-400 transition-colors">
                         <Edit2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ROOMS ── */}
        {section === "rooms" && (
          <div className="space-y-3">
            <h3 className="font-black text-gray-900 dark:text-white text-sm uppercase tracking-widest mb-4">
              Матрица помещений
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {store.rooms.map((r: any, i: number) => (
                <div key={i} className="bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-gray-900 dark:text-white text-sm">{r.name}</span>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${ROOM_TYPE_BADGE[r.type]}`}>
                      {r.type === "classroom" ? "Класс" : r.type === "lab" ? "Лаборатория" : r.type === "gym" ? "Спортзал" : "Технопарк"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-slate-400">
                    <Users className="w-3 h-3" />
                    <span>до {r.capacity} чел.</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── CUSTOM MODAL OVERLAY ── */}
      {modalState && modalState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] shadow-2xl border border-gray-100 dark:border-slate-800 overflow-hidden transform animate-in slide-in-from-bottom-4 zoom-in-95">
            <div className="p-6">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-4 flex items-center gap-2">
                <Edit2 className="w-4 h-4" /> Ввод значения
              </h4>
              <label className="block text-sm font-bold text-gray-800 dark:text-slate-200 mb-4 leading-relaxed">
                {modalState.title}
              </label>
              <input
                autoFocus
                type="text"
                value={modalState.value}
                onChange={e => setModalState({ ...modalState, value: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') handleModalSubmit(); }}
                className="w-full bg-gray-50 dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 focus:border-blue-500 rounded-xl px-4 py-3 text-lg font-black text-gray-900 dark:text-white outline-none transition-all"
              />
            </div>
            <div className="flex bg-gray-50 dark:bg-slate-950/50 border-t border-gray-100 dark:border-slate-800">
              <button
                onClick={() => setModalState(null)}
                className="flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              >
                Отмена
              </button>
              <div className="w-[1px] bg-gray-200 dark:bg-slate-800" />
              <button
                onClick={handleModalSubmit}
                className="flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
              >
                ОК
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
