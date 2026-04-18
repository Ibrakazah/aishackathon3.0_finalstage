from fastapi import FastAPI, UploadFile, File, HTTPException, Body, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import requests
import uvicorn
import sqlite3
import json
import os

app = FastAPI(title="School AI Backend (Groq Powered)")

# 🔐 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔑 API Config
API_KEY = os.environ.get("GROQ_API_KEY", "")  # Set GROQ_API_KEY env variable
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
WHISPER_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
DB_PATH = "server/schedule.db"

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"WebSocket send error: {e}")

manager = ConnectionManager()

# 📱 WhatsApp status tracking
ALLOWED_WHATSAPP_GROUPS = ["akbobek Uralsk", "Султан"] 
wa_status = "disconnected"  # disconnected | qr_ready | connected
wa_paused = False # whether to pause accepting incoming webhook messages
WA_SERVICE_URL = "http://127.0.0.1:3000"

def query_db(query, args=(), one=False):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(query, args)
    rv = cur.fetchall()
    conn.commit()
    conn.close()
    return (rv[0] if rv else None) if one else rv

@app.on_event("startup")
def startup_event():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute('''
        CREATE TABLE IF NOT EXISTS ai_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL,
            original_message TEXT NOT NULL,
            proposed_action TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cur.execute('''
        CREATE TABLE IF NOT EXISTS nutrition_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            total_vseobuch INTEGER DEFAULT 250,
            sick_count INTEGER DEFAULT 0,
            competition_count INTEGER DEFAULT 0,
            raw_messages_parsed INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cur.execute('''
        CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inc_id TEXT UNIQUE NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            location TEXT NOT NULL,
            description TEXT NOT NULL,
            reporter TEXT NOT NULL,
            assigned_to TEXT NOT NULL,
            status TEXT DEFAULT 'open'
        )
    ''')
    conn.commit()
    conn.close()

# ═══ WhatsApp Status API ═══

@app.get("/api/wa/status")
async def get_wa_status():
    return {"status": wa_status, "paused": wa_paused}

@app.post("/api/wa/pause")
async def pause_wa():
    global wa_paused
    wa_paused = True
    await manager.broadcast({"type": "WA_PAUSED", "paused": wa_paused})
    return {"ok": True, "paused": wa_paused}

@app.post("/api/wa/resume")
async def resume_wa():
    global wa_paused
    wa_paused = False
    await manager.broadcast({"type": "WA_PAUSED", "paused": wa_paused})
    return {"ok": True, "paused": wa_paused}

@app.get("/api/wa/qr")
async def get_wa_qr():
    """Proxy QR data from the Node.js wa-service"""
    try:
        resp = requests.get(f"{WA_SERVICE_URL}/qr", timeout=3)
        return resp.json()
    except Exception as e:
        print(f"WA QR fetch error: {e}")
        return {"qr": None, "status": wa_status}

@app.post("/api/wa/status-update")
async def wa_status_update(request: Request):
    """Called by the Node.js wa-service when status changes"""
    global wa_status
    data = await request.json()
    wa_status = data.get("status", "disconnected")
    print(f"WhatsApp status -> {wa_status}")
    await manager.broadcast({"type": "WA_STATUS", "status": wa_status})
    return {"ok": True}

@app.post("/api/wa/logout")
async def wa_logout():
    """Proxy logout to wa-service Node.js"""
    global wa_status
    try:
        resp = requests.post(f"{WA_SERVICE_URL}/logout", timeout=10)
        wa_status = "disconnected"
        await manager.broadcast({"type": "WA_STATUS", "status": "disconnected"})
        return resp.json()
    except Exception as e:
        print(f"WA logout error: {e}")
        return {"error": str(e)}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/api/messages")
async def get_messages():
    try:
        messages = query_db("SELECT * FROM chat_messages ORDER BY timestamp DESC LIMIT 50")
        res = []
        if messages:
            for ix in messages:
                d = dict(ix)
                d["is_important"] = bool(d.get("is_important", 0))
                res.append(d)
        return res
    except Exception as e:
        print(f"Error fetching messages: {e}")
        return []

@app.delete("/api/messages")
async def clear_messages():
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("DELETE FROM chat_messages")
        conn.commit()
        conn.close()
        return {"status": "success", "message": "All messages cleared"}
    except Exception as e:
        print(f"Error clearing messages: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/internal-webhook")
async def internal_webhook(request: Request):
    data = await request.json()
    from_id = data.get("from", "unknown")
    text_body = data.get("body", "")
    platform = data.get("platform", "whatsapp")
    is_group = data.get("isGroupMsg", False)
    group_name = data.get("group_name")
    user_name = data.get("user_name") or from_id.split("@")[0]
    
    source_name = group_name if (is_group and group_name) else user_name
    
    # Strict filtering for allowed sources only
    allowed_sources = ["Султан", "infvoi"]
    if source_name not in allowed_sources:
        print(f"Message from {source_name} filtered. Allowed: {allowed_sources}.")
        return {"status": "filtered"}
    
    if wa_paused:
        print("Webhook received but WA is paused. Ignoring.")
        return {"status": "paused"}
        
    # Get recent history to provide context for AI (especially for clarifications)
    conn_hist = sqlite3.connect(DB_PATH)
    cur_hist = conn_hist.cursor()
    cur_hist.execute("SELECT message FROM chat_messages WHERE sender = ? ORDER BY timestamp DESC LIMIT 5", (source_name,))
    recent_history = cur_hist.fetchall()
    conn_hist.close()
    history_text = "\n".join([row[0] for row in reversed(recent_history)]) if recent_history else "Нет предыдущих сообщений."
        
    # Analyze message with Groq AI for Summary & Importance
    prompt = f"""
    Ты - умный ИИ-Директор школы. Проанализируй следующее сообщение из школьного чата.
    Источник/Группа/Человек: '{source_name}'
    Контекст (последние 5 сообщений от него): '{history_text}'
    Текущее сообщение: '{text_body}'
    
    Задачи: 
    1. Установи роль отправителя ('Учитель', 'Завуч', 'Завхоз' или 'Сотрудник').
    2. Оцени важность (is_important: true/false). Важное: инциденты, ЧП, запросы документов (приказов, отчетов), жалобы, отсутствие на работе.
    3. Выдели СУТЬ в одно предложение (summary) если это важно.
    4. ДИНАМИЧНОЕ УПРАВЛЕНИЕ (самое главное): 
       - РАБОТА С ИНЦИДЕНТАМИ: Если это сообщение о новой проблеме и НЕ ХВАТАЕТ данных -> задай вопрос отправителю (needs_clarification: true). НО если отправитель прямо или косвенно дает понять, что ОН НЕ ЗНАЕТ деталей (н-р: "не знаю где они"), ХВАТИТ у него спрашивать! Установи needs_clarification: false, и сгенерируй proposed_action для ПЕРСОНАЛА (например: "Отправить охранника на поиски").
       - ЗАПРОСЫ ДОКУМЕНТОВ/ДАННЫХ: Если пользователь просит отправить ему файл, приказ (н-р №76, №130) или отчет, НЕ задавай уточняющих вопросов о старых інцидентах. Просто установи needs_clarification: false и предложи действие (proposed_action: "Предоставить доступ к документу / Отправить файл").
    5. РАЗДЕЛЕНИЕ КОНТЕКСТА (очень важно): Сравни с контекстом. Является ли текущее сообщение ПРЯМЫМ продолжением предыдущей проблемы? Если тема РЕЗКО поменялась (например, сначала говорили про посторонних, а теперь просят приказ или жалуются на столовую) — это НОВАЯ тема. Обязательно ставь is_continuation: false. НЕ пытайся искать связь там, где ее нет!
    
    Верни чистый JSON без маркдауна:
    {{ 
      "role": "string", 
      "is_important": boolean, 
      "summary": "только суть или пустая",
      "needs_clarification": boolean,
      "clarification_text": "вопрос или пустая",
      "proposed_action": "действие или пустая",
      "is_continuation": boolean,
      "nutrition": {{
         "is_nutrition": boolean,
         "sick_count": 0,
         "competition_count": 0
      }},
      "incident": {{
         "is_incident": boolean,
         "location": "комната или кабинет",
         "assigned_to": "кому поручить"
      }}
    }}
    """
    
    is_important = False
    role = "Сотрудник"
    final_text = text_body
    
    try:
        headers = {"Authorization": f"Bearer {API_KEY}"}
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": [{ "role": "user", "content": prompt }],
            "temperature": 0
        }
        resp = requests.post(GROQ_URL, headers=headers, json=payload)
        # Debug log for Groq
        print(f"Groq API Response for '{text_body[:20]}...': {resp.status_code} - {resp.text[:200]}")
        
        ai_text = resp.json()['choices'][0]['message']['content']
        json_str = ai_text.replace('```json', '').replace('```', '').strip()
        analysis = json.loads(json_str)
        role = analysis.get("role", "Сотрудник")
        is_important = analysis.get("is_important", False)
        
        summary = analysis.get("summary", "").strip()
        needs_clarification = analysis.get("needs_clarification", False)
        clarification_text = analysis.get("clarification_text", "").strip()
        proposed_action = analysis.get("proposed_action", "").strip()
        is_continuation = analysis.get("is_continuation", False)

        nutrition = analysis.get("nutrition", {})
        incident = analysis.get("incident", {})
        
        # Если ИИ посчитал сообщение важным и сгенерировал summary — используем его вместо сырого текста
        if is_important and summary:
            final_text = summary
            
        # Автоматическое уточнение из ИИ (если нет нужных данных, отправляем ответ в WhatsApp)
        if needs_clarification and clarification_text:
            try:
                requests.post(f"{WA_SERVICE_URL}/send", json={"to": from_id, "text": clarification_text}, timeout=5)
                # Дописываем к тексту то, что ИИ задал уточняющий вопрос
                final_text += f"\n[Бот запросил уточнение: '{clarification_text}']"
            except Exception as auto_reply_err:
                print(f"Failed to send auto-reply clarification: {auto_reply_err}")
                
        # Если есть предложенное действие, сохраняем в ai_tasks
        if proposed_action and not needs_clarification:
            conn_tasks = sqlite3.connect(DB_PATH)
            cur_tasks = conn_tasks.cursor()
            cur_tasks.execute('''
                INSERT INTO ai_tasks (source, original_message, proposed_action, status)
                VALUES (?, ?, ?, 'pending')
            ''', (source_name, text_body, proposed_action))
            task_id = cur_tasks.lastrowid
            
            if incident and incident.get("is_incident"):
                import uuid
                inc_id = f"inc-{str(uuid.uuid4())[:8]}"
                cur_tasks.execute('''
                    INSERT INTO incidents (inc_id, location, description, reporter, assigned_to, status)
                    VALUES (?, ?, ?, ?, ?, 'open')
                ''', (inc_id, incident.get("location", "Неустановлено"), summary or text_body, source_name, incident.get("assigned_to", "Завхоз")))
            
            if nutrition and nutrition.get("is_nutrition"):
                import datetime
                today_str = datetime.date.today().isoformat()
                cur_tasks.execute("SELECT id FROM nutrition_reports WHERE date = ?", (today_str,))
                row = cur_tasks.fetchone()
                s_count = nutrition.get("sick_count", 0)
                c_count = nutrition.get("competition_count", 0)
                if row:
                    cur_tasks.execute("UPDATE nutrition_reports SET sick_count = sick_count + ?, competition_count = competition_count + ?, raw_messages_parsed = raw_messages_parsed + 1 WHERE id = ?", (s_count, c_count, row[0]))
                else:
                    cur_tasks.execute("INSERT INTO nutrition_reports (date, sick_count, competition_count, raw_messages_parsed) VALUES (?, ?, ?, 1)", (today_str, s_count, c_count))
            
            conn_tasks.commit()
            
            # Broadcast the new task to frontend
            import copy
            task_obj = {
                "id": task_id,
                "source": source_name,
                "original_message": text_body,
                "proposed_action": proposed_action,
                "status": "pending"
            }
            await manager.broadcast({"type": "NEW_AI_TASK", "data": task_obj})
            
            conn_tasks.close()
            
    except Exception as e:
        print(f"Failed to analyze message: {e}")
        
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    # Пытаемся найти недавнее важное сообщение от этого же отправителя
    cur.execute("SELECT id, message FROM chat_messages WHERE sender = ? AND is_important = 1 ORDER BY timestamp DESC LIMIT 1", (source_name,))
    last_msg = cur.fetchone()
    
    # Мержим сообщения ТОЛЬКО если ИИ подтвердил, что это продолжение темы (is_continuation)
    if is_important and last_msg and is_continuation:
        # Обновляем старое сообщение (сливаем вместе)
        last_id = last_msg[0]
        base_text = last_msg[1].split("\n-> Дополнение:")[0].split("\n[Бот")[0]
        merged_text = f"{base_text}\n-> Дополнение: {final_text}"
        cur.execute("UPDATE chat_messages SET message = ? WHERE id = ?", (merged_text, last_id))
        new_id = last_id
        final_text = merged_text
    else:
        cur.execute('''
            INSERT INTO chat_messages (platform, sender, role, message, is_important)
            VALUES (?, ?, ?, ?, ?)
        ''', (platform, source_name, role, final_text, is_important))
        new_id = cur.lastrowid
    
    # get the timestamp
    cur.execute("SELECT timestamp FROM chat_messages WHERE id = ?", (new_id,))
    timestamp = cur.fetchone()[0]
    conn.commit()
    conn.close()
    
    new_msg = {
        "id": new_id,
        "platform": platform,
        "sender": source_name,
        "role": role,
        "message": final_text,
        "is_important": bool(is_important),
        "timestamp": timestamp
    }
    
    await manager.broadcast({"type": "NEW_MESSAGE", "data": new_msg})
    
    return {"status": "received"}

