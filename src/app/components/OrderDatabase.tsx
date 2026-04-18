import { useState, useRef, useEffect } from "react";
import { Send, FileText, Brain, Search, Database, FileCheck, CheckCircle2, Bot, User, Loader2, Link2, Download, Eye } from "lucide-react";

export function OrderDatabase() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', text: string }[]>([
    { role: 'assistant', text: "Добро пожаловать в Базу нормативных актов AQBOBEK LYCEUM.\n\nЯ проиндексировал все школьные приказы и документы МОН РК. Могу найти нужный пункт или составить проект распоряжения." }
  ]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "list">("list");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  const handleSend = () => {
    if (!input.trim() || isGenerating) return;
    
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput("");
    setIsGenerating(true);

    setTimeout(() => {
      let response = "Анализирую приказы по вашему запросу...\n\nСогласно правилам внутреннего распорядка и приказам МОН РК, регламентация данного вопроса требует издания внутреннего распоряжения директора. Подготовить шаблон?";
      if (userMsg.toLowerCase().includes("130")) {
        response = "**Приказ №130 (Аттестация):**\n\n- Учителя подают портфолио в электронном виде.\n- Высшая категория подтверждается через НКТ.\n- Льготы действуют для призеров конкурса «Учитель года».";
      }
      setMessages(prev => [...prev, { role: 'assistant', text: response }]);
      setIsGenerating(false);
    }, 1500);
  };

  const orders = [
    { id: "2024-001", title: "Приказ об организации питания", date: "01.09.2024", type: "Внутренний", status: "Active" },
    { id: "2024-110", title: "Об утверждении графика дежурств", date: "15.10.2024", type: "Распоряжение", status: "Active" },
    { id: "МОН-130", title: "Правила аттестации педагогов", date: "30.12.2022", type: "ГОСТ/МОН", status: "Standard" },
    { id: "МЗ-76", title: "Санитарные нормы (СанПин)", date: "11.01.2023", type: "ГОСТ/МЗ", status: "Standard" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">База Приказов</h1>
          <p className="text-sm text-gray-500 font-medium">Электронный архив и интеллектуальный поиск по документам</p>
        </div>
        
        <div className="flex bg-white dark:bg-slate-900 p-1 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <button 
            onClick={() => setActiveTab("list")}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'list' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
          >
            Архив файлов
          </button>
          <button 
            onClick={() => setActiveTab("chat")}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'chat' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
          >
            ИИ-Помощник (RAG)
          </button>
        </div>
      </div>

      {activeTab === "list" ? (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-gray-200 dark:border-slate-800 shadow-xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-950 border-b border-gray-200 dark:border-slate-800">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">ID / Номер</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Наименование приказа</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Дата</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Тип</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-8 py-5 text-sm font-bold text-indigo-600 dark:text-indigo-400">{order.id}</td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <FileText className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{order.title}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-sm font-medium text-gray-500 dark:text-slate-400">{order.date}</td>
                  <td className="px-8 py-5">
                    <span className="px-3 py-1 bg-gray-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-slate-700">
                      {order.type}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex gap-2">
                      <button className="p-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl transition-all">
                        <Download className="w-4 h-4" />
                      </button>
                      <button className="p-2.5 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 rounded-xl transition-all">
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="p-8 flex justify-center border-t border-gray-100 dark:border-slate-800">
             <button className="flex items-center gap-2 px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">
                <Link2 className="w-4 h-4" /> Загрузить новый документ
             </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-[2.5rem] shadow-xl flex flex-col h-[600px] overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-950/50 flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-black text-gray-900 dark:text-white uppercase text-sm tracking-widest">Интеллектуальный поиск</h2>
              <p className="text-[10px] font-bold text-emerald-600 uppercase">Bot Online • {orders.length} Документов в индексе</p>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30 dark:bg-slate-950/20">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-6 py-4 rounded-[1.8rem] text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-none shadow-md' 
                    : 'bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-gray-800 dark:text-slate-200 rounded-tl-none shadow-sm'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}
            {isGenerating && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl rounded-tl-none p-4 flex gap-2 items-center">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Ищу в архиве...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-6 border-t border-gray-100 dark:border-slate-800">
             <div className="flex gap-3">
               <input 
                 type="text" 
                 value={input}
                 onChange={e => setInput(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && handleSend()}
                 placeholder="Напишите запрос (например: найди нормы СанПин)..."
                 className="flex-1 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-2xl px-6 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 text-sm text-gray-900 dark:text-white transition-all"
               />
               <button onClick={handleSend} className="w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-95">
                 <Send className="w-5 h-5" />
               </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
