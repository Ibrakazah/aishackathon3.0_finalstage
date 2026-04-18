// ── Задача 2 ── Матрица нагрузки (учителя / предметы / часы)
import React, { useState } from "react";
import { Plus, Trash2, BookOpen, Users, DoorOpen, Save, CheckCircle2 } from "lucide-react";

// ═══ Default data (seeded from real schedule) ═══
const DEFAULT_CLASSES = ["7A","7B","7C","8A","8B","8C","8D","9A","9B","10А","10В","11А","11В"];

const DEFAULT_SUBJECTS: Array<{ subject: string; hoursPerWeek: number }> = [
  { subject: "Алгебра",             hoursPerWeek: 3 },
  { subject: "Геометрия",           hoursPerWeek: 2 },
  { subject: "Қазақ тілі",         hoursPerWeek: 3 },
  { subject: "Қазақ әдебиеті",     hoursPerWeek: 2 },
  { subject: "Орыс тілі",          hoursPerWeek: 2 },
  { subject: "Ағылшын тілі",       hoursPerWeek: 3 },
  { subject: "Физика",             hoursPerWeek: 3 },
  { subject: "Химия",              hoursPerWeek: 2 },
  { subject: "Биология",           hoursPerWeek: 2 },
  { subject: "География",          hoursPerWeek: 2 },
  { subject: "Информатика",        hoursPerWeek: 1 },
  { subject: "Дене шынықтыру",     hoursPerWeek: 3 },
  { subject: "Қазақстан тарихы",   hoursPerWeek: 2 },
  { subject: "Дүние жүзі тарихы",  hoursPerWeek: 1 },
  { subject: "Тәрбие сағаты",      hoursPerWeek: 1 },
];

const DEFAULT_TEACHERS = [
  { name: "Арыстанғалиқызы А",  subjects: ["Алгебра","Геометрия"],          maxHoursPerDay: 6 },
  { name: "Гореева А.М.",       subjects: ["Орыс тілі"],                    maxHoursPerDay: 6 },
  { name: "Аманғазы С.",        subjects: ["Химия"],                        maxHoursPerDay: 6 },
  { name: "Утенова К.К.",       subjects: ["Қазақ тілі","Қазақ әдебиеті"],  maxHoursPerDay: 6 },
  { name: "Сунгариева А.Б.",    subjects: ["Физика"],                       maxHoursPerDay: 6 },
  { name: "Қайыржанова А.",     subjects: ["Ағылшын тілі"],                 maxHoursPerDay: 6 },
  { name: "Қарабай А.Н.",       subjects: ["Дене шынықтыру"],               maxHoursPerDay: 6 },
  { name: "Аділов Т.Б.",        subjects: ["Дене шынықтыру"],               maxHoursPerDay: 6 },
  { name: "Таңатар М.М.",       subjects: ["Ағылшын тілі"],                 maxHoursPerDay: 6 },
  { name: "Жоламан М.",         subjects: ["Алгебра","Геометрия"],          maxHoursPerDay: 6 },
  { name: "Иван О.А.",          subjects: ["Қазақстан тарихы","Дүние жүзі тарихы"], maxHoursPerDay: 6 },
  { name: "Қангерей Қ.",        subjects: ["Қазақстан тарихы","Дүние жүзі тарихы"], maxHoursPerDay: 6 },
  { name: "Жадырасын Е.",       subjects: ["География"],                    maxHoursPerDay: 6 },
  { name: "Қайырқұлов Н.А.",    subjects: ["Биология"],                    maxHoursPerDay: 6 },
  { name: "Сапар Е.",           subjects: ["Информатика"],                  maxHoursPerDay: 6 },
  { name: "Бактыгулов А.И.",    subjects: ["Қазақ тілі","Қазақ әдебиеті"], maxHoursPerDay: 6 },
  { name: "Матигулова Г.Б.",    subjects: ["Орыс тілі"],                   maxHoursPerDay: 6 },
  { name: "Жомартова А.Қ.",     subjects: ["Қазақ тілі","Қазақ әдебиеті"], maxHoursPerDay: 6 },
  { name: "Ақырап А.",          subjects: ["Ағылшын тілі"],                maxHoursPerDay: 6 },
  { name: "Назаров Д.С.",       subjects: ["Химия"],                       maxHoursPerDay: 6 },
];

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
export function loadMatrixStore() {
  try {
    const raw = localStorage.getItem("sg_matrix");
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    classes:  DEFAULT_CLASSES,
    subjects: DEFAULT_SUBJECTS,
    teachers: DEFAULT_TEACHERS,
    rooms:    DEFAULT_ROOMS,
  };
}

export function saveMatrixStore(data: ReturnType<typeof loadMatrixStore>) {
  localStorage.setItem("sg_matrix", JSON.stringify(data));
}

// ═══════════════════════════════════════════════════════════════
export function MatrixPanel() {
  const [store, setStore] = useState(loadMatrixStore());
  const [saved, setSaved] = useState(false);
  const [section, setSection] = useState<"subjects"|"teachers"|"rooms">("subjects");

  // ── subject helpers ──
  const addSubject = () => {
    const updated = { ...store, subjects: [...store.subjects, { subject: "Новый предмет", hoursPerWeek: 2 }] };
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

  // ── teacher helpers ──
  const toggleTeacherSubject = (tIdx: number, subj: string) => {
    const teachers = store.teachers.map((t: any, idx: number) => {
      if (idx !== tIdx) return t;
      const has = t.subjects.includes(subj);
      return { ...t, subjects: has ? t.subjects.filter((s: string) => s !== subj) : [...t.subjects, subj] };
    });
    setStore({ ...store, teachers });
  };

  const handleSave = () => {
    saveMatrixStore(store);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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
            onClick={handleSave}
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
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-black text-gray-900 dark:text-white text-sm uppercase tracking-widest">
                Предметы и часы в неделю
              </h3>
              <button onClick={addSubject} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-all">
                <Plus className="w-3.5 h-3.5" /> Добавить
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">
              Укажите количество уроков в неделю для каждого предмета. Алгоритм равномерно распределит их по дням.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {store.subjects.map((s: any, i: number) => (
                <div key={i} className="flex items-center gap-3 bg-gray-50 dark:bg-slate-800 p-3 rounded-2xl border border-gray-100 dark:border-slate-700 group">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <input
                    value={s.subject}
                    onChange={e => updateSubject(i, "subject", e.target.value)}
                    className="flex-1 bg-transparent text-sm font-bold text-gray-900 dark:text-white outline-none min-w-0"
                  />
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => updateSubject(i, "hoursPerWeek", Math.max(1, s.hoursPerWeek - 1))} className="w-6 h-6 rounded-lg bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300 font-black text-xs hover:bg-blue-200 transition-all flex items-center justify-center">−</button>
                    <span className="w-6 text-center font-black text-blue-600 dark:text-blue-400 text-sm">{s.hoursPerWeek}</span>
                    <button onClick={() => updateSubject(i, "hoursPerWeek", Math.min(10, s.hoursPerWeek + 1))} className="w-6 h-6 rounded-lg bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300 font-black text-xs hover:bg-blue-200 transition-all flex items-center justify-center">+</button>
                  </div>
                  <button onClick={() => removeSubject(i)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 dark:text-slate-500 font-bold">Макс./день:</span>
                      <input
                        type="number"
                        min={1} max={10}
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
                  <div className="flex flex-wrap gap-2">
                    {store.subjects.map((s: any) => {
                      const active = t.subjects.includes(s.subject);
                      return (
                        <button
                          key={s.subject}
                          onClick={() => toggleTeacherSubject(tIdx, s.subject)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                            active
                              ? "bg-indigo-600 text-white border-indigo-500 shadow"
                              : "bg-white dark:bg-slate-900 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:border-indigo-400"
                          }`}
                        >
                          {s.subject}
                        </button>
                      );
                    })}
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
    </div>
  );
}