@app.get("/api/ai-tasks")
async def get_ai_tasks():
    try:
        tasks = query_db("SELECT * FROM ai_tasks ORDER BY created_at DESC LIMIT 50")
        return [dict(t) for t in (tasks or [])]
    except Exception as e:
        print(f"Error fetching ai tasks: {e}")
        return []

@app.post("/api/ai-tasks/{task_id}/resolve")
async def resolve_ai_task(task_id: int, request: Request):
    data = await request.json()
    action = data.get("action", "approve") # 'approve' | 'reject'
    
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("UPDATE ai_tasks SET status = ? WHERE id = ?", (action, task_id))
    conn.commit()
    conn.close()
    
    if action == "approve":
        # Отправляем задачу напрямую контакту "Султан" через WhatsApp
        try:
            # Получаем детали задачи
            tasks_data = query_db("SELECT * FROM ai_tasks WHERE id = ?", (task_id,), one=True)
            if tasks_data:
                msg_text = f"🛠️ *Новая задача от Интеллект-Системы:*\n\nИсточник: {tasks_data['source']}\nДетали: {tasks_data['proposed_action']}\n\nОригинал: {tasks_data['original_message']}"
                requests.post(f"{WA_SERVICE_URL}/send-contact", json={"contactName": "Султан", "text": msg_text}, timeout=10)
        except Exception as e:
            print(f"Failed to send task to Sultan: {e}")
            
        return {"status": "approved", "message": "Задача выполнена и отправлена Султану"}
    else:
        return {"status": "rejected", "message": "Задача отклонена"}

