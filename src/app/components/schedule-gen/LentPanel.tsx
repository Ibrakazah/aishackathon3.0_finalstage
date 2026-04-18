// ── Задача 3 ── Конфигуратор «лент» (Английский / ERP кросс-класс)
import React, { useState } from "react";
import { Plus, Trash2, Zap, Users, Clock, Calendar, Info, CheckCircle2, Save } from "lucide-react";

const DAYS = ["Понедельник","Вторник","Среда","Четверг","Пятница"];
const TIME_SLOTS = [
  "08:00-08:45","09:05-09:50","10:10-10:55","11:00-11:45","11:50-12:35",
  "13:05-13:50","14:20-15:00","15:05-15:45","16:00-16:45","16:45-17:30",
];

const ALL_CLASSES = ["7A","7B","7C","8A","8B","8C","8D","9A","9B","10А","10В","11А","11В"];
const LEVEL_PRESETS = ["Beginner","Pre-Intermediate","Intermediate","Upper-Intermediate"];

export interface LentConfig {
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

const DEFAULT_LENTS: LentConfig[] = [
  {
    id: "lent-1",
    parallelClasses: ["7A","7B","7C"],
    subject: "Ағылшын тілі",
    groups: 4,
    groupNames: ["Beginner","Pre-Intermediate","Intermediate","Upper-Intermediate"],
    fixedDay: "Вторник",
    fixedTime: "10:10-10:55",
    teachers: ["Қайыржанова А.","Таңатар М.М.","Ақырап А.",""],
    rooms: ["304","305","302","301"],
  },
];

function loadLents(): LentConfig[] {
  try {
    const raw = localStorage.getItem("sg_lents");
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_LENTS;
}

function saveLents(lents: LentConfig[]) {
  localStorage.setItem("sg_lents", JSON.stringify(lents));
}

// ═══════════════════════════════════════════════════════════════
export function LentPanel() {
  const [lents, setLents] = useState<LentConfig[]>(loadLents());
  const [saved, setSaved] = useState(false);

  const addLent = () => {
    const newLent: LentConfig = {
      id: `lent-${Date.now()}`,
      parallelClasses: [],
      subject: "Ағылшын тілі",
      groups: 3,
      groupNames: ["Beginner","Intermediate","Upper"],
      fixedDay: "Вторник",
      fixedTime: "10:10-10:55",
      teachers: ["","",""],
      rooms: ["","",""],
    };
    setLents(prev => [...prev, newLent]);
  };

  const removeLent = (id: string) => setLents(prev => prev.filter(l => l.id !== id));

  const updateLent = (id: string, field: keyof LentConfig, value: any) => {
    setLents(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const toggleClass = (lentId: string, cls: string) => {
    setLents(prev => prev.map(l => {
      if (l.id !== lentId) return l;
      const has = l.parallelClasses.includes(cls);
      return { ...l, parallelClasses: has ? l.parallelClasses.filter(c => c !== cls) : [...l.parallelClasses, cls] };
    }));
  };

  const handleGroupsChange = (lentId: string, count: number) => {
    setLents(prev => prev.map(l => {
      if (l.id !== lentId) return l;
      const groupNames = Array.from({ length: count }, (_, i) => LEVEL_PRESETS[i] ?? `Группа ${i + 1}`);
      const teachers   = Array.from({ length: count }, (_, i) => l.teachers[i] ?? "");
      const rooms      = Array.from({ length: count }, (_, i) => l.rooms[i]    ?? "");
      return { ...l, groups: count, groupNames, teachers, rooms };
    }));
  };

  const handleSave = () => {
    saveLents(lents);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Info card */}
      <div className="bg-purple-50 dark:bg-purple-950/30 rounded-2xl border border-purple-200 dark:border-purple-900/50 p-5 flex items-start gap-4">
        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h3 className="font-black text-purple-900 dark:text-purple-300 text-sm uppercase tracking-widest mb-1">Что такое «Лента»?</h3>
          <p className="text-xs text-purple-700 dark:text-purple-400 leading-relaxed">
            «Лента» — сингапурская методика: параллельные классы (напр. 7А, 7Б, 7В) одновременно
            снимаются с мест и делятся на <strong>группы по уровню знания языка</strong>.
            Генератор жёстко бронирует один слот сразу для всех кабинетов и учителей этой ленты,
            блокируя возможность поставить другой урок в это время для учеников этой параллели.
          </p>
        </div>
      </div>

      {/* Lent cards */}
      {lents.map((lent, lentIdx) => (
        <div key={lent.id} className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
          {/* Card header */}
          <div className="flex items-center justify-between p-5 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border-b border-purple-100 dark:border-purple-900/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center shadow">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">Лента #{lentIdx + 1}</p>
                <input
                  value={lent.subject}
                  onChange={e => updateLent(lent.id, "subject", e.target.value)}
                  className="font-black text-gray-900 dark:text-white text-sm bg-transparent outline-none border-b border-transparent focus:border-purple-400 transition-all"
                />
              </div>
            </div>
            <button onClick={() => removeLent(lent.id)} className="text-gray-400 hover:text-red-500 transition-colors p-2">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Step 1: select classes */}
            <div>
              <label className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2 block">
                1. Параллельные классы
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_CLASSES.map(cls => (
                  <button
                    key={cls}
                    onClick={() => toggleClass(lent.id, cls)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border ${
                      lent.parallelClasses.includes(cls)
                        ? "bg-purple-600 text-white border-purple-500 shadow"
                        : "bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:border-purple-400 hover:text-purple-600"
                    }`}
                  >
                    {cls}
                  </button>
                ))}
              </div>
              {lent.parallelClasses.length > 0 && (
                <p className="text-xs text-purple-600 dark:text-purple-400 font-bold mt-2">
                  ✓ {lent.parallelClasses.join(", ")} — {lent.parallelClasses.length} кл. / ~{lent.parallelClasses.length * 25} учеников
                </p>
              )}
            </div>

            {/* Step 2: groups count */}
            <div>
              <label className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2 block">
                2. Количество уровневых групп
              </label>
              <div className="flex gap-2">
                {[2,3,4,5].map(n => (
                  <button
                    key={n}
                    onClick={() => handleGroupsChange(lent.id, n)}
                    className={`w-10 h-10 rounded-xl font-black text-sm transition-all border ${
                      lent.groups === n
                        ? "bg-purple-600 text-white border-purple-500 shadow"
                        : "bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-purple-400"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: fixed slot */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2 block">
                  3. Фиксированный день
                </label>
                <select
                  value={lent.fixedDay}
                  onChange={e => updateLent(lent.id, "fixedDay", e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-purple-500 transition-all"
                >
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2 block">
                  Фиксированное время
                </label>
                <select
                  value={lent.fixedTime}
                  onChange={e => updateLent(lent.id, "fixedTime", e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-purple-500 transition-all"
                >
                  {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Step 4: groups details */}
            <div>
              <label className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-3 block">
                4. Группы → Учителя / Кабинеты
              </label>
              <div className="space-y-2">
                {Array.from({ length: lent.groups }).map((_, gi) => (
                  <div key={gi} className="grid grid-cols-[1fr_1.5fr_1fr] gap-2 items-center">
                    <div className="bg-purple-600 text-white rounded-xl px-3 py-2 text-xs font-black text-center">
                      {lent.groupNames[gi] ?? `Группа ${gi + 1}`}
                    </div>
                    <input
                      placeholder="Учитель"
                      value={lent.teachers[gi] ?? ""}
                      onChange={e => {
                        const teachers = [...lent.teachers];
                        teachers[gi] = e.target.value;
                        updateLent(lent.id, "teachers", teachers);
                      }}
                      className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-purple-500 transition-all"
                    />
                    <input
                      placeholder="Кабинет"
                      value={lent.rooms[gi] ?? ""}
                      onChange={e => {
                        const rooms = [...lent.rooms];
                        rooms[gi] = e.target.value;
                        updateLent(lent.id, "rooms", rooms);
                      }}
                      className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-purple-500 transition-all"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl p-3 flex items-center gap-3 border border-indigo-100 dark:border-indigo-900/40">
              <Info className="w-4 h-4 text-indigo-500 flex-shrink-0" />
              <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                При генерации: <strong>{lent.fixedDay} {lent.fixedTime}</strong> будет заблокирован для всех классов{" "}
                {lent.parallelClasses.slice(0,3).join(", ")}{lent.parallelClasses.length > 3 ? "..." : ""} — {lent.groups} групп параллельно.
              </p>
            </div>
          </div>
        </div>
      ))}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={addLent}
          className="flex items-center gap-2 px-5 py-3 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-purple-100 transition-all"
        >
          <Plus className="w-4 h-4" /> Добавить ленту
        </button>
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
            saved ? "bg-emerald-500 text-white" : "bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20"
          }`}
        >
          {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Сохранено!" : "Сохранить ленты"}
        </button>
      </div>
    </div>
  );
}
