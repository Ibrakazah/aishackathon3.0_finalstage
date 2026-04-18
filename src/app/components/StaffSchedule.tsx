import React, { useState, useEffect } from "react";
import { useParams } from "react-router";
import { Calendar, User, Clock, CheckCircle2, AlertTriangle, Shield, Wrench } from "lucide-react";
import { REAL_SCHEDULE_DATA } from "../data/realScheduleData";

const DAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница"];
const TIME_SLOTS = [
  "08:00-08:45", "09:05-09:50", "10:10-10:55", "11:00-11:45", "11:50-12:35",
  "13:05-13:50", "14:20-15:00", "15:05-15:45", "16:00-16:45", "16:45-17:30",
];

export function StaffSchedule() {
  const { name } = useParams<{ name: string }>();
  const decodedName = name ? decodeURIComponent(name) : "Сотрудник";
  const [tasks, setTasks] = useState<any[]>([]);

  // 1. Извлекаем уроки для данного сотрудника из базы
  const mySchedule: Record<string, Record<string, any>> = {};
  
  DAYS.forEach(day => {
    mySchedule[day] = {};
    TIME_SLOTS.forEach(time => {
      mySchedule[day][time] = null;
    });
  });

  Object.entries(REAL_SCHEDULE_DATA).forEach(([classKey, days]) => {
    Object.entries(days).forEach(([day, slots]) => {
      Object.entries(slots).forEach(([time, cell]) => {
        if (cell.teacher && cell.teacher.includes(decodedName)) {
           // Если в один слот попадает несколько уроков (например, лента), сохраняем первый или комбинируем
           mySchedule[day][time] = {
             subject: cell.subject,
             room: cell.room,
             class: classKey,
             isSubstitute: cell.isSubstitute
           };
        }
      });
    });
  });

  // 2. Fetch ИИ-задач для персонала (Симуляция интеграции)
  useEffect(() => {
    fetch('/api/ai-tasks')
      .then(res => res.json())
      .then(data => {
         // Фильтруем задачи, которые могут относиться к этому сотруднику
         // Например, завхоз видит задачи по ремонту, охранник - по безопасности
         const relevantTasks = data.filter((t: any) => {
            if (decodedName.toLowerCase().includes("охрана") || decodedName.toLowerCase().includes("қарабай") || decodedName.toLowerCase().includes("аділов")) {
               return t.task_text.toLowerCase().includes("охран") || t.task_text.toLowerCase().includes("посторон");
            }
            if (decodedName.toLowerCase().includes("завхоз") || decodedName.toLowerCase().includes("тех")) {
               return t.task_text.toLowerCase().includes("сломал") || t.task_text.toLowerCase().includes("ремонт") || t.task_text.toLowerCase().includes("сантех");
            }
            return false;
         });
         setTasks(relevantTasks);
      })
      .catch(console.error);
  }, [decodedName]);

  const isTeacher = !decodedName.toLowerCase().includes("охран") && !decodedName.toLowerCase().includes("завхоз");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 transition-colors duration-500">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
               {isTeacher ? <User className="w-8 h-8 text-white" /> : 
                decodedName.toLowerCase().includes("охран") ? <Shield className="w-8 h-8 text-white" /> : 
                <Wrench className="w-8 h-8 text-white" />}
            </div>
            <div>
              <p className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">{isTeacher ? "Преподаватель" : "Персонал"}</p>
              <h1 className="text-3xl font-black text-gray-900 dark:text-white mt-1">{decodedName}</h1>
            </div>
          </div>
          <div className="text-right">
             <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-bold rounded-xl border border-emerald-200 dark:border-emerald-800/50">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
               Статус: На смене
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* LEFT: GRID */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-slate-800">
              <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-3">
                <Calendar className="w-5 h-5 text-blue-500" />
                Персональное расписание
              </h2>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-slate-950/50 text-gray-400 dark:text-slate-500 text-[10px] uppercase tracking-widest font-black">
                      <th className="p-4 border-b border-r border-gray-100 dark:border-slate-800 w-24">Время</th>
                      {DAYS.map(d => <th key={d} className="p-4 border-b border-gray-100 dark:border-slate-800 w-1/5">{d}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {TIME_SLOTS.map((time, idx) => (
                      <tr key={time} className="group hover:bg-blue-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-4 border-b border-r border-gray-100 dark:border-slate-800 text-center font-bold text-xs text-gray-400 dark:text-slate-500">
                           {time}
                        </td>
                        {DAYS.map(day => {
                          const cell = mySchedule[day][time];
                          return (
                            <td key={day} className="p-3 border-b border-gray-100 dark:border-slate-800 relative h-20">
                              {cell ? (
                                <div className="bg-blue-50 dark:bg-indigo-900/30 border border-blue-100 dark:border-indigo-800/50 rounded-xl p-3 h-full flex flex-col justify-center items-center shadow-sm">
                                   <span className="font-black text-blue-900 dark:text-blue-100 text-xs text-center leading-tight">{cell.subject}</span>
                                   <div className="flex items-center gap-2 mt-2">
                                     <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] font-bold text-blue-600 dark:text-blue-400 shadow-sm">{cell.class}</span>
                                     <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-black shadow-sm">{cell.room}</span>
                                   </div>
                                </div>
                              ) : (
                                <div className="h-full flex items-center justify-center">
                                  <span className="text-[10px] uppercase font-bold tracking-widest text-gray-300 dark:text-slate-700 group-hover:text-gray-400 dark:group-hover:text-slate-600 transition-colors">Окно</span>
                                </div>
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
          </div>

          {/* RIGHT: AI TASKS */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-gradient-to-b from-indigo-50 to-white dark:from-slate-900 dark:to-slate-900 rounded-3xl p-6 shadow-xl border border-indigo-100 dark:border-slate-800 h-full">
              <h2 className="text-sm font-black text-indigo-900 dark:text-indigo-400 uppercase tracking-widest mb-6 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-indigo-500" />
                Входящие задачи
              </h2>
              
              {tasks.length === 0 ? (
                <div className="text-center py-10">
                   <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-50" />
                   <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Нет новых задач</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tasks.map(t => (
                    <div key={t.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-red-100 dark:border-red-900/30 animate-in slide-in-from-right duration-300">
                      <div className="flex items-start justify-between mb-2">
                        <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg">High Priority</span>
                        <span className="text-[9px] font-bold text-gray-400">{new Date(t.created_at).toLocaleTimeString().slice(0, 5)}</span>
                      </div>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight mb-3">{t.task_text}</p>
                      <button className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95">Принять в работу</button>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
