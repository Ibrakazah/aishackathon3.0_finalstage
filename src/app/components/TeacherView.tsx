import React, { useState, useEffect } from "react";
import { User, Calendar, BookOpen, MapPin, Search, Sparkles, Loader2 } from "lucide-react";
import { fetchActiveSchedule, fetchTeachersList } from "../services/scheduleService";

const DAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница"];
const TIME_SLOTS = [
  "08:00-08:45", "09:05-09:50", "10:10-10:55", "11:00-11:45", "11:50-12:35",
  "13:05-13:50", "14:20-15:00", "15:05-15:45", "16:00-16:45", "16:45-17:30",
];

export function TeacherView() {
  const [teachers, setTeachers] = useState<string[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
  const [scheduleData, setScheduleData] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const [tList, sData] = await Promise.all([
          fetchTeachersList(),
          fetchActiveSchedule()
        ]);
        setTeachers(tList);
        setScheduleData(sData);
        if (tList.length > 0) setSelectedTeacher(tList[0]);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const getTeacherLessons = (teacher: string) => {
    const lessons: Record<string, Record<string, any>> = {};
    DAYS.forEach(d => {
      lessons[d] = {};
      TIME_SLOTS.forEach(t => lessons[d][t] = null);
    });

    Object.entries(scheduleData).forEach(([cls, days]: [string, any]) => {
      Object.entries(days).forEach(([day, slots]: [string, any]) => {
        Object.entries(slots).forEach(([time, cell]: [string, any]) => {
          if (cell.teacher) {
            const t1 = cell.teacher.toLowerCase().replace(/\s/g, '');
            const t2 = teacher.toLowerCase().replace(/\s/g, '');
            
            // Если одно имя содержит другое (частичное совпадение) 
            // или если фамилии совпадают (первое слово)
            const surname1 = cell.teacher.split(' ')[0].toLowerCase();
            const surname2 = teacher.split(' ')[0].toLowerCase();

            if (t1.includes(t2) || t2.includes(t1) || (surname1.length > 3 && surname1 === surname2)) {
              lessons[day][time] = { ...cell, class: cls };
            }
          }
        });
      });
    });
    return lessons;
  };

  const currentLessons = selectedTeacher ? getTeacherLessons(selectedTeacher) : null;

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[400px]">
       <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header & Selector */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-xl border border-gray-100 dark:border-slate-800 transition-all">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/30 text-white">
              <User className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Расписание учителей</h1>
              <p className="text-sm text-gray-500 dark:text-slate-400 font-medium mt-1">Персональный план занятий для каждого преподавателя</p>
            </div>
          </div>

          <div className="w-full md:w-80 relative group">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            <select
              value={selectedTeacher || ""}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-2xl text-base font-black outline-none focus:ring-4 focus:ring-blue-500/20 transition-all dark:text-white appearance-none cursor-pointer"
            >
              <option value="" disabled>Выберите учителя...</option>
              {teachers.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Schedule Grid */}
      {selectedTeacher && currentLessons ? (
        <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl border border-gray-100 dark:border-slate-800 overflow-hidden transition-all">
          <div className="overflow-x-auto p-6">
            <table className="w-full border-separate border-spacing-2">
              <thead>
                <tr>
                  <th className="w-24 p-4 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-slate-600">Время</th>
                  {DAYS.map(day => (
                    <th key={day} className="p-4 bg-gray-50 dark:bg-slate-950/50 rounded-2xl text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 border border-gray-100 dark:border-slate-800">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map(time => (
                  <tr key={time}>
                    <td className="p-4 text-center font-bold text-xs text-gray-400 dark:text-slate-500 bg-gray-50/30 dark:bg-slate-950/10 rounded-xl border border-transparent">
                      {time}
                    </td>
                    {DAYS.map(day => {
                      const lesson = currentLessons[day][time];
                      return (
                        <td key={day} className="p-1 min-w-[160px] h-28">
                          {lesson ? (
                            <div className="h-full bg-gradient-to-br from-white to-blue-50 dark:from-slate-800 dark:to-indigo-900/20 border border-blue-100 dark:border-indigo-800/50 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-center gap-2 group">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-black rounded-lg shadow-sm">{lesson.class}</span>
                                {lesson.isLent && <Sparkles className="w-3 h-3 text-amber-500" />}
                              </div>
                              <h4 className="font-black text-gray-900 dark:text-white text-sm leading-tight line-clamp-2">{lesson.subject}</h4>
                              <div className="flex items-center gap-1.5 text-gray-400 dark:text-slate-400 mt-1">
                                <MapPin className="w-3 h-3" />
                                <span className="text-[10px] font-bold uppercase">{lesson.room}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="h-full border-2 border-dashed border-gray-100 dark:border-slate-800/40 rounded-2xl flex items-center justify-center opacity-40">
                              <span className="text-[10px] font-black uppercase tracking-widest text-gray-300 dark:text-slate-700">Окно</span>
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
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] py-24 text-center border-2 border-dashed border-gray-200 dark:border-slate-800">
           <BookOpen className="w-16 h-16 text-gray-200 dark:text-slate-700 mx-auto mb-4" />
           <p className="text-gray-400 font-bold">Выберите учителя для просмотра расписания</p>
        </div>
      )}
    </div>
  );
}

export default TeacherView;
