// Reports v2.1 — Bullying + Load + Nutrition + Timesheet
import React, { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Users, Award, BookOpen, FileText, Bot, FileCheck, Save, ShieldAlert, Clock } from "lucide-react";

const NUTRITION_TEMPLATE = `БЛАНК ГОСУДАРСТВЕННОГО УЧРЕЖДЕНИЯ
(Логотип школы, БИН, Адрес)

Исх. № {{ doc_number }}
от «{{ current_date }}» г.

Руководителю Управления образования
{{ region_name }}

ИНФОРМАЦИОННАЯ СПРАВКА
о фактическом обеспечении горячим питанием обучающихся

Настоящим администрация {{ school_name }} предоставляет отчетные данные по организации питания за {{ report_period }}.

В соответствии с планом мероприятий по реализации программы «Фонд Всеобуча», на отчетную дату «{{ current_day }}», ситуация по контингенту выглядит следующим образом:

Общий охват: Количество обучающихся, имеющих право на бесплатное питание — {{ total_vseobuch_count }} человек.

Фактическая явка: Сегодня фактически обеспечены питанием — {{ actual_fed_count }} человек.

Мониторинг отсутствующих: * Общее количество отсутствующих льготников: {{ absent_count }}.

Из них по болезни: {{ sick_count }};

По иным уважительным причинам (олимпиады, соревнования): {{ competition_count }}.

Финансовый контроль: Сумма освоенных бюджетных средств за текущий день составила {{ daily_budget_spent }} тенге (исходя из стоимости одной порции {{ price_per_meal }} тенге).

Важные показатели системы контроля (Compliance):
По данным автоматизированной системы учета «AQBOBEK AI», расхождений между данными классных руководителей и фактическим выходом порций в столовой не зафиксировано. Санитарные нормы соблюдены. Все отсутствующие лица подтверждены документально в базе данных школы.

Директор {{ school_name }} ___________________ / {{ director_name }} /`;

const TIMESHEET_TEMPLATE = `ТАБЕЛЬ ОБЛІКУ РОБОЧОГО ЧАСУ (УЧЕТА РАБОЧЕГО ВРЕМЕНИ)
(Логотип школы, БИН, Адрес)

Исх. № {{ doc_number }}
от «{{ current_date }}» г.

Отдел кадров / Бухгалтерия
{{ school_name }}

ОТЧЕТ О ФАКТИЧЕСКИ ОТРАБОТАННОМ ВРЕМЕНИ

За отчетный период: {{ report_period }}
ФИО сотрудника: {{ target_teacher }}
Должность: Преподаватель

Учет рабочего времени:
Базовая ставка (по тарификации): {{ base_hours }} нормочасов
Фактически отработанно часов: {{ actual_hours }} часов

По данным системы «AQBOBEK AI», расхождений с журналом не выявлено.
Все сверхчасы подтверждены автоматическим логом расписания.

Директор {{ school_name }} ___________________ / {{ director_name }} /`;

const TEACHER_LOAD_TEMPLATE = `УТВЕРЖДАЮ
Директор {{ school_name }}
___________________ / {{ director_name }} /
«{{ current_date }}» г.

ПЛАН УЧЕБНОЙ НАГРУЗКИ ПЕДАГОГИЧЕСКОГО СОСТАВА
на {{ report_period }}

| ФИО Учителя | Предмет | Классы (Часы) | Итого часовой нагрузки |
|-------------|---------|---------------|-------------------------|
{{ load_table_rows }}

Система контроля: Данная нагрузка сформирована на основе матрицы расписания AQBOBEK AI и соответствует нормам тарификации.`;

const BULLYING_TEMPLATE = `СЛУЖЕБНАЯ ЗАПИСКА (КОНФИДЕНЦИАЛЬНО)
Кому: Школьному психологу
От: Системы мониторинга AQBOBEK AI
Дата: «{{ current_date }}» г.

ОТЧЕТ ПО СЛУЧАЯМ БУЛЛИНГА
(За отчетный период: {{ report_period }})

Настоящим сообщаем, что за указанный период в системе зафиксировано {{ bullying_count }} инцидентов, квалифицированных как буллинг/конфликтные ситуации.

ДАННЫЕ ПОСЛЕДНЕГО ИНЦИДЕНТА:
* Статус: Зафиксировано уведомление
* Рекомендация ИИ: Провести индивидуальную беседу с участниками конфликта в течение 24 часов.
* Ответственное лицо: Школьный психолог.

Итоговая статистика по школе:
Общее количество случаев за год: {{ total_bullying_cases }}

Система контроля: Данные сформированы на основе анонимных обращений и анализа эмоционального климата.`;

import { TEACHER_ASSIGNMENTS } from "../data/teacherAssignments";

export function Reports() {
  const pendingReportTopic = sessionStorage.getItem("pendingReportTopic");
  
  const [activeTab, setActiveTab] = useState<"analytics" | "ai_reports">("ai_reports");
  const [reportType, setReportType] = useState<"nutrition" | "timesheet" | "load" | "bullying">(
    pendingReportTopic === "Табель рабочего времени" ? "timesheet" : "nutrition"
  );
  
  const getInitialTemplate = (type: string) => {
    if (type === "timesheet") return TIMESHEET_TEMPLATE;
    if (type === "load") return TEACHER_LOAD_TEMPLATE;
    if (type === "bullying") return BULLYING_TEMPLATE;
    return NUTRITION_TEMPLATE;
  };
  
  const [bullyingCount, setBullyingCount] = React.useState(() => {
    return parseInt(localStorage.getItem("school_bullying_cases") || "12");
  });

  React.useEffect(() => {
    const handleBullying = () => {
       const newCount = parseInt(localStorage.getItem("school_bullying_cases") || "12");
       setBullyingCount(newCount);
    };
    window.addEventListener("bullying-incident", handleBullying);
    return () => window.removeEventListener("bullying-incident", handleBullying);
  }, []);

  const [template, setTemplate] = useState(getInitialTemplate(reportType));
  const [aiState, setAiState] = useState<"idle" | "asking" | "generating" | "done">("idle");
  
  // Fields for Nutrition
  const [sickCount, setSickCount] = useState("");
  const [compCount, setCompCount] = useState("");
  
  // Fields for Timesheet
  const [teacherName, setTeacherName] = useState("");
  const [teacherHours, setTeacherHours] = useState("");

  const [generatedReport, setGeneratedReport] = useState<string | null>(null);

  const performanceData = [
    { month: "Сен", grade: 4.2 },
    { month: "Окт", grade: 4.3 },
    { month: "Ноя", grade: 4.1 },
    { month: "Дек", grade: 4.4 },
    { month: "Янв", grade: 4.3 },
    { month: "Фев", grade: 4.5 },
    { month: "Мар", grade: 4.6 },
    { month: "Апр", grade: 4.5 },
  ];

  const subjectPerformance = [
    { subject: "Математика", score: 85 },
    { subject: "Русский", score: 88 },
    { subject: "Физика", score: 82 },
    { subject: "Химия", score: 79 },
    { subject: "История", score: 91 },
    { subject: "Англ. яз", score: 86 },
  ];

  const attendanceData = [
    { name: "Присутствовали", value: 450, color: "#10b981" },
    { name: "Отсутствовали", value: 35, color: "#f59e0b" },
    { name: "По уваж. причине", value: 15, color: "#3b82f6" },
  ];

  const handleConfirmData = () => {
    if (reportType === "timesheet") {
       if (!teacherName || !teacherHours) return;
    } else if (reportType === "nutrition") {
       if (!sickCount || !compCount) return;
    }
    
    setAiState("generating");
    setGeneratedReport(null);
    
    setTimeout(() => {
      const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
      const activeTemplate = getInitialTemplate(reportType);
      let result = activeTemplate
        .replace(/\{\{\s*doc_number\s*\}\}/g, "145/2-A")
        .replace(/\{\{\s*current_date\s*\}\}/g, today)
        .replace(/\{\{\s*school_name\s*\}\}/g, "AQBOBEK LYCEUM")
        .replace(/\{\{\s*director_name\s*\}\}/g, "Иванов А.П.")
        .replace(/\{\{\s*report_period\s*\}\}/g, "апрель 2026 года");

      if (reportType === "timesheet") {
         result = result
           .replace(/\{\{\s*target_teacher\s*\}\}/g, teacherName)
           .replace(/\{\{\s*base_hours\s*\}\}/g, "120")
           .replace(/\{\{\s*actual_hours\s*\}\}/g, teacherHours);
      } else if (reportType === "load") {
          const rows = TEACHER_ASSIGNMENTS.map(t => {
              const subjectsStr = Object.entries(t.subjects).map(([subj, classes]) => {
                  const clsStr = Object.entries(classes as any).map(([cls, hrs]) => `${cls}: ${hrs}ч`).join(", ");
                  return `${subj} (${clsStr})`;
              }).join("; ");
              return `| ${t.name} | ${Object.keys(t.subjects).join(", ")} | ${subjectsStr} | ${t.weekly_hours} ч. |`;
          }).join("\n");
          result = result.replace(/\{\{\s*load_table_rows\s*\}\}/g, rows);
      } else if (reportType === "bullying") {
          // ═══ Подстановка данных по буллингу ═══
          result = result
            .replace(/\{\{\s*bullying_count\s*\}\}/g, "1")
            .replace(/\{\{\s*total_bullying_cases\s*\}\}/g, bullyingCount.toString());
      } else {
         const totalVseobuch = 250;
         const sick = parseInt(sickCount) || 0;
         const comp = parseInt(compCount) || 0;
         const absent = sick + comp;
         const actualFed = totalVseobuch - absent;
         const price = 750;
         const budgetSpent = actualFed * price;

         result = result
           .replace(/\{\{\s*region_name\s*\}\}/g, "Актюбинской области")
           .replace(/\{\{\s*current_day\s*\}\}/g, today)
           .replace(/\{\{\s*total_vseobuch_count\s*\}\}/g, totalVseobuch.toString())
           .replace(/\{\{\s*absent_count\s*\}\}/g, absent.toString())
           .replace(/\{\{\s*sick_count\s*\}\}/g, sick.toString())
           .replace(/\{\{\s*competition_count\s*\}\}/g, comp.toString())
           .replace(/\{\{\s*actual_fed_count\s*\}\}/g, actualFed.toString())
           .replace(/\{\{\s*price_per_meal\s*\}\}/g, price.toString())
           .replace(/\{\{\s*daily_budget_spent\s*\}\}/g, budgetSpent.toLocaleString('ru-RU'));
      }

      setGeneratedReport(result);
      setAiState("done");
      sessionStorage.removeItem("pendingReportTopic");

    }, 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Отчеты</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 font-medium">Аналитика и генерация справок</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              const current = parseInt(localStorage.getItem("school_bullying_cases") || "12");
              const next = current + 1;
              localStorage.setItem("school_bullying_cases", next.toString());
              
              // Trigger notification
              window.dispatchEvent(
                new CustomEvent("ai-notification", {
                  detail: {
                    type: "warning",
                    title: "⚠️ СИГНАЛ: ШКОЛЬНЫЙ БУЛЛИНГ",
                    message: "Зафиксирован инцидент в 8Д классе. Психологу назначена задача.",
                    route: "/reports",
                    sectionName: "Безопасность",
                    confidence: 98,
                  },
                })
              );
              
              // Create a task
              const tasks = JSON.parse(localStorage.getItem("ai_delegate_tasks") || "[]");
              tasks.push({
                id: Date.now().toString(),
                assignTo: "Психолог (Ахметова)",
                text: "Срочно провести беседу по случаю буллинга в 8Д классе",
                status: "sent"
              });
              localStorage.setItem("ai_delegate_tasks", JSON.stringify(tasks));

              window.dispatchEvent(new CustomEvent("bullying-incident"));
            }}
            className="flex items-center gap-2 px-4 py-2 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all border border-rose-200 dark:border-rose-900"
          >
            <ShieldAlert className="w-4 h-4" /> Симуляция инцидента
          </button>
          <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700">
            <button 
              onClick={() => setActiveTab("analytics")} 
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === "analytics" ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-md" : "text-gray-500 hover:text-gray-700 dark:hover:text-slate-300"}`}
            >
              <TrendingUp className="w-4 h-4" /> АНАЛИТИКА
            </button>
            <button 
              onClick={() => setActiveTab("ai_reports")} 
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === "ai_reports" ? "bg-white dark:bg-slate-900 text-green-600 dark:text-green-400 shadow-md" : "text-gray-500 hover:text-gray-700 dark:hover:text-slate-300"}`}
            >
              <Bot className="w-4 h-4" /> AI-ОТЧЕТЫ
            </button>
          </div>
        </div>
      </div>

      {activeTab === "analytics" && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          {/* Общая статистика */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-700 dark:from-blue-600 dark:to-indigo-800 p-6 rounded-2xl shadow-lg shadow-blue-500/20 text-white transition-all transform hover:scale-[1.02]">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Users className="w-6 h-6" />
                </div>
                <TrendingUp className="w-5 h-5 opacity-75" />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest opacity-90">Всего учеников</p>
              <p className="text-4xl font-black mt-1">500</p>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mt-2 bg-white/10 px-2 py-1 rounded inline-block">+12 с начала года</p>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-emerald-700 dark:from-green-600 dark:to-teal-800 p-6 rounded-2xl shadow-lg shadow-green-500/20 text-white transition-all transform hover:scale-[1.02]">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Award className="w-6 h-6" />
                </div>
                <TrendingUp className="w-5 h-5 opacity-75" />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest opacity-90">Средний балл</p>
              <p className="text-4xl font-black mt-1">4.5</p>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mt-2 bg-white/10 px-2 py-1 rounded inline-block">+0.2 за четверть</p>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-fuchsia-700 dark:from-purple-600 dark:to-fuchsia-800 p-6 rounded-2xl shadow-lg shadow-purple-500/20 text-white transition-all transform hover:scale-[1.02]">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <BookOpen className="w-6 h-6" />
                </div>
                <TrendingUp className="w-5 h-5 opacity-75" />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest opacity-90">Отличников</p>
              <p className="text-4xl font-black mt-1">87</p>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mt-2 bg-white/10 px-2 py-1 rounded inline-block">17.4% от всех</p>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-red-600 dark:from-orange-600 dark:to-red-800 p-6 rounded-2xl shadow-lg shadow-orange-500/20 text-white transition-all transform hover:scale-[1.02]">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <TrendingUp className="w-5 h-5 opacity-75" />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest opacity-90">Инциденты буллинга</p>
              <p className="text-4xl font-black mt-1">{bullyingCount}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mt-2 bg-white/10 px-2 py-1 rounded inline-block">Внимание: {bullyingCount > 10 ? 'Требуется контроль' : 'Норма'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 transition-colors">
              <h2 className="font-black text-gray-900 dark:text-white mb-6 uppercase tracking-widest text-xs">Динамика среднего балла</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#888888" opacity={0.2} />
                  <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis domain={[3.5, 5]} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                  <Line type="monotone" dataKey="grade" stroke="#3b82f6" strokeWidth={4} name="Средний балл" dot={{ strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 transition-colors">
              <h2 className="font-black text-gray-900 dark:text-white mb-6 uppercase tracking-widest text-xs">Успеваемость по предметам</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={subjectPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#888888" opacity={0.2} />
                  <XAxis dataKey="subject" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} cursor={{ fill: 'rgba(136, 136, 136, 0.1)' }} />
                  <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                  <Bar dataKey="score" fill="#8b5cf6" name="Средний результат %" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === "ai_reports" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-4 duration-700">
          
          {/* Левая панель - ИИ-Ассистент и взаимодействие */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 dark:from-slate-950 dark:to-black rounded-[2rem] p-8 shadow-2xl border border-indigo-500/20 relative overflow-hidden flex-1 flex flex-col min-h-[600px]">
              
              {/* Красивый декоративный эффект */}
              <div className="absolute -top-32 -right-32 w-64 h-64 bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none"></div>
              <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-blue-500/20 blur-[100px] rounded-full pointer-events-none"></div>

              <div className="flex items-center gap-4 mb-8 relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <Bot className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">AQBOBEK AI</h2>
                  <p className="text-sm font-medium text-indigo-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                    Ядро готово
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 relative z-10 pr-2 custom-scrollbar">
                {/* Сообщение 1: Приветствие */}
                <div className="bg-white/5 border border-white/10 p-5 rounded-2xl rounded-tl-sm backdrop-blur-md">
                  <p className="text-slate-200 text-sm leading-relaxed mb-4">
                    Выберите тип документа, который необходимо подготовить:
                  </p>
                  <div className="flex flex-col gap-2">
                    {[
                      { id: "nutrition", label: "Справка по питанию", icon: FileText },
                      { id: "timesheet", label: "Табель времени", icon: Clock },
                      { id: "load", label: "Учебная нагрузка (Hackathon)", icon: Users },
                      { id: "bullying", label: "Отчет по буллингу", icon: ShieldAlert }
                    ].map(t => (
                      <button 
                         key={t.id}
                         onClick={() => {
                            setReportType(t.id as any);
                            setTemplate(getInitialTemplate(t.id));
                            setAiState("idle");
                            setGeneratedReport(null);
                         }}
                         className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all border ${reportType === t.id ? 'bg-indigo-500 text-white border-indigo-400 shadow-lg shadow-indigo-500/30' : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'}`}
                      >
                         <t.icon className="w-4 h-4" />
                         {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {aiState === "idle" && (
                  <div className="animate-in fade-in zoom-in duration-500 delay-300 fill-mode-both">
                    <button 
                      onClick={() => {
                         if (reportType === "load" || reportType === "bullying") {
                            handleConfirmData(); // Jump straight to generating for load
                         } else {
                            setAiState("asking");
                         }
                      }}
                      className="w-full relative group overflow-hidden bg-indigo-600 hover:bg-indigo-500 text-white p-5 rounded-2xl transition-all flex items-center justify-between shadow-xl shadow-indigo-600/20"
                    >
                      <span className="font-black uppercase tracking-widest text-xs relative z-10">Сгенерировать документ</span>
                      <TrendingUp className="w-4 h-4 text-white relative z-10" />
                    </button>
                  </div>
                )}

                {/* Сообщение 2: Запрос данных */}
                {aiState === "asking" && (
                  <div className="bg-indigo-900/40 border border-indigo-500/30 p-5 rounded-2xl rounded-tl-sm backdrop-blur-md animate-in slide-in-from-left-4 duration-500">
                    <p className="text-indigo-100 text-sm leading-relaxed mb-4">
                      {reportType === "bullying"
                        ? "Зафиксирован инцидент. Уточните детали для служебной записки психологу:"
                        : <>Мне не хватает "живых" данных на сегодняшний день. База пока <span className="text-rose-400 font-bold">не синхронизирована</span>. <br/><br/>Пожалуйста, уточните вручную:</>
                      }
                    </p>
                    
                    <div className="space-y-4">
                      {reportType === "timesheet" ? (
                        <>
                          <div>
                            <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1 block">ФИО Преподавателя</label>
                            <input 
                              type="text" 
                              value={teacherName}
                              onChange={(e) => setTeacherName(e.target.value)}
                              disabled={aiState === "generating" || aiState === "done"}
                              className="w-full bg-black/50 border border-indigo-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all font-mono"
                              placeholder="Например, Аскар Ахметов"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1 block">Отработанно часов</label>
                            <input 
                              type="number" 
                              value={teacherHours}
                              onChange={(e) => setTeacherHours(e.target.value)}
                              disabled={aiState === "generating" || aiState === "done"}
                              className="w-full bg-black/50 border border-indigo-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all font-mono"
                              placeholder="Например, 134"
                            />
                          </div>
                        </>
                      ) : reportType === "bullying" ? (
                        <>
                          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
                            <p className="text-rose-300 text-xs font-bold uppercase tracking-widest mb-3">🛡️ Автоматически заполнено системой</p>
                            <div className="space-y-2 text-sm text-slate-300 font-mono">
                              <div>Инцидентов за период: <span className="text-white font-black">1</span></div>
                              <div>Всего за год: <span className="text-white font-black">{bullyingCount}</span></div>
                              <div>Ответственный: <span className="text-white font-black">Психолог (Ахметова)</span></div>
                            </div>
                          </div>
                          <p className="text-indigo-300/70 text-xs font-medium">Отчет будет сформирован автоматически. Дополнительных данных не требуется.</p>
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1 block">Отсутствуют по болезни</label>
                            <input 
                              type="number" 
                              value={sickCount}
                              onChange={(e) => setSickCount(e.target.value)}
                              disabled={aiState === "generating" || aiState === "done"}
                              className="w-full bg-black/50 border border-indigo-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all font-mono"
                              placeholder="Например, 12"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1 block">На соревнованиях/олимпиадах</label>
                            <input 
                              type="number" 
                              value={compCount}
                              onChange={(e) => setCompCount(e.target.value)}
                              disabled={aiState === "generating" || aiState === "done"}
                              className="w-full bg-black/50 border border-indigo-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all font-mono"
                              placeholder="Например, 3"
                            />
                          </div>
                        </>
                      )}

                      {aiState === "asking" && (
                        <button 
                          onClick={handleConfirmData}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-xs tracking-widest py-4 rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                        >
                          Сформировать отчет
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Сообщение 3: Идет базовая генерация */}
                {aiState === "generating" && (
                  <div className="bg-blue-900/30 border border-blue-500/30 p-5 rounded-2xl rounded-tl-sm backdrop-blur-md flex items-center gap-4 animate-in slide-in-from-left-4 duration-500">
                    <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                    <p className="text-blue-100 text-sm font-medium">Произвожу вычисления... Синтезирую документ по шаблону...</p>
                  </div>
                )}

                {/* Сообщение 4: Готово */}
                {aiState === "done" && (
                  <div className="bg-emerald-900/30 border border-emerald-500/30 p-5 rounded-2xl rounded-tl-sm backdrop-blur-md flex gap-4 animate-in slide-in-from-left-4 duration-500">
                    <FileCheck className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                    <div>
                      <p className="text-emerald-100 text-sm font-medium">Справка успешно сформирована!</p>
                      <p className="text-emerald-300/70 text-xs mt-1">Ошибок в логике бюджета не обнаружено. Можете проверить результат справа.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Правая панель - Шаблон и Превью */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Если мы еще не сгенерировали отчет, показываем редактор шаблона */}
            {aiState !== "done" && aiState !== "generating" && (
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-[2rem] p-8 shadow-xl flex flex-col flex-1 min-h-[600px] relative overflow-hidden transition-all duration-500 hover:shadow-2xl hover:border-blue-500/30">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-500" /> Шаблон: {reportType === "timesheet" ? "Учет времени" : reportType === "load" ? "Нагрузка" : reportType === "bullying" ? "Буллинг" : "Питание"}
                    </h3>
                  </div>
                  <button className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                    <Save className="w-4 h-4" /> Сохранить базу
                  </button>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/10 border-l-4 border-amber-500 p-4 rounded-r-xl mb-6">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 leading-relaxed">
                    Данный шаблон содержит теги <code className="bg-amber-200/50 dark:bg-amber-500/20 px-1 rounded">{"\{\{ var \}\}"}</code>. AI автоматически заменит их на вычислительные показатели или спросит у вас недостающие данные.
                  </p>
                </div>

                <textarea 
                  className="flex-1 w-full bg-gray-50 dark:bg-slate-950/50 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 text-[13px] font-mono text-gray-700 dark:text-slate-300 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none leading-relaxed custom-scrollbar"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  spellCheck={false}
                />
              </div>
            )}

            {/* Если идет генерация или готово - показываем результат */}
            {(aiState === "done" || aiState === "generating") && (
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-[2rem] shadow-xl overflow-hidden flex flex-col flex-1 min-h-[600px] animate-in zoom-in-95 duration-500 relative">
                
                {aiState === "generating" && (
                  <div className="absolute inset-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center">
                     <div className="w-20 h-20 border-4 border-indigo-100 dark:border-indigo-900/50 rounded-full flex items-center justify-center animate-pulse">
                        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                     </div>
                     <p className="mt-6 text-sm font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest animate-pulse">Компиляция документа...</p>
                  </div>
                )}

                <div className="bg-slate-50 border-b border-gray-200 dark:bg-slate-950 dark:border-slate-800 p-6 flex items-center justify-between z-10">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-emerald-500" /> Итоговый Документ
                  </h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        if (!generatedReport) return;
                        const formatForPrint = (text: string) => {
                          const lines = text.split('\n');
                          let html = '';
                          let inTable = false;
                          let isHeaderDone = false;
                          for (const line of lines) {
                            const trimmed = line.trim();
                            if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
                              const cells = trimmed.split('|').filter(c => c.trim() !== '');
                              if (cells.every(c => /^[\s\-:]+$/.test(c))) { isHeaderDone = true; continue; }
                              if (!inTable) { html += '<table>'; inTable = true; }
                              const tag = !isHeaderDone ? 'th' : 'td';
                              html += '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';
                            } else {
                              if (inTable) { html += '</table>'; inTable = false; isHeaderDone = false; }
                              if (trimmed === '') { html += '<br>'; }
                              else { html += `<p>${trimmed}</p>`; }
                            }
                          }
                          if (inTable) html += '</table>';
                          return html;
                        };
                        const printWindow = window.open('', '_blank');
                        if (!printWindow) return;
                        printWindow.document.write(`<html><head><title>Отчет — AQBOBEK AI</title>
                          <style>
                            body { font-family: 'Times New Roman', serif; font-size: 13px; line-height: 1.6; padding: 40px 50px; color: #111; }
                            p { margin: 2px 0; }
                            table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 11px; }
                            th, td { border: 1px solid #333; padding: 6px 10px; text-align: left; vertical-align: top; }
                            th { background: #e8e8e8; font-weight: bold; }
                            @media print { body { padding: 15px 30px; } }
                          </style></head>
                          <body>${formatForPrint(generatedReport)}</body></html>`);
                        printWindow.document.close();
                        setTimeout(() => printWindow.print(), 400);
                      }}
                      className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-emerald-200 dark:hover:bg-emerald-900/50 shadow-sm"
                    >
                      Скачать PDF
                    </button>
                    <button 
                      onClick={() => window.print()}
                      className="bg-gray-200 text-gray-700 dark:bg-slate-800 dark:text-slate-300 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-gray-300 dark:hover:bg-slate-700 shadow-sm"
                    >
                      Печать
                    </button>
                  </div>
                </div>

                <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-white dark:bg-black/20">
                  {generatedReport ? (
                    <div className="max-w-2xl mx-auto font-serif text-sm text-gray-800 dark:text-gray-300 leading-loose whitespace-pre-wrap">
                      {generatedReport}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
            
          </div>
        </div>
      )}
    </div>
  );
}

