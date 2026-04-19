import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Mic,
  Send,
  Sparkles,
  Loader2,
  Brain,
  ArrowRight,
  CheckCircle2,
  Zap,
  User,
  FileText,
  Hash,
  Target,
  AlertTriangle,
  ClipboardList,
  ShieldAlert,
} from "lucide-react";
import {
  parseDirectorCommand,
  type ParsedCommand,
} from "../utils/aiCommandParser";
import { processAiCommand } from "../services/gemini";
import { VoiceInput } from "./VoiceInput";

// ═══ Минимальный порог уверенности для выполнения разрушительных действий ═══
const MIN_CONFIDENCE_FOR_DESTRUCTIVE_ACTION = 60;

export function TaskDistribution() {
  const navigate = useNavigate();
  const [taskInput, setTaskInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedCommand | null>(null);
  const [phase, setPhase] = useState<
    "idle" | "analyzing" | "understood" | "navigating"
  >("idle");
  const [commandHistory, setCommandHistory] = useState<
    { result: ParsedCommand; time: string }[]
  >([]);
  const [activeTasks, setActiveTasks] = useState<{
    id: string;
    assignTo: string;
    text: string;
    status: "pending" | "sent";
  }[]>(() => {
    return JSON.parse(localStorage.getItem("ai_delegate_tasks") || "[]");
  });

  const [pendingConfirmation, setPendingConfirmation] = useState<ParsedCommand | null>(null);

  useEffect(() => {
    localStorage.setItem("ai_delegate_tasks", JSON.stringify(activeTasks));
  }, [activeTasks]);

  const handleSubmit = async () => {
    if (!taskInput.trim() || isProcessing) return;

    setIsProcessing(true);
    setPhase("analyzing");
    setParsedResult(null);

    try {
      // ═══ Фаза 1: Запрос к нейросети Gemini ═══
      const result = await processAiCommand(taskInput);

      setParsedResult({ ...result, engine: "AQBOBEK AI (Groq LPU)" } as any);
      setPhase("understood");

      // ═══ ВЫВОД В CONSOLE.LOG ═══
      console.log("\n" + "═".repeat(60));
      console.log("🧠 AQBOBEK AI — АНАЛИЗ ЗАВЕРШЕН");
      console.log("═".repeat(60));
      console.log(result.detailedUnderstanding);
      console.log(`\n📊 Уверенность: ${result.confidence}%`);
      console.log(`🔗 Целевой раздел: ${result.sectionName} (${result.route})`);
      console.log("═".repeat(60) + "\n");

      // Отправить уведомление в Layout
      window.dispatchEvent(
        new CustomEvent("ai-notification", {
          detail: {
            type: result.intent === "unknown" ? "warning" : "success",
            title: `AQBOBEK AI → ${result.sectionName}`,
            message: result.summary,
            route: result.route,
            sectionName: result.sectionName,
            confidence: result.confidence,
          },
        })
      );

      // ═══ ЗАЩИТА: Проверка порога уверенности перед разрушительными действиями ═══
      const isDestructiveAction = result.intent === "schedule" && (
        result.scheduleUpdate || result.teacherAbsence || result.scheduleMassDelete
      );

      if (isDestructiveAction && result.confidence < MIN_CONFIDENCE_FOR_DESTRUCTIVE_ACTION) {
        // Блокируем автоматическое выполнение, запрашиваем подтверждение
        console.warn(`⚠️ ЗАЩИТА: Уверенность ${result.confidence}% ниже порога ${MIN_CONFIDENCE_FOR_DESTRUCTIVE_ACTION}%. Действие заблокировано.`);
        setPendingConfirmation(result);
        window.dispatchEvent(
          new CustomEvent("ai-notification", {
            detail: {
              type: "warning",
              title: "⚠️ Действие заблокировано",
              message: `Уверенность ИИ (${result.confidence}%) слишком низка для автоматического изменения расписания. Требуется подтверждение директора.`,
              route: "/",
              sectionName: "Защита",
              confidence: result.confidence,
            },
          })
        );
        setIsProcessing(false);
        setPhase("idle");
        return;
      }

      // Отправляем событие изменения расписания (сохраняем в session, т.к. компонент Расписания еще не смонтирован)
      if (result.intent === "schedule") {
         if (result.scheduleUpdate && result.scheduleUpdate.className) {
            sessionStorage.setItem("pendingScheduleUpdate", JSON.stringify(result.scheduleUpdate));
         } else if (result.teacherAbsence) {
            sessionStorage.setItem("pendingTeacherAbsence", JSON.stringify(result.teacherAbsence));
            // ═══ СИНХРОНИЗАЦИЯ: Обновить статус учителя в Базе Персонала ═══
            window.dispatchEvent(new CustomEvent("staff-status-update", {
              detail: { name: result.teacherAbsence.absentTeacher, status: "absent", reason: "Больничный (ИИ-определение)" }
            }));
         } else if (result.scheduleMassDelete) {
            sessionStorage.setItem("pendingMassDelete", result.scheduleMassDelete);
            // ═══ СИНХРОНИЗАЦИЯ: Пометить учителя предмета как 'уволен/недоступен' ═══
            window.dispatchEvent(new CustomEvent("staff-status-update", {
              detail: { subject: result.scheduleMassDelete, status: "absent", reason: "Уволен/Выбыл (ИИ-определение)" }
            }));
         }
      }
      
      if (result.intent === "reports" && result.entities.topic) {
         sessionStorage.setItem("pendingReportTopic", result.entities.topic);
      }

      // Добавить в историю
      const now = new Date();
      const timeStr = now.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      });
      setCommandHistory((prev) => [{ result, time: timeStr }, ...prev]);

      // Подхватываем сгенерированные задачи (для Модуля 2: Voice-to-Task и экстремальных HR-кейсов)
      if (result.generatedTasks && result.generatedTasks.length > 0) {
         setActiveTasks((prev) => [...result.generatedTasks!, ...prev]);
      }

      // ═══ Фаза 2: Навигация ═══
      if (result.intent !== "unknown" && result.intent !== "tasks") {
        setTimeout(() => {
          setPhase("navigating");
          setTimeout(() => {
            navigate(result.route);
            setIsProcessing(false);
            setPhase("idle");
            setTaskInput("");
            setParsedResult(null);
          }, 600);
        }, 2000);
      } else {
        setTimeout(() => {
          setIsProcessing(false);
          setPhase("idle");
        }, 3000);
      }
    } catch (error) {
      console.error("AQBOBEK AI: Groq API недоступна, используем локальный парсер:", error);
      // Фолбек на локальный парсер если API недоступно
      const fallbackResult = parseDirectorCommand(taskInput);
      setParsedResult({ ...fallbackResult, engine: "AQBOBEK AI (Offline)" } as any);
      setPhase("understood");

      // Все равно отправляем уведомление
      window.dispatchEvent(
        new CustomEvent("ai-notification", {
          detail: {
            type: "warning",
            title: "AQBOBEK AI (Offline)",
            message: fallbackResult.summary,
            route: fallbackResult.route,
            sectionName: fallbackResult.sectionName,
            confidence: fallbackResult.confidence,
          },
        })
      );

      setTimeout(() => {
        if (fallbackResult.intent !== "unknown" && fallbackResult.intent !== "tasks") {
          navigate(fallbackResult.route);
        }
        setIsProcessing(false);
        setPhase("idle");
      }, 4000);
    }
  };

  // Теперь транскрибация идет через реальный бэкэнд
  const handleTranscriptionComplete = (text: string) => {
    setTaskInput(text);
    // После получения текста можно автоматически запустить обработку
    // Но лучше оставить на откуп директору для проверки
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Иконка для сущности
  const entityIcon = (key: string) => {
    switch (key) {
      case "teacherName":
        return <User className="w-3.5 h-3.5" />;
      case "reportNumber":
        return <Hash className="w-3.5 h-3.5" />;
      case "className":
        return <FileText className="w-3.5 h-3.5" />;
      case "topic":
        return <Target className="w-3.5 h-3.5" />;
      default:
        return <Zap className="w-3.5 h-3.5" />;
    }
  };

  // Человекочитаемое название сущности
  const entityLabel = (key: string) => {
    switch (key) {
      case "teacherName":
        return "Учитель";
      case "reportNumber":
        return "№ отчёта";
      case "className":
        return "Класс";
      case "topic":
        return "Тема";
      default:
        return key;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
            ИИ-Ассистент директора
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-2 max-w-2xl leading-relaxed">
            Отдавайте команды на естественном языке. Наш интеллект проанализирует запрос, 
            извлечёт данные и мгновенно перейдёт в нужный раздел для выполнения задачи.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
           <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
           <span className="text-xs font-black text-blue-700 dark:text-blue-300 uppercase tracking-widest">Система Активна</span>
        </div>
      </div>

      {/* Информационные карточки */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-[2rem] shadow-xl shadow-blue-500/20 text-white relative overflow-hidden group transition-all hover:scale-[1.02]">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Brain className="w-20 h-20" />
          </div>
          <div className="relative z-10">
            <h3 className="text-xs font-black uppercase tracking-widest opacity-80 mb-4">Интеграция системы</h3>
            <p className="text-4xl font-black mb-1">6</p>
            <p className="text-[10px] font-bold opacity-70 uppercase">Активных разделов навигации</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-600 to-fuchsia-700 p-6 rounded-[2rem] shadow-xl shadow-purple-500/20 text-white relative overflow-hidden group transition-all hover:scale-[1.02]">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Sparkles className="w-20 h-20" />
          </div>
          <div className="relative z-10">
            <h3 className="text-xs font-black uppercase tracking-widest opacity-80 mb-4">Обработка данных</h3>
            <p className="text-4xl font-black mb-1">{commandHistory.length}</p>
            <p className="text-[10px] font-bold opacity-70 uppercase">Команд в текущей сессии</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 rounded-[2rem] shadow-xl shadow-emerald-500/20 text-white relative overflow-hidden group transition-all hover:scale-[1.02]">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Zap className="w-20 h-20" />
          </div>
          <div className="relative z-10">
            <h3 className="text-xs font-black uppercase tracking-widest opacity-80 mb-4">Точность ИИ</h3>
            <p className="text-4xl font-black mb-1">
              {commandHistory.length > 0
                ? Math.round(
                  commandHistory.reduce(
                    (acc, c) => acc + c.result.confidence,
                    0
                  ) / commandHistory.length
                )
                : "—"}
              {commandHistory.length > 0 ? "%" : ""}
            </p>
            <p className="text-[10px] font-bold opacity-70 uppercase">Средняя уверенность модели</p>
          </div>
        </div>
      </div>

      {/* Главная форма ввода */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-slate-800 p-8 md:p-12 transition-colors duration-500">
        <div className="flex items-center gap-6 mb-10">
          <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="font-black text-gray-900 dark:text-white text-2xl uppercase tracking-tighter">
              Командный центр
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">
              ИИ-ассистент готов к работе. Опишите задачу, и мы её выполним.
            </p>
          </div>
        </div>

        {/* Поле ввода */}
        <div className="space-y-6">
          <div className="relative group">
            <textarea
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='Например: "Учитель Козлов заболел, замени его и обнови расписание"...'
              className="w-full h-52 px-6 py-6 border-2 border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-950 rounded-[2rem] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 dark:focus:border-blue-600 resize-none text-gray-900 dark:text-white placeholder-gray-400 transition-all text-lg font-medium shadow-inner"
              disabled={isProcessing}
            />
            {isRecording && (
              <div className="absolute top-6 right-6">
                <div className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest animate-pulse shadow-lg shadow-red-500/40">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  Слушаю...
                </div>
              </div>
            )}
          </div>

          {/* Кнопки действий */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full md:w-auto">
               <VoiceInput 
                 onTranscription={handleTranscriptionComplete} 
                 placeholder="Нажмите для голосового ввода..."
                 className="w-full md:w-auto scale-110"
               />
               <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest hidden lg:block">
                  Поддерживается русский и казахский языки
               </p>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isProcessing || !taskInput.trim()}
              className="w-full md:w-auto flex items-center justify-center gap-3 px-10 py-4 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-2xl font-black transition-all shadow-xl shadow-blue-500/25 disabled:opacity-50 disabled:grayscale uppercase tracking-widest text-xs active:scale-95"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Обработка...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Выполнить
                </>
              )}
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* Блок обработки ИИ */}
        {/* ═══════════════════════════════════════════ */}

        {/* Фаза: Анализ */}
        {phase === "analyzing" && (
          <div className="mt-10 p-8 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-100 dark:border-blue-900/30 rounded-3xl animate-pulse">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-3xl flex items-center justify-center shadow-xl">
                  <Brain className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-pulse" />
                </div>
                <div className="absolute -top-2 -right-2">
                  <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/50 rounded-xl flex items-center justify-center border-2 border-white dark:border-slate-800">
                    <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">
                  Квантовый анализ команды...
                </h3>
                <p className="text-sm text-gray-600 dark:text-slate-400 mb-4 font-medium">
                  Определяем намерение и извлекаем ключевые сущности для мгновенного выполнения.
                </p>
                <div className="h-2 bg-gray-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full w-2/3 shadow-[0_0_10px_rgba(37,99,235,0.5)]"></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Фаза: Понял */}
        {phase === "understood" && parsedResult && (
          <div
            className={`mt-10 p-8 rounded-[2rem] border-2 transition-all duration-500 scale-in-center ${parsedResult.intent === "unknown"
                ? "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/40"
                : "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/40"
              }`}
          >
            <div className="flex flex-col md:flex-row items-start gap-8">
              <div className="flex-shrink-0">
                <div
                  className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-xl ${parsedResult.intent === "unknown"
                      ? "bg-yellow-100 dark:bg-yellow-900/30"
                      : "bg-emerald-100 dark:bg-emerald-900/30"
                    }`}
                >
                  {parsedResult.intent === "unknown" ? (
                    <AlertTriangle className="w-10 h-10 text-yellow-600 dark:text-yellow-400" />
                  ) : (
                    <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  <h3 className="font-black text-gray-900 dark:text-white text-xl uppercase tracking-tighter">
                    {parsedResult.intent === "unknown"
                      ? "Требуется уточнение"
                      : "Команда распознана успешно"}
                  </h3>
                  <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${parsedResult.confidence >= 70
                        ? "bg-emerald-600 text-white"
                        : "bg-yellow-500 text-white"
                      }`}>
                    Точность: {parsedResult.confidence}%
                  </div>
                  <div className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-[10px] uppercase font-black tracking-widest">
                    {(parsedResult as any).engine || "AQBOBEK AI"}
                  </div>
                </div>

                <p className="text-gray-800 dark:text-slate-200 mb-6 text-xl font-bold leading-tight italic">
                  «{parsedResult.summary}»
                </p>

                {/* Сущности */}
                {Object.entries(parsedResult.entities).filter(([, val]) => val !== undefined).length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                    {Object.entries(parsedResult.entities)
                      .filter(([, val]) => val !== undefined)
                      .map(([key, val]) => (
                        <div key={key} className="bg-white/50 dark:bg-slate-900/50 p-3 rounded-2xl border border-white dark:border-slate-800 flex items-center gap-3 shadow-sm">
                           <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                             {entityIcon(key)}
                           </div>
                           <div>
                             <p className="text-[9px] font-black uppercase text-gray-400 dark:text-slate-500 tracking-widest">{entityLabel(key)}</p>
                             <p className="text-sm font-bold text-gray-900 dark:text-white">{val}</p>
                           </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* Переход */}
                {parsedResult.intent !== "unknown" && parsedResult.intent !== "tasks" && (
                  <div className="flex items-center gap-3 p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/30 animate-pulse">
                    <ArrowRight className="w-5 h-5 text-white" />
                    <span className="text-sm font-black text-white uppercase tracking-widest">
                      Переход в раздел: {parsedResult.sectionName}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Примеры команд */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-slate-800 p-8">
        <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-widest text-xs mb-6 px-2">
          Популярные запросы
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            "Учитель Козлов заболел, замени его и обнови расписание",
            "Покажи сводку сообщений от учителей за сегодня",
            "Подготовь отчет по посещаемости 9А класса",
            "Создай отчет номер 46 кто пришел и не ел",
            "Запланируй собрание с родительским комитетом",
            "Покажи новые предложения и жалобы от учителей",
          ].map((example, index) => (
            <button
              key={index}
              onClick={() => setTaskInput(example)}
              disabled={isProcessing}
              className="text-left p-5 bg-gray-50/50 dark:bg-slate-950/50 border border-gray-200 dark:border-slate-800 rounded-3xl hover:border-blue-500 dark:hover:border-blue-700 hover:bg-white dark:hover:bg-slate-900 transition-all group disabled:opacity-50"
            >
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                </div>
                <p className="text-[13px] font-bold text-gray-700 dark:text-slate-300 transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">{example}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* История */}
      {commandHistory.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-slate-800 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-950/50">
            <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-widest text-xs">
              История активности ({commandHistory.length})
            </h3>
            <div className="w-8 h-8 bg-white dark:bg-slate-800 rounded-lg flex items-center justify-center shadow-sm">
               <ClipboardList className="w-4 h-4 text-gray-400" />
            </div>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {commandHistory.slice(0, 5).map((item, index) => (
              <div
                key={index}
                className="p-6 hover:bg-blue-50/30 dark:hover:bg-blue-900/5 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 dark:text-slate-200 mb-2 truncate group-hover:text-blue-600 transition-colors">
                      {item.result.originalText}
                    </h4>
                    <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-slate-500">
                      <span className="flex items-center gap-2">
                        <Target className="w-3.5 h-3.5" />
                        {item.result.sectionName}
                      </span>
                      <span className="w-1 h-1 bg-gray-300 dark:bg-slate-700 rounded-full"></span>
                      <span>{item.time}</span>
                      <span className="w-1 h-1 bg-gray-300 dark:bg-slate-700 rounded-full"></span>
                      <span className={item.result.confidence >= 70 ? "text-emerald-500" : "text-yellow-500"}>
                        {item.result.confidence}%
                      </span>
                    </div>
                  </div>
                  <div className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm ${item.result.intent === "unknown"
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-500"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-500"
                      }`}>
                    {item.result.intent === "unknown" ? "Уточнение" : "Выполнено"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* КАНБАН ДОСКА / РАСПРЕДЕЛЕННЫЕ ЗАДАЧИ (Модуль 2) */}
      {activeTasks.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-[2.5rem] p-8 md:p-12 border border-dashed border-gray-300 dark:border-slate-800 animate-in slide-in-from-bottom-8 duration-700">
           <div className="flex items-center justify-between mb-8">
             <div>
               <h2 className="font-black text-gray-900 dark:text-white text-2xl uppercase tracking-tighter">Делегированные Задачи</h2>
               <p className="text-sm text-gray-500 dark:text-slate-400 font-medium mt-1">
                 Успешно распознано и распределено нейросетью: {activeTasks.length}
               </p>
             </div>
             <div className="px-4 py-2 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 font-bold uppercase tracking-widest text-xs rounded-xl flex items-center gap-2">
               <Zap className="w-4 h-4" /> AI Voice-to-Task
             </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeTasks.map((task, idx) => (
                 <div key={idx} className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-black/20 border border-gray-100 dark:border-slate-800 relative group transition-transform hover:-translate-y-1">
                    <div className="absolute top-6 right-6">
                       {task.status === "sent" ? (
                          <div className="flex items-center gap-1.5 text-xs font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full uppercase">
                             <CheckCircle2 className="w-3.5 h-3.5" /> Отправлено в Telegram
                          </div>
                       ) : (
                          <div className="flex items-center gap-1.5 text-xs font-black text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full uppercase">
                             <Loader2 className="w-3.5 h-3.5 animate-spin" /> В очереди
                          </div>
                       )}
                    </div>
                    <div className="flex items-center gap-4 mb-6 mt-8">
                       <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-full flex items-center justify-center text-white shadow-lg border-2 border-white dark:border-slate-800">
                          <User className="w-6 h-6" />
                       </div>
                       <div>
                          <p className="text-[10px] font-black uppercase text-gray-400 dark:text-slate-500 tracking-widest">Исполнитель</p>
                          <p className="font-bold text-gray-900 dark:text-white text-lg leading-none mt-1">{task.assignTo}</p>
                       </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-slate-950 p-4 rounded-2xl border border-gray-100 dark:border-slate-800">
                       <p className="text-sm font-medium text-gray-700 dark:text-slate-300">«{task.text}»</p>
                    </div>
                 </div>
              ))}
           </div>
        </div>
      )}

      {/* ═══ МОДАЛЬНОЕ ОКНО ПОДТВЕРЖДЕНИЯ ДЕЙСТВИЯ ═══ */}
      {pendingConfirmation && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] p-10 max-w-lg w-full border border-gray-200 dark:border-slate-800 relative overflow-hidden animate-in zoom-in duration-300">
            <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-amber-500 to-red-600"></div>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center">
                <ShieldAlert className="w-7 h-7 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Требуется подтверждение</h2>
                <p className="text-sm text-amber-600 dark:text-amber-400 font-bold">Уверенность ИИ: {pendingConfirmation.confidence}%</p>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 mb-6">
              <p className="text-sm font-medium text-gray-800 dark:text-slate-200 leading-relaxed">
                ИИ собирается выполнить <strong className="text-amber-700 dark:text-amber-400">разрушительное действие</strong> (изменение расписания), 
                но уровень уверенности ({pendingConfirmation.confidence}%) ниже минимального порога ({MIN_CONFIDENCE_FOR_DESTRUCTIVE_ACTION}%). 
              </p>
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-2 italic">«{pendingConfirmation.summary}»</p>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => {
                  // Принудительно выполнить
                  const result = pendingConfirmation;
                  if (result.scheduleUpdate && result.scheduleUpdate.className) {
                    sessionStorage.setItem("pendingScheduleUpdate", JSON.stringify(result.scheduleUpdate));
                  } else if (result.teacherAbsence) {
                    sessionStorage.setItem("pendingTeacherAbsence", JSON.stringify(result.teacherAbsence));
                  } else if (result.scheduleMassDelete) {
                    sessionStorage.setItem("pendingMassDelete", result.scheduleMassDelete);
                  }
                  setPendingConfirmation(null);
                  navigate(result.route);
                }}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white p-4 rounded-2xl font-black uppercase tracking-widest text-xs active:scale-95 transition-all shadow-xl shadow-amber-500/30"
              >
                Подтвердить и выполнить
              </button>
              <button 
                onClick={() => setPendingConfirmation(null)}
                className="flex-1 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 p-4 rounded-2xl font-black uppercase tracking-widest text-xs active:scale-95 transition-all hover:bg-gray-200 dark:hover:bg-slate-700"
              >
                Отменить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
