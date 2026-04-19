import { useState, useEffect } from "react";
import { Outlet, NavLink } from "react-router";
import { useTheme } from "next-themes";
import {
  ClipboardList,
  Calendar,
  MessageSquare,
  FileText,
  AlertCircle,
  CalendarDays,
  School,
  Bell,
  User,
  Users,
  Brain,
  X,
  ArrowRight,
  CheckCircle2,
  Sun,
  Moon,
  BookOpen,
  Wifi,
  WifiOff,
  Wand2,
  MessageCircle,
  Wrench
} from "lucide-react";
import { WhatsAppConnector } from "./WhatsAppConnector";
import { ChatBot } from "./ChatBot";
import { toast } from "sonner";

interface AINotification {
  id: number;
  title: string;
  message: string;
  route: string;
  sectionName: string;
  confidence: number;
  type: "success" | "warning";
  timestamp: number;
}

export function Layout() {
  const [notifications, setNotifications] = useState<AINotification[]>([]);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [waStatus, setWaStatus] = useState("disconnected");
  const [waPaused, setWaPaused] = useState(false);
  const [isWsConnected, setIsWsConnected] = useState(false);

  // Ожидаем монтирования для корректной работы темы (избегание гидратации)
  useEffect(() => {
    setMounted(true);
    
    // Первичная загрузка статуса (тихо игнорируем если бэкенд недоступен)
    fetch("http://localhost:8000/api/wa/status")
      .then(res => res.json())
      .then(data => {
        setWaStatus(data.status);
        setWaPaused(data.paused);
      })
      .catch(() => { /* backend not running, ignore silently */ });
  }, []);

  // WebSocket соединение (глобальное) с защитой от спама при отсутствии бэкенда
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempt = 0;
    let isClosed = false;

    function connect() {
      if (isClosed) return;
      try {
        ws = new WebSocket("ws://localhost:8000/ws");
      } catch {
        // WebSocket constructor failed (e.g. invalid URL) — don't spam
        return;
      }
      
      ws.onopen = () => {
        reconnectAttempt = 0;
        setIsWsConnected(true);
      };
      
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          
          if (payload.type === "WA_STATUS") {
            setWaStatus(payload.status);
          } else if (payload.type === "WA_PAUSED") {
            setWaPaused(payload.paused);
          } else if (payload.type === "NEW_MESSAGE") {
            window.dispatchEvent(new CustomEvent("new-message", { detail: payload.data }));
          } else if (payload.type === "NEW_AI_TASK") {
            window.dispatchEvent(new CustomEvent("ai-notification", { 
              detail: { 
                title: "Новая ИИ задача", 
                message: payload.data.proposed_action, 
                type: "success" 
              } 
            }));
          }
        } catch { /* ignore malformed messages */ }
      };
      
      ws.onclose = () => {
        setIsWsConnected(false);
        if (!isClosed) {
          // Exponential backoff: 2s, 4s, 8s, 16s, max 30s
          const delay = Math.min(2000 * Math.pow(2, reconnectAttempt), 30000);
          reconnectAttempt++;
          reconnectTimer = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        // Silently handle — onclose will fire after this
      };
    }

    connect();

    return () => {
      isClosed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  const handleWaLogout = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/wa/logout", { method: "POST" });
      const data = await res.json();
      if (data.status === 'logged_out' || data.ok) {
        setWaStatus("disconnected");
      }
    } catch (err) {
      console.error("Logout failed", err);
      throw err;
    }
  };

  const handleWaPauseToggle = async () => {
    try {
      const endpoint = waPaused ? "resume" : "pause";
      const res = await fetch(`http://localhost:8000/api/wa/${endpoint}`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setWaPaused(data.paused);
      }
    } catch (err) {
      console.error("Pause/resume failed", err);
      throw err;
    }
  };

  // Слушаем события ИИ-уведомлений
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { title, message, route, sectionName, confidence, type } =
        customEvent.detail;

      const notification: AINotification = {
        id: Date.now(),
        title,
        message,
        route,
        sectionName: sectionName || "",
        confidence,
        type: type || "success",
        timestamp: Date.now(),
      };

      setNotifications((prev) => [notification, ...prev.slice(0, 4)]);

      // Автоудаление через 10 секунд
      setTimeout(() => {
        setNotifications((prev) =>
          prev.filter((n) => n.id !== notification.id)
        );
      }, 10000);
    };

    window.addEventListener("ai-notification", handler);
    return () => window.removeEventListener("ai-notification", handler);
  }, []);

  const dismissNotification = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const menuItems = [
    { path: "/", label: "Расписание", icon: Calendar },
    { path: "/schedule-generator", label: "AI Генератор", icon: Wand2 },
    { path: "/chat-summary", label: "Сводка чата", icon: MessageSquare },
    { path: "/chat-bot", label: "Чат-бот", icon: MessageCircle },
    { path: "/reports", label: "Отчеты", icon: FileText },
    { path: "/calendar", label: "Календарь директора", icon: CalendarDays },
    { path: "/teacher-view", label: "Расписание учителей", icon: Users },
    { path: "/technician-view", label: "Кабинет техников", icon: Wrench },
  ];

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Левое боковое меню */}
      <aside className="w-72 bg-white dark:bg-slate-900 shadow-lg flex flex-col border-r border-gray-200 dark:border-slate-800 transition-colors duration-300">
        {/* Хедер с логотипом */}
        <div className="p-6 border-b border-gray-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <School className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-gray-900 dark:text-white tracking-tight">
                Панель управления
              </h1>
              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest">Aqbobek Lyceum</p>
            </div>
          </div>
        </div>

        {/* Навигационное меню */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === "/"}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                      isActive
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold"
                        : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400"
                    }`
                  }
                >
                  <item.icon className="w-5 h-5 transition-transform group-hover:scale-110" />
                  <span className="text-sm">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Информация пользователя внизу */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800/50">
            <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-700">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900 dark:text-white">Иванов А.П.</p>
              <p className="text-[10px] text-gray-500 dark:text-slate-400 uppercase tracking-widest font-black">Директор</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Основная область контента */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Верхняя панель */}
        <header className="bg-white dark:bg-slate-900 shadow-sm px-8 py-4 flex items-center justify-between border-b border-gray-200 dark:border-slate-800 transition-colors duration-300">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Добро пожаловать
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">
              {new Date().toLocaleDateString("ru-RU", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Статус WebSocket (для отладки/уверенности) */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
              isWsConnected ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
            }`}>
              {isWsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isWsConnected ? "Live" : "Offline"}
            </div>

            {/* WhatsApp Коннектор */}
            <WhatsAppConnector status={waStatus} isPaused={waPaused} onLogout={handleWaLogout} onTogglePause={handleWaPauseToggle} />

            {/* Переключатель темы */}
            <button 
              onClick={toggleTheme}
              className="p-2 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-all"
              title={theme === 'dark' ? 'Включить светлую тему' : 'Включить темную тему'}
            >
              {mounted && (theme === "dark" ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5" />)}
            </button>

            <button className="relative p-2 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
              <Bell className="w-5 h-5" />
              {notifications.length > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse border-2 border-white dark:border-slate-900"></span>
              )}
            </button>
          </div>
        </header>

        {/* ИИ-уведомления (плавающие тосты) */}
        {notifications.length > 0 && (
          <div className="absolute top-[72px] right-4 z-50 space-y-3 w-[420px]">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`rounded-lg shadow-xl border-2 p-4 backdrop-blur-sm transition-all duration-300 ${
                  notif.type === "success"
                    ? "bg-green-50/95 border-green-300"
                    : "bg-yellow-50/95 border-yellow-300"
                }`}
                style={{
                  animation: "slideIn 0.3s ease-out",
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      notif.type === "success"
                        ? "bg-green-200"
                        : "bg-yellow-200"
                    }`}
                  >
                    {notif.type === "success" ? (
                      <CheckCircle2 className="w-5 h-5 text-green-700" />
                    ) : (
                      <Brain className="w-5 h-5 text-yellow-700" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900 text-sm">
                        {notif.title}
                      </h4>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          notif.confidence >= 70
                            ? "bg-green-200 text-green-800"
                            : "bg-yellow-200 text-yellow-800"
                        }`}
                      >
                        {notif.confidence}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 leading-snug">
                      {notif.message}
                    </p>
                    {notif.sectionName && notif.type === "success" && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-blue-600 font-medium">
                        <ArrowRight className="w-3 h-3" />
                        Перешёл в раздел: {notif.sectionName}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => dismissNotification(notif.id)}
                    className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 transition-colors rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Прогресс-бар автоудаления */}
                <div className="mt-3 h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      notif.type === "success"
                        ? "bg-green-400"
                        : "bg-yellow-400"
                    }`}
                    style={{
                      animation: "shrink 10s linear forwards",
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Контент страницы */}
        <div className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </div>
      </main>

      {/* Кастомные анимации */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}