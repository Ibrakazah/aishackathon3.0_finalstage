import { useState, useRef, useEffect } from "react";
import { Send, User, Bot, Sparkles, MoreHorizontal, Paperclip, Smile, Brain, Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { processAiCommand } from "../services/gemini";
import { VoiceInput } from "./VoiceInput";

interface Message {
  id: number;
  role: "user" | "ai";
  text: string;
  timestamp: string;
  proposedAction?: {
    type: string;
    description: string;
    params: any;
  };
  status?: "pending" | "executed" | "failed";
}


interface AiTask {
  id: number;
  source: string;
  original_message: string;
  proposed_action: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export function ChatBot() {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem("oqy_chat_history");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved chat history", e);
      }
    }
    return [
      {
        id: 1,
        role: "ai",
        text: "Привет! Я Oqý — ваш школьный AI-ассистент. Я могу планировать действия в календаре, маршрутизировать задачи и отвечать на ваши запросы. Вы можете писать мне текстом или диктовать голосом!",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem("oqy_chat_history", JSON.stringify(messages));
  }, [messages]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [tasks, setTasks] = useState<AiTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  // Tasks Logic
  const fetchTasks = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/ai-tasks");
      const data = await res.json();
      setTasks(data);
    } catch (e) {
      console.error("Failed to fetch ai tasks", e);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const token = setInterval(fetchTasks, 10000);
    const msgListener = (e: any) => {
      if (e.detail?.type === "NEW_AI_TASK") fetchTasks();
    };
    window.addEventListener("ai-notification", msgListener);
    return () => {
      clearInterval(token);
      window.removeEventListener("ai-notification", msgListener);
    };
  }, []);

  const resolveTask = async (taskId: number, action: "approve" | "reject") => {
    try {
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status: action } : t));
      await fetch(`http://localhost:8000/api/ai-tasks/${taskId}/resolve`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action })
      });
      fetchTasks();
    } catch (e) {
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status: "pending" } : t));
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userText = input.trim();
    setInput("");
    
    // Add User Message
    setMessages(prev => [...prev, {
      id: Date.now(),
      role: "user",
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);

    setIsProcessing(true);

    try {
      // Connect to Real Backend functions
      const result = await processAiCommand(userText);
      
      let aiResponseText = "";
      let actionObj = undefined;

      if (result.proposedAction && result.proposedAction.type !== 'none') {
        aiResponseText = `🤖 Я подготовил действие: **${result.proposedAction.description}**.\n\n${result.summary}\n\nЖелаете выполнить это прямо сейчас?`;
        actionObj = result.proposedAction;
      } else {
        aiResponseText = result.summary || "Я проанализировал ваш запрос, но не нашел подходящего действия.";
      }

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: "ai",
        text: aiResponseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        proposedAction: actionObj,
        status: actionObj ? "pending" : undefined
      }]);

    } catch (e) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: "ai",
        text: "❌ Ошибка при обращении к серверу (бэкенд недоступен).",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const executeAction = async (msgId: number, action: any) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: "pending" } : m));
    
    try {
      const resp = await fetch("http://localhost:8000/api/ai/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action)
      });
      const data = await resp.json();
      
      if (data.success) {
        setMessages(prev => prev.map(m => m.id === msgId ? { 
          ...m, 
          status: "executed",
          text: m.text + "\n\n✅ **Действие успешно выполнено!**" 
        } : m));
      } else {
        throw new Error(data.error);
      }
    } catch (e) {
      setMessages(prev => prev.map(m => m.id === msgId ? { 
        ...m, 
        status: "failed",
        text: m.text + `\n\n❌ **Ошибка выполнения:** ${String(e)}` 
      } : m));
    }
  };


  return (
    <div className="h-[calc(100vh-140px)] flex gap-6 anim-fade-in p-2">
      
      {/* ЛЕВАЯ КОЛОНКА - ЗАДАЧИ ИИ (Теперь занимает 30% ширины) */}
      <div className="w-[30%] flex flex-col bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden min-w-[280px]">
        <div className="p-5 border-b border-gray-100 dark:border-slate-800 bg-gradient-to-r from-orange-500 to-red-500 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-tight">Очередь ИИ</h2>
              <p className="text-[10px] text-white/90 uppercase tracking-widest font-bold">Распознанные инциденты</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-slate-950/50 custom-scrollbar">
          {isLoadingTasks ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin mb-2 text-orange-500" />
            </div>
          ) : tasks.filter(t => t.status === 'pending').length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-black text-gray-900 dark:text-white uppercase">Все чисто</h3>
              <p className="text-gray-500 dark:text-slate-400 text-xs mt-1 font-medium">Новых ИИ-задач пока нет</p>
            </div>
          ) : (
            tasks.filter(t => t.status === 'pending').map((task) => (
              <div key={task.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-orange-200 dark:border-orange-900/50 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-orange-400 to-red-500"></div>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400">
                    <AlertTriangle className="w-3 h-3" /> Проблема
                  </div>
                </div>
                
                <div className="mb-4">
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase font-bold tracking-wider mb-1">От: {task.source}</p>
                  <p className="text-gray-900 dark:text-slate-200 text-sm italic border-l-2 border-gray-200 dark:border-slate-700 pl-3 mb-3">
                    "{task.original_message}"
                  </p>
                  <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-xl border border-orange-100 dark:border-orange-800/50">
                    <p className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest mb-1">Предлагаемое действие:</p>
                    <p className="text-xs font-bold text-gray-800 dark:text-white leading-relaxed">
                      {task.proposed_action}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => resolveTask(task.id, 'approve')} className="flex-1 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 py-2.5 px-4 rounded-xl flex justify-center items-center gap-2 text-xs font-black uppercase tracking-widest transition-transform active:scale-95 shadow-sm">
                    <CheckCircle className="w-4 h-4" /> Выполнить
                  </button>
                  <button onClick={() => resolveTask(task.id, 'reject')} className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-400 dark:text-gray-400 py-2.5 px-4 rounded-xl flex justify-center items-center transition-transform active:scale-95">
                    <XCircle className="w-4 h-4" /> 
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>


      {/* ПРАВАЯ КОЛОНКА - ЧАТ-БОТ (Занимает 70% ширины) */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-slate-800 overflow-hidden relative">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400/10 dark:bg-blue-600/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-400/10 dark:bg-purple-600/5 blur-[100px] rounded-full pointer-events-none" />

        <div className="p-5 border-b border-gray-50 dark:border-slate-800 flex items-center justify-between relative z-10 backdrop-blur-md bg-white/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Oqý AI Chat</h2>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Llama 3 (Groq API)</span>
              </div>
            </div>
          </div>
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <MoreHorizontal className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 relative z-10 custom-scrollbar">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-10 h-10 mt-1 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm ${
                  msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-indigo-500/30'
                }`}>
                  {msg.role === 'user' ? <User className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                </div>
                <div className="space-y-1">
                  <div className={`p-5 rounded-3xl text-[15px] font-medium leading-relaxed shadow-sm ${
                    msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 border border-gray-100 dark:border-slate-700 rounded-tl-none'
                  }`}>
                    {msg.text.split('\n').map((line, i) => <span key={i}>{line}<br/></span>)}
                    
                    {msg.proposedAction && msg.status !== "executed" && (
                      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700 flex flex-col gap-3">
                         <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-500">
                           <Sparkles className="w-3 h-3" /> Команда готова
                         </div>
                         <button 
                           onClick={() => executeAction(msg.id, msg.proposedAction)}
                           disabled={msg.status === "executed"}
                           className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-2xl flex items-center justify-center gap-2 text-sm font-black uppercase tracking-tighter transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
                         >
                           {msg.status === "executed" ? <CheckCircle className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                           {msg.status === "executed" ? "Выполнено" : "Подтвердить запуск"}
                         </button>
                      </div>
                    )}
                  </div>
                  <p className={`text-[10px] font-bold text-gray-400 uppercase tracking-widest ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    {msg.timestamp}
                  </p>
                </div>

              </div>
            </div>
          ))}
          {isProcessing && (
            <div className="flex justify-start animate-in fade-in">
              <div className="flex gap-4 max-w-[85%] flex-row">
                <div className="w-10 h-10 mt-1 rounded-xl flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="p-5 rounded-3xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-tl-none flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                  <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Анализирую...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-gray-50 dark:border-slate-800 relative z-10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
          <div className="max-w-4xl mx-auto relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-blue-600 rounded-[2rem] opacity-20 group-focus-within:opacity-40 blur transition duration-500" />
            <div className="relative flex items-center gap-2 bg-white dark:bg-slate-800 p-2 pl-4 rounded-[1.8rem] border border-gray-100 dark:border-slate-700 shadow-xl shadow-blue-500/5">
              
              <VoiceInput 
                onTranscription={(text) => {
                  setInput(text);
                  // auto-send if desired, but letting user review is better
                }} 
              />
              
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Спросите или продиктуйте поручение..."
                className="flex-1 bg-transparent py-3 px-2 focus:outline-none text-[15px] font-medium text-gray-900 dark:text-white placeholder-gray-400"
              />
              <div className="flex items-center pr-1">
                <button 
                  onClick={handleSend}
                  disabled={!input.trim() || isProcessing}
                  className="w-12 h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:bg-gray-400 text-white rounded-[1.2rem] flex items-center justify-center shadow-md shadow-indigo-500/20 transition-all active:scale-90"
                >
                  <Send className="w-5 h-5 ml-1" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