@app.get("/api/v1/nutrition/today")
async def get_nutrition_today():
    import datetime
    today_str = datetime.date.today().isoformat()
    report = query_db("SELECT * FROM nutrition_reports WHERE date = ?", (today_str,), one=True)
    if report:
        return {
            "date": report["date"],
            "totalVseobuch": report["total_vseobuch"],
            "absentDetails": {
                "sick_count": report["sick_count"],
                "competition_count": report["competition_count"]
            },
            "rawMessagesParsed": report["raw_messages_parsed"],
            "status": "success"
        }
    return {
        "date": today_str,
        "totalVseobuch": 250,
        "absentDetails": {"sick_count": 0, "competition_count": 0},
        "rawMessagesParsed": 0,
        "status": "success"
    }

@app.get("/api/v1/incidents/active")
async def get_active_incidents():
    incidents = query_db("SELECT * FROM incidents WHERE status = 'open' ORDER BY timestamp DESC")
    res = []
    if incidents:
        for inc in incidents:
            res.append({
                "id": inc["inc_id"],
                "timestamp": inc["timestamp"],
                "location": inc["location"],
                "description": inc["description"],
                "reporter": inc["reporter"],
                "assignedTo": inc["assigned_to"],
                "status": inc["status"]
            })
    return {"incidents": res}

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    try:
        content = await file.read()
        headers = {"Authorization": f"Bearer {API_KEY}"}
        files = {"file": (file.filename or "audio.webm", content, file.content_type or "audio/webm")}
        data = {"model": "whisper-large-v3"}

        response = requests.post(WHISPER_URL, headers=headers, files=files, data=data)
        if response.status_code != 200:
            raise Exception(f"Groq Whisper Error: {response.text}")
        return {"success": True, "text": response.json().get("text", "").strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/process-command")
async def process_command(command: str = Body(..., embed=True)):
    """
    Глобальный обработчик команд директора через Groq.
    Полностью заменяет старую логику Gemini.
    """
    try:
        # Получаем данные из БД для осознанного ответа
        teachers = [r['name'] for r in query_db("SELECT name FROM teachers")]
        
        prompt = f"""
        Ты — интеллектуальный помощник системы управления школой. Твоя роль: парсить команды директора в JSON.
        
        КОНТЕКСТ ШКОЛЫ:
        Список учителей: {', '.join(teachers)}
        
        ПРАВИЛА НАВИГАЦИИ (route):
        - "/schedule" -> замена учителей, расписание, уроки, отсутствие.
        - "/reports" -> любые отчеты, статистика, посещаемость, питание.
        - "/chat-summary" -> сообщения, чаты, переписка.
        - "/suggestions" -> жалобы, идеи, предложения.
        - "/calendar" -> мероприятия, встречи в календаре.
        - "/" -> общие задачи.

        ОТВЕЧАЙ ТОЛЬКО ЧИСТЫМ JSON.
        
        JSON Format:
        {{
          "intent": "schedule" | "reports" | "chat" | "suggestions" | "calendar" | "tasks" | "send_message" | "unknown",
          "route": "string",
          "sectionName": "string (на русском)",
          "confidence": number,
          "summary": "краткое описание 1 предложение",
          "detailedUnderstanding": "подробный разбор задачи",
          "entities": {{
            "teacherName": "string",
            "reportNumber": "string",
            "className": "string",
            "topic": "string",
            "targetGroup": "string (имя группы в WhatsApp, например 'Техники' или 'Учителя')",
            "messageText": "string (текст сообщения для отправки)"
          }},
          "scheduleUpdate": {{
             "day": "string (Понедельник, Вторник, Среда, Четверг, Пятница)",
             "time_slot": "string (08:00-08:45, 09:00-09:45, 10:00-10:45, 11:00-11:45...)",
             "className": "string (например '8Б')",
             "newTeacher": "string (из списка выше)",
             "newSubject": "string"
          }},
          "teacherAbsence": {{
             "absentTeacher": "string (ФИО)",
             "replacementTeacher": "string (ФИО, опционально)",
             "day": "string (Напр. Вторник)"
          }},
          "originalText": "{command}",
          "actions": ["список действий"]
        }}
        """

        headers = {"Authorization": f"Bearer {API_KEY}"}
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0
        }
        
        response = requests.post(GROQ_URL, headers=headers, json=payload)
        
        if response.status_code != 200:
            raise Exception(f"Groq API Error {response.status_code}: {response.text}")
            
        ai_text = response.json()['choices'][0]['message']['content']
        
        # Очистка и возврат
        json_str = ai_text.replace('```json', '').replace('```', '').strip()
        data = json.loads(json_str)
        
        # Обработка отправки сообщения
        if data.get("intent") == "send_message":
            target_group = data.get("entities", {}).get("targetGroup")
            message_text = data.get("entities", {}).get("messageText")
            if target_group and message_text:
                try:
                    resp = requests.post(f"{WA_SERVICE_URL}/send-group", json={"groupName": target_group, "text": message_text}, timeout=10)
                    resp_data = resp.json()
                    if resp.status_code == 200:
                        data["actions"].append(f"Успешно отправлено в {target_group}")
                    else:
                        data["actions"].append(f"Ошибка отправки: {resp_data.get('error')}")
                except Exception as we:
                    data["actions"].append(f"Ошибка связи с WA сервисом: {we}")

        return data
        
    except Exception as e:
        print(f"Error processing command in Groq: {e}")
        return {
            "intent": "unknown", 
            "route": "/", 
            "sectionName": "Главная", 
            "confidence": 0, 
            "summary": "Ошибка обработки через Groq",
            "detailedUnderstanding": str(e),
            "entities": {},
            "originalText": command,
            "actions": []
        }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
