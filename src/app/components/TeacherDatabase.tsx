import { useState } from "react";
import { Users, Search, BookOpen, GraduationCap, Phone, Mail, Award, MapPin, Calendar, Clock, Star, MoreHorizontal, UserPlus } from "lucide-react";

interface Teacher {
  id: string;
  name: string;
  subject: string;
  experience: number;
  category: "Высшая" | "Первая" | "Вторая" | "Педагог-эксперт" | "Педагог-исследователь";
  status: "active" | "lesson" | "vacation" | "sick";
  phone: string;
  email: string;
  classes: string[];
  attendance: string; // "98%", etc
}

const TEACHERS_DATA: Teacher[] = [
  { id: "T1", name: "Ахметова Гульнара", subject: "Математика", experience: 15, category: "Педагог-исследователь", status: "lesson", phone: "+7 (701) 555-10-20", email: "akhmetova@aqbobek.kz", classes: ["10A", "11B", "9C"], attendance: "99%" },
  { id: "T2", name: "Иванов Сергей", subject: "Физика", experience: 8, category: "Педагог-эксперт", status: "active", phone: "+7 (705) 333-44-55", email: "ivanov@aqbobek.kz", classes: ["11A", "10B"], attendance: "95%" },
  { id: "T3", name: "Касымова Алия", subject: "История", experience: 22, category: "Высшая", status: "active", phone: "+7 (777) 999-00-11", email: "kasymova@aqbobek.kz", classes: ["8A", "9A", "11C"], attendance: "100%" },
  { id: "T4", name: "Омаров Бауыржан", subject: "Информатика", experience: 5, category: "Вторая", status: "sick", phone: "+7 (702) 444-55-66", email: "omarov@aqbobek.kz", classes: ["7G", "8F"], attendance: "88%" },
  { id: "T5", name: "Жумагулова Дина", subject: "Биология", experience: 12, category: "Педагог-исследователь", status: "vacation", phone: "+7 (707) 111-22-33", email: "zhumagul@aqbobek.kz", classes: ["10C", "11A"], attendance: "97%" },
];

export function TeacherDatabase() {
  const [teachers, setTeachers] = useState<Teacher[]>(TEACHERS_DATA);
  const [search, setSearch] = useState("");

  const filtered = teachers.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.subject.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusColor = (status: Teacher["status"]) => {
    switch (status) {
      case "active": return "bg-emerald-500";
      case "lesson": return "bg-amber-500";
      case "sick": return "bg-rose-500";
      case "vacation": return "bg-blue-500";
      default: return "bg-gray-400";
    }
  };

  const getStatusLabel = (status: Teacher["status"]) => {
    switch (status) {
      case "active": return "Свободен";
      case "lesson": return "На уроке";
      case "sick": return "Болеет";
      case "vacation": return "В отпуске";
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-sm border border-gray-100 dark:border-slate-800">
        <div className="flex items-center gap-5">
           <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
             <GraduationCap className="w-8 h-8" />
           </div>
           <div>
             <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">База Учителей</h1>
             <p className="text-sm text-gray-500 font-medium">Реестр педагогического состава Aqbobek Lyceum</p>
           </div>
        </div>

        <div className="flex gap-4 w-full md:w-auto">
           <div className="relative flex-1 md:w-80">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
             <input 
               type="text" 
               placeholder="Поиск по ФИО или предмету..." 
               value={search}
               onChange={e => setSearch(e.target.value)}
               className="w-full pl-12 pr-6 py-4 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-sm text-gray-900 dark:text-white"
             />
           </div>
           <button className="p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg transition-all active:scale-95">
             <UserPlus className="w-6 h-6" />
           </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Всего педагогов", val: "42", icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Высшая категория", val: "18", icon: Star, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Средний стаж", val: "12 лет", icon: Clock, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Посещаемость", val: "97.4%", icon: Activity, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-gray-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{s.label}</p>
              <p className={`text-2xl font-black ${s.color} dark:text-white`}>{s.val}</p>
            </div>
            <div className={`w-12 h-12 ${s.bg} dark:bg-slate-800 rounded-2xl flex items-center justify-center ${s.color}`}>
              <s.icon className="w-6 h-6" />
            </div>
          </div>
        ))}
      </div>

      {/* Teachers List View */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {filtered.map((t) => (
          <div key={t.id} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-[2.5rem] p-8 hover:shadow-2xl transition-all group relative overflow-hidden">
            {/* Status light */}
            <div className={`absolute top-8 right-8 w-3 h-3 rounded-full ${getStatusColor(t.status)} shadow-lg shadow-current/50`}></div>
            
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8">
               <div className="relative">
                 <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[2rem] flex items-center justify-center text-white text-3xl font-black shadow-xl group-hover:rotate-6 transition-transform">
                   {t.name.split(" ").map(n => n[0]).join("")}
                 </div>
                 <div className="absolute -bottom-2 -right-2 bg-white dark:bg-slate-800 p-2 rounded-xl border border-gray-100 dark:border-slate-700 shadow-md">
                    <Award className="w-5 h-5 text-amber-500" />
                 </div>
               </div>

               <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{t.name}</h3>
                  </div>
                  <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-4 flex items-center justify-center sm:justify-start gap-2">
                    <BookOpen className="w-4 h-4" /> {t.subject}
                  </p>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-50 dark:bg-slate-950 p-3 rounded-xl border border-gray-100 dark:border-slate-800">
                      <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Категория</p>
                      <p className="text-xs font-bold text-gray-700 dark:text-slate-300">{t.category}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-slate-950 p-3 rounded-xl border border-gray-100 dark:border-slate-800">
                      <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Статус</p>
                      <p className="text-xs font-bold text-gray-700 dark:text-slate-300">{getStatusLabel(t.status)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-6">
                    {t.classes.map(c => (
                      <span key={c} className="px-3 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-[10px] font-black rounded-lg text-gray-600 dark:text-gray-400">
                        КЛАСС {c}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-50 dark:border-slate-800">
                    <a href={`tel:${t.phone}`} className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-50 dark:bg-slate-950 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl text-xs font-black uppercase tracking-widest text-gray-700 dark:text-white transition-all">
                      <Phone className="w-4 h-4" /> Позвонить
                    </a>
                    <button className="p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
                      <MoreHorizontal className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Reuse some icons if needed
function Activity(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 3.18a.25.25 0 0 0-.48 0L6.41 10.54a2 2 0 0 1-1.93 1.46H2" />
    </svg>
  )
}
