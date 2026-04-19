from fastapi import FastAPI, UploadFile, File, HTTPException, Body, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import requests
import httpx
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
API_KEY = os.getenv("GROQ_API_KEY", "YOUR_KEY_HERE")
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

def init_db():
    os.makedirs("server", exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    # Ensure tables exist
    cur.execute("CREATE TABLE IF NOT EXISTS subjects (id INTEGER PRIMARY KEY, name TEXT UNIQUE)")
    cur.execute("CREATE TABLE IF NOT EXISTS teachers (id INTEGER PRIMARY KEY, name TEXT UNIQUE)")
    cur.execute("CREATE TABLE IF NOT EXISTS rooms (id INTEGER PRIMARY KEY, name TEXT UNIQUE)")
    cur.execute("CREATE TABLE IF NOT EXISTS classes (id INTEGER PRIMARY KEY, grade TEXT, parallel TEXT, UNIQUE(grade, parallel))")
    cur.execute('''
        CREATE TABLE IF NOT EXISTS schedule_cells (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            class_name TEXT,
            day TEXT,
            time_slot TEXT,
            subject TEXT,
            teacher TEXT,
            room TEXT,
            is_lent BOOLEAN,
            lent_type TEXT,
            lent_group TEXT
        )
    ''')
    conn.commit()
    conn.close()

init_db()

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
async def startup_event():
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
    try:
        cur.execute("ALTER TABLE ai_tasks ADD COLUMN assignee TEXT DEFAULT 'Султан'")
    except sqlite3.OperationalError:
        pass # Column already exists
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
    cur.execute('''
        CREATE TABLE IF NOT EXISTS schedule_matrix (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

# ═══ WhatsApp Status API ═══

async def sync_wa_status():
    global wa_status
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{WA_SERVICE_URL}/status", timeout=2)
            if resp.status_code == 200:
                new_status = resp.json().get("status", "disconnected")
                if new_status != wa_status:
                    wa_status = new_status
                    await manager.broadcast({"type": "WA_STATUS", "status": wa_status})
    except:
        pass

@app.get("/api/wa/status")
async def get_wa_status():
    if wa_status != "connected":
        await sync_wa_status()
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
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{WA_SERVICE_URL}/qr", timeout=3)
            return resp.json()
    except Exception as e:
        print(f"WA QR fetch error: {e}")
        return {"qr": None, "status": wa_status}

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """Transcribe audio using Groq Whisper API"""
    try:
        content = await file.read()
        files = {
            "file": ("audio.webm", content, "audio/webm"),
            "model": (None, "whisper-large-v3"),
            "language": (None, "ru"),
        }
        headers = {"Authorization": f"Bearer {API_KEY}"}
        async with httpx.AsyncClient() as client:
            response = await client.post(WHISPER_URL, headers=headers, files=files, timeout=30)
        
        if response.status_code != 200:
            return {"success": False, "error": response.text}
        
        result = response.json()
        return {"success": True, "text": result.get("text", "")}
    except Exception as e:
        return {"success": False, "error": str(e)}

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
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{WA_SERVICE_URL}/logout", timeout=10)
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
        cur.execute("DELETE FROM ai_tasks")
        
        # We can also clear the matrix if we want, but usually 'clear messages' is just chat.
        conn.commit()
        conn.close()
        return {"status": "success", "message": "All messages & tasks cleared"}
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
    
    # Strict filtering for allowed sources removed to receive from everyone
    # allowed_sources = ["Султан", "infvoi"]
    # if source_name not in allowed_sources:
    #     print(f"Message from {source_name} filtered. Allowed: {allowed_sources}.")
    #     return {"status": "filtered"}
    

    if wa_paused:
        print("Webhook received but WA is paused. Ignoring.")
        return {"status": "paused"}
        
    # Get global recent history to provide full context across all chats
    conn_hist = sqlite3.connect(DB_PATH)
    cur_hist = conn_hist.cursor()
    cur_hist.execute("SELECT sender, message FROM chat_messages ORDER BY timestamp DESC LIMIT 15")
    global_recent = cur_hist.fetchall()
    conn_hist.close()
    
    # Format the context so the bot knows who is talking about what (e.g. mentions of Adlet 9a)
    history_text = "\n".join([f"[{row[0]}]: {row[1]}" for row in reversed(global_recent)]) if global_recent else "Нет контекста."
        
    # Analyze message with Groq AI for Summary & Importance
    prompt = f"""
    Ты - умный ИИ-Директор школы. Проанализируй следующее сообщение из школьного чата.
    Текущий отправитель: '{source_name}'
    Общий контекст чата (последние 15 сообщений): '{history_text}'
    Текущее сообщение: '{text_body}'
    
    Задачи: 
    1. Установи роль отправителя ('Учитель', 'Завуч', 'Завхоз' или 'Сотрудник').
    2. Оцени важность (is_important: true/false). Важное: инциденты, ЧП, запросы документов, жалобы, отчеты по посещаемости и питанию (кто отсутствует).
    3. Выдели СУТЬ в одно предложение (summary) если это важно.
    4. ДИНАМИЧНОЕ УПРАВЛЕНИЕ (самое главное): 
       - НИКОГДА НЕ ЗАДАВАЙ УТОЧНЯЮЩИХ ВОПРОСОВ, если сообщение НЕ важное! Если is_important: false, всегда ставь needs_clarification: false. Уточняй только критические ЧП и инциденты.
       - ОТЧЕТЫ ОБ ОТСУТСТВУЮЩИХ (КРИТИЧЕСКИ ВАЖНО): Если написано "в 10а нет 3 детей", "не пришло 5 человек", "отсутствуют 4" или аналогично — это ПОЛНАЯ информация для отчета. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО уточнять причины отсутствия. ТЫ ОБЯЗАН установить "is_important": true, needs_clarification: false и summary: "Отчет по питанию: [класс] - [кол-во] отсутствуют".
       - РАБОТА С ИНЦИДЕНТАМИ: Если это сообщение о новой проблеме и НЕ ХВАТАЕТ данных -> задай вопрос отправителю (needs_clarification: true). НО если отправитель прямо или косвенно дает понять, что ОН НЕ ЗНАЕТ деталей, ХВАТИТ у него спрашивать! Установи needs_clarification: false, и сгенерируй proposed_action.
       - ЗАПРОСЫ ДОКУМЕНТОВ/ДАННЫХ: Не задавай уточняющих вопросов о старых инцидентах. Просто установи needs_clarification: false и предложи действие.
       - ГЕНЕРАЦИЯ ОТЧЕТОВ И ПРИКАЗОВ: Если просят "сделай отчет" или "напиши приказ", но НЕ говорят какой -> задай вопрос (needs_clarification: true, clarification_text: "Уточните, какой именно отчет или приказ нужно подготовить?"). Если детали есть (напр. "приказ столовой на 165 порций" или "сделай порции больше") -> оформи как готовое поручение в proposed_action (напр. "Сформировать приказ для столовой о приготовлении 165 порций") и assign на нужный отдел (напр. "Завпроизводством / Столовая").
    5. РАЗДЕЛЕНИЕ КОНТЕКСТА (очень важно): Сравни с контекстом. Является ли текущее сообщение ПРЯМЫМ продолжением предыдущей проблемы? Если тема РЕЗКО поменялась — это НОВАЯ тема. Обязательно ставь is_continuation: false. НЕ пытайся искать связь там, где ее нет!
    6. КОНКРЕТНОЕ ПОРУЧЕНИЕ (важно): В поле 'proposed_action' пиши не просто пересказ проблемы, а конкретную инструкцию/приказ. Например: вместо "Сломан компьютер" пиши "Айти-специалист должен починить компьютер в 201 кабинете". Всегда указывай КТО и ЧТО должен сделать. Оформляй в директивном стиле.    
    Верни чистый JSON без маркдауна:
    {{ 
      "role": "string", 
      "is_important": boolean, 
      "summary": "только суть или пустая",
      "needs_clarification": boolean,
      "clarification_text": "вопрос или пустая",
      "proposed_action": "действие или пустая",
      "assignee": "КОМУ отправить задачу (например: Султан, Родители ученика (ФИО), Виновник (ФИО), Завуч)",
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
        async with httpx.AsyncClient() as client:
            resp = await client.post(GROQ_URL, headers=headers, json=payload, timeout=30)
        
        if resp.status_code != 200:
            print(f"Groq API Error: {resp.status_code} - {resp.text}")
            raise Exception(f"API Error {resp.status_code}: {resp.text}")
            
        # Debug log for Groq
        # print(f"Groq API Response for '{text_body[:20]}...': {resp.status_code} - {resp.text[:200]}")
        
        ai_text = resp.json()['choices'][0]['message']['content']
        json_str = ai_text.replace('```json', '').replace('```', '').strip()
        analysis = json.loads(json_str)
        role = analysis.get("role", "Сотрудник")
        is_important = analysis.get("is_important", False)
        
        summary = analysis.get("summary", "").strip()
        needs_clarification = analysis.get("needs_clarification", False)
        clarification_text = analysis.get("clarification_text", "").strip()
        proposed_action = analysis.get("proposed_action", "").strip()
        assignee = analysis.get("assignee", "Султан").strip()
        is_continuation = analysis.get("is_continuation", False)

        nutrition = analysis.get("nutrition", {})
        incident = analysis.get("incident", {})
        
        # Если ИИ посчитал сообщение важным и сгенерировал summary — используем его вместо сырого текста
        if is_important and summary:
            final_text = summary
            
        # Автоматическое уточнение из ИИ (если нет нужных данных, отправляем ответ в WhatsApp)
        if needs_clarification and clarification_text:
            # ИИ отвечает только в личные сообщения (не пишет в группы)
            if not is_group:
                try:
                    async with httpx.AsyncClient() as client:
                        await client.post(f"{WA_SERVICE_URL}/send", json={"to": from_id, "text": clarification_text}, timeout=5)
                    # Дописываем к тексту то, что ИИ задал уточняющий вопрос
                    final_text += f"\n[Бот запросил уточнение в ЛС: '{clarification_text}']"
                except Exception as auto_reply_err:
                    print(f"Failed to send auto-reply clarification: {auto_reply_err}")
            else:
                final_text += f"\n[Бот хотел задать уточнение, но проигнорировал группу: '{clarification_text}']"
                
        # Если есть предложенное действие, сохраняем в ai_tasks
        if proposed_action and not needs_clarification:
            conn_tasks = sqlite3.connect(DB_PATH)
            cur_tasks = conn_tasks.cursor()
            cur_tasks.execute('''
                INSERT INTO ai_tasks (source, original_message, proposed_action, status, assignee)
                VALUES (?, ?, ?, 'pending', ?)
            ''', (source_name, text_body, proposed_action, assignee))
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
            
            # --- АВТОМАТИЧЕСКОЕ ОПОВЕЩЕНИЕ СООТВЕТСТВУЮЩЕГО ПЕРСОНАЛА ---
            try:
                async with httpx.AsyncClient() as client:
                    if incident and incident.get("is_incident"):
                        target = incident.get("assigned_to", "Завхоз")
                        notif_text = f"📢 *Новая заявка: {incident.get('location', 'Школа')}*\n\n{summary or text_body}\n\nПожалуйста, отработайте как можно скорее."
                        await client.post(f"{WA_SERVICE_URL}/send-contact", json={"contactName": target, "text": notif_text}, timeout=5)
                    
                    elif nutrition and nutrition.get("is_nutrition"):
                        # Оповещаем Адиля о новых данных по питанию
                        notif_text = f"🍎 *Обновление по питанию:* {source_name} сообщил о {nutrition.get('sick_count', 0)} болеющих."
                        await client.post(f"{WA_SERVICE_URL}/send-contact", json={"contactName": "Adil", "text": notif_text}, timeout=5)
            except Exception as e:
                print(f"Failed to auto-notify: {e}")

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
        # Отправляем сообщение нужному адресату
        try:
            tasks_data = query_db("SELECT * FROM ai_tasks WHERE id = ?", (task_id,), one=True)
            if tasks_data:
                target_assignee = tasks_data.get('assignee', 'Султан')
                msg_text = f"🛠️ *Новая задача/Уведомление от ИИ-Директора:*\n\nКому: {target_assignee}\nИсточник: {tasks_data['source']}\nДетали: {tasks_data['proposed_action']}\n\nОригинал: {tasks_data['original_message']}"
                async with httpx.AsyncClient() as client:
                    await client.post(f"{WA_SERVICE_URL}/send-contact", json={"contactName": target_assignee, "text": msg_text}, timeout=10)
        except Exception as e:
            print(f"Failed to send task to {target_assignee}: {e}")
            
        return {"status": "approved", "message": f"Задача выполнена и отправлена адресату: {tasks_data.get('assignee', 'Султан')}"}
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

@app.get("/api/matrix")
async def get_matrix():
    row = query_db("SELECT data FROM schedule_matrix ORDER BY updated_at DESC LIMIT 1", one=True)
    if row and row["data"]:
        import json
        try:
            return json.loads(row["data"])
        except:
            return {}
    return {}

@app.post("/api/matrix")
async def save_matrix(request: Request):
    data = await request.json()
    import json
    data_str = json.dumps(data)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    # Update or insert
    cur.execute("SELECT id FROM schedule_matrix LIMIT 1")
    row = cur.fetchone()
    if row:
        cur.execute("UPDATE schedule_matrix SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (data_str, row[0]))
    else:
        cur.execute("INSERT INTO schedule_matrix (data) VALUES (?)", (data_str,))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.post("/api/generate-fast")
async def generate_fast(request: Request):
    data = await request.json()
    matrix = data.get("matrix", {})
    lents = data.get("lents", [])
    
    import time
    import random
    import re
    
    t0 = time.time()
    schedule = {}
    conflict_reasons = []
    
    classes = matrix.get("classes", [])
    subjects = matrix.get("subjects", [])
    teachers = matrix.get("teachers", [])
    rooms = matrix.get("rooms", [])
    
    days = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница"]
    time_slots = ["08:00-08:45", "09:05-09:50", "10:10-10:55", "11:00-11:45", "11:50-12:35", "13:05-13:50", "14:20-15:00", "15:05-15:45", "16:00-16:45", "16:45-17:30"]
    
    for cls in classes:
        schedule[cls] = {d: {} for d in days}
        
    for t in teachers:
        if t.get("assignments"):
            for subj, class_map in t["assignments"].items():
                for cls, hours in class_map.items():
                    if cls not in classes:
                        classes.append(cls)
                        schedule[cls] = {d: {} for d in days}
                        
    teacher_busy = {}
    room_busy = {}
    class_busy = {}
    teacher_day_load = {}
    teacher_week_load = {}
    
    # New: handle explicit unavailability
    unavail_t = data.get("unavailableTeachers", {}) # { "TeacherName": ["Понедельник", ... ] }
    unavail_r = data.get("unavailableRooms", {})    # { "RoomName": ["Понедельник", ... ] }

    def mark_busy(c, r, tc, d, tm):
        if c: class_busy.setdefault(c, {}).setdefault(d, {})[tm] = True
        if r: 
            # Специальная логика для Спортзала: может вместить до 3 классов одновременно
            capacity = 3 if "спортзал" in r.lower() else 1
            current = room_busy.setdefault(r, {}).setdefault(d, {}).get(tm, 0)
            room_busy[r][d][tm] = current + 1
        if tc: 
            teacher_busy.setdefault(tc, {}).setdefault(d, {})[tm] = True
            teacher_day_load.setdefault(tc, {})[d] = teacher_day_load.get(tc, {}).get(d, 0) + 1
            teacher_week_load[tc] = teacher_week_load.get(tc, 0) + 1
            
    def is_free(c, r, tc, d, tm):
        # Check global busy maps
        if c and class_busy.get(c, {}).get(d, {}).get(tm): return False
        if r:
            current_rooms = room_busy.get(r, {}).get(d, {}).get(tm, 0)
            capacity = 3 if "спортзал" in r.lower() else 1
            if current_rooms >= capacity: return False
        if tc and teacher_busy.get(tc, {}).get(d, {}).get(tm): return False
        
        # Check explicit unavailability (sick days / maintenance)
        if tc and d in unavail_t.get(tc, []): return False
        if r and d in unavail_r.get(r, []): return False
        
        return True

    total_lessons = 0
    conflicts = 0
    lents_placed = 0
    
    for lent in lents:
        p_classes = lent.get("parallelClasses", [])
        grps = lent.get("groups", 1)
        gnames = lent.get("groupNames", [])
        lent_t = lent.get("teachers", [])
        lent_r = lent.get("rooms", [])
        lent_type = lent.get("type", "level")
        group_data = lent.get("groupData", [])
        lent_id = lent.get("id")
        
        # 1. Линейный поиск общего "окна" для всех участников ленты
        found_slot = None
        for d in days:
            for t in time_slots:
                can_place = True
                if lent_type == "profile":
                    for cls in p_classes:
                        if not is_free(cls, None, None, d, t): 
                            can_place = False
                            break
                    if not can_place: continue
                    for gd in group_data:
                        if gd.get("room") and not is_free(None, gd.get("room"), None, d, t): can_place = False; break
                        if gd.get("teacher") and not is_free(None, None, gd.get("teacher"), d, t): can_place = False; break
                else:
                    for gi in range(grps):
                        teacher = lent_t[gi] if gi < len(lent_t) else ""
                        room = lent_r[gi] if gi < len(lent_r) else ""
                        assigned = [c for i, c in enumerate(p_classes) if i % grps == gi]
                        for cls in assigned:
                            if not is_free(cls, room, teacher, d, t):
                                can_place = False
                                break
                        if not can_place: break
                
                if can_place:
                    found_slot = (d, t)
                    break
            if found_slot: break
            
        if not found_slot:
            conflicts += 1
            print(f"Внимание: Не удалось найти слот для ленты {lent_id}")
            continue
            
        fd, ft = found_slot
        
        # 2. Фактическое размещение в найденный слот (fd, ft)
        if lent_type == "profile":
            all_s = []
            all_r = []
            all_t = []
            for gd in group_data:
                if gd.get("subject"): all_s.append(gd["subject"])
                if gd.get("room"): all_r.append(gd["room"])
                if gd.get("teacher"): all_t.append(gd["teacher"])
            
            agg_subject = " / ".join(all_s) if all_s else lent.get("subject", "")
            agg_room = " / ".join(all_r) if all_r else "..."
            agg_teacher = " / ".join(all_t) if all_t else "Учителя"
            
            for cls in p_classes:
                schedule[cls][fd][ft] = {
                    "subject": agg_subject,
                    "teacher": agg_teacher,
                    "room": agg_room,
                    "isLent": True,
                    "lentType": "profile",
                    "lentId": lent_id
                }
            for gd in group_data:
                # В профиле кабинеты и учителя не привязаны к конкретному классу, но заняты на это время
                for cls in p_classes: mark_busy(None, gd.get("room"), gd.get("teacher"), fd, ft)
                
            total_lessons += len(p_classes)
        else:
            for gi in range(grps):
                teacher = lent_t[gi] if gi < len(lent_t) else ""
                room = lent_r[gi] if gi < len(lent_r) else ""
                gname = gnames[gi] if gi < len(gnames) else f"Группа {gi+1}"
                assigned = [c for i, c in enumerate(p_classes) if i % grps == gi]
                
                for cls in assigned:
                    schedule[cls][fd][ft] = {
                        "subject": lent.get("subject", "Ағылшын тілі"),
                        "teacher": teacher,
                        "room": room,
                        "isLent": True,
                        "lentType": "level",
                        "lentGroup": gname,
                        "lentId": lent_id
                    }
                    mark_busy(cls, room, teacher, fd, ft)
                    total_lessons += 1
        lents_placed += 1
        
    queue = []
    strict = {}
    
    # Count how many slots each class already consumed by lents
    class_used_slots = {}
    for cls in classes:
        count = 0
        for d in days:
            for tm in time_slots:
                if class_busy.get(cls, {}).get(d, {}).get(tm):
                    count += 1
        class_used_slots[cls] = count
    
    MAX_SLOTS = len(days) * len(time_slots)  # 40
    
    # 1. Build strict assignments (highest priority)
    for t in teachers:
        if t.get("assignments"):
            for subj, cmap in t["assignments"].items():
                for cls, hrs in cmap.items():
                    if hrs > 0:
                        lent_hrs = sum(1 for l in lents if cls in l.get("parallelClasses", []) and l.get("subject","").lower() == subj.lower())
                        rem = max(0, hrs - lent_hrs)
                        if rem > 0:
                            queue.append({"cls": cls, "subject": subj, "teacher": t["name"], "hours": rem, "priority": 0})
                            strict.setdefault(cls, {})[subj.lower()] = strict.get(cls, {}).get(subj.lower(), 0) + rem
                            
    # 2. Build generic subjects (lower priority)
    for cls in classes:
        for subj_obj in subjects:
            subj = subj_obj.get("subject", "")
            hpw = subj_obj.get("hoursPerWeek", 0)
            
            m = re.search(r"\d+", cls)
            grade = m.group(0) if m else "7"
            
            # Check for class-specific override
            overrides = subj_obj.get("overrides", {})
            if cls in overrides:
                tot_hrs = overrides[cls]
            else:
                tot_hrs = hpw.get(grade, 0) if isinstance(hpw, dict) else hpw

            if strict.get(cls, {}).get(subj.lower(), 0) > 0: continue
            
            lent_hrs = sum(1 for l in lents if cls in l.get("parallelClasses", []) and l.get("subject","").lower() == subj.lower())
            rem = max(0, tot_hrs - lent_hrs)
            if rem > 0: queue.append({"cls": cls, "subject": subj, "teacher": None, "hours": rem, "priority": 1})
            
    # Sort: strict first (priority=0), then by hours descending, then alphabetically for stability
    queue.sort(key=lambda x: (x["priority"], -x["hours"], x["cls"], x["subject"]))
    
    # --- CAP: trim queue so each class doesn't exceed MAX_SLOTS ---
    class_planned = {}  # total planned hours per class
    for item in queue:
        class_planned.setdefault(item["cls"], 0)
        class_planned[item["cls"]] += item["hours"]
    
    trimmed_queue = []
    class_budget = {cls: MAX_SLOTS - class_used_slots.get(cls, 0) for cls in classes}
    overflow_warnings = []
    
    for item in queue:
        cls = item["cls"]
        budget = class_budget.get(cls, MAX_SLOTS)
        if budget <= 0:
            overflow_warnings.append(f"Класс {cls}: {item['subject']} ({item['hours']} ч.) — не вошло в сетку (макс. {MAX_SLOTS} уроков/неделю).")
            continue
        if item["hours"] <= budget:
            trimmed_queue.append(item)
            class_budget[cls] = budget - item["hours"]
        else:
            # Partial fit
            trimmed_queue.append({**item, "hours": budget})
            overflow_warnings.append(f"Класс {cls}: {item['subject']} ({item['hours'] - budget} ч. из {item['hours']}) — обрезано до лимита сетки.")
            class_budget[cls] = 0
    
    queue = trimmed_queue
    
    gen_teachers = []
    for t in teachers:
        gen_teachers.append({
            "name": t.get("name"),
            "lowerSubjects": [s.lower() for s in t.get("subjects", [])],
            "limitDay": t.get("maxHoursPerDay", 6),
            "limitWeek": t.get("maxHoursPerWeek", 40)
        })
        
    phys = ["физика", "химия", "биология"]
    pe = ["дене шынықтыру", "физкультура", "дене тәрбиесі", "дене шынықтыру: спорттық ойындар"]
    
    for item in queue:
        placed = 0
        sl = item["subject"].lower()
        is_pe = any(p in sl for p in pe)
        is_phys = sl in phys
        pref_types = ["gym"] if is_pe else ["lab", "classroom"] if is_phys else ["classroom", "lab"]
        
    # Define all available slots in a linear order (stable)
    all_slots = [{"day": d, "time": t} for d in days for t in time_slots]
    
    for item in queue:
        placed = 0
        sl = item["subject"].lower()
        is_pe = any(p in sl for p in pe)
        is_phys = sl in phys
        pref_types = ["gym"] if is_pe else ["lab", "classroom"] if is_phys else ["classroom", "lab"]
        
        # We try slots in a stable linear order to fill mornings and reduce windows
        for slot in all_slots:
            if placed >= item["hours"]: break
            d, t = slot["day"], slot["time"]
            
            # Check if class is free
            if not is_free(item["cls"], None, None, d, t): continue
            
            sel_t = None
            if item["teacher"]:
                # Check assigned teacher
                for gt in gen_teachers:
                    if gt["name"] == item["teacher"]:
                        if is_free(None, None, item["teacher"], d, t) and \
                           teacher_day_load.get(item["teacher"],{}).get(d,0) < gt["limitDay"] and \
                           teacher_week_load.get(item["teacher"],0) < gt["limitWeek"]:
                            sel_t = item["teacher"]
                        break
            else:
                # Find best matching teacher (who has lowest load and satisfies limits)
                capable = [gt for gt in gen_teachers if sl in gt["lowerSubjects"] and is_free(None, None, gt["name"], d, t)]
                capable = [gt for gt in capable if teacher_day_load.get(gt["name"],{}).get(d,0) < gt["limitDay"] and \
                           teacher_week_load.get(gt["name"],0) < gt["limitWeek"]]
                
                if capable:
                    capable.sort(key=lambda x: (teacher_day_load.get(x["name"], {}).get(d, 0), teacher_week_load.get(x["name"], 0)))
                    sel_t = capable[0]["name"]
                    
            if not sel_t: continue
            
            # Find best room
            sel_r = None
            for ptype in pref_types:
                free_rr = [r["name"] for r in rooms if r.get("type") == ptype and is_free(None, r["name"], None, d, t)]
                if free_rr:
                    # Deterministic room choice based on room index (to keep it stable)
                    sel_r = free_rr[0] 
                    break
            
            if not sel_r: continue
            
            schedule[item["cls"]][d][t] = {
                "subject": item["subject"],
                "teacher": sel_t,
                "room": sel_r
            }
            mark_busy(item["cls"], sel_r, sel_t, d, t)
            total_lessons += 1
            placed += 1

    
    return {
        "status": "success",
        "lessons_placed": total_lessons,
        "schedule": schedule
    }

@app.post("/api/ai/command")
async def process_command(cmd: dict):
    command = cmd.get("text", "")
    try:
        teachers = [r['name'] for r in query_db("SELECT name FROM teachers")]
        
        prompt = f"""
        Ты — интеллектуальный директорский помощник 'Aqbobek Intelligence'. 
        Твоя задача — понимать команды директора и преобразовывать их в действия.

        КОНТЕКСТ:
        - Список учителей: {', '.join(teachers)}
        - Доступные платформы: WhatsApp.
        - Основные контакты: 'Adil' (Завуч/Кураторы), 'Султан' (Хоз. часть).

        ВОЗМОЖНЫЕ ДЕЙСТВИЯ (intents):
        1. "send_message" -> если просят написать, отправить сообщение, связаться.
        2. "schedule_change" -> замены, отмена уроков, перенос.
        3. "report_request" -> статистика, питание, посещаемость.
        4. "calendar_event" -> встречи, мероприятия, совещания.
        5. "navigation" -> просто перейти на страницу (расписание, отчеты и т.д.).

        JSON ФОРМАТ ОТВЕТА (строго):
        {{
          "intent": "send_message" | "schedule_change" | "report_request" | "calendar_event" | "navigation",
          "summary": "Краткое описание того, что я понял (1 предложение)",
          "route": "/schedule" | "/reports" | "/calendar" | "/chat-summary" | "/",
          "entities": {{
            "target": "Имя или группа",
            "message": "Текст сообщения для отправки",
            "date": "Дата или день недели",
            "subject": "Предмет",
            "teacher": "Учитель"
          }},
          "proposedAction": {{
            "type": "send_whatsapp" | "update_schedule" | "create_event" | "none",
            "description": "Человекочитаемое описание действия",
            "params": {{}}
          }}
        }}

        Пример: "Напиши Адилю, что завтра совещание в 10"
        Ответ: {{"intent": "send_message", "summary": "Отправка сообщения Адилю о совещании", "entities": {{"target": "Adil", "message": "Завтра совещание в 10"}}, "proposedAction": {{"type": "send_whatsapp", "params": {{"contact": "Adil", "message": "Завтра совещание в 10"}}}}}}

        Команда директора: "{command}"
        """

        headers = {"Authorization": f"Bearer {API_KEY}"}
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0,
            "response_format": {"type": "json_object"}
        }
        
        async with httpx.AsyncClient() as client:
            resp = await client.post(GROQ_URL, headers=headers, json=payload, timeout=30)
        data = resp.json()['choices'][0]['message']['content']
        result = json.loads(data)
        
        # Hardcoding logic for specific names
        low_cmd = command.lower()
        if "адиль" in low_cmd or "адилю" in low_cmd or "куратор" in low_cmd:
            result["entities"]["target"] = "Adil"
            if result["proposedAction"]["type"] == "send_whatsapp":
                result["proposedAction"]["params"]["contact"] = "Adil"

        elif "султан" in low_cmd or "султану" in low_cmd or "хоз" in low_cmd:
            result["entities"]["target"] = "Султан"
            if result["proposedAction"]["type"] == "send_whatsapp":
                result["proposedAction"]["params"]["contact"] = "Султан"

        return result
        
    except Exception as e:
        print(f"Command processing error: {e}")
        return {"intent": "unknown", "summary": f"Ошибка: {str(e)}", "proposedAction": {"type": "none"}}

@app.post("/api/ai/execute")
async def execute_ai_action(action: dict):
    """Executes the action proposed by the AI"""
    try:
        atype = action.get("type")
        params = action.get("params", {})
        
        if atype == "send_whatsapp":
            contact = params.get("contact", "Adil")
            message = params.get("message", "")
            
            import httpx
            async with httpx.AsyncClient() as client:
                data = {"contactName": contact, "text": message}
                resp = await client.post(f"{WA_SERVICE_URL}/send-contact", json=data, timeout=10.0)
                if resp.status_code != 200:
                    # Fallback to group if needed or return error
                    return {"success": False, "error": f"WA Gateway error: {resp.text}"}
            return {"success": True, "message": f"Сообщение отправлено {contact}"}
            
        elif atype == "update_schedule":
            # Implementation for schedule updates could go here
            return {"success": True, "message": "Расписание обновлено (симуляция)"}
            
        return {"success": False, "error": "Unknown action type"}
        
    except Exception as e:
        print(f"Execution error: {e}")
        return {"success": False, "error": str(e)}

@app.get("/api/schedule")
async def get_full_schedule():
    """Returns the entire schedule from DB in the Record<Class, Record<Day, Record<Time, Cell>>> format"""
    try:
        rows = query_db("SELECT * FROM schedule_cells")
        result = {}
        for r in rows:
            cls = r["class_name"]
            day = r["day"]
            time = r["time_slot"]
            if cls not in result: result[cls] = {}
            if day not in result[cls]: result[cls][day] = {}
            result[cls][day][time] = {
                "subject": r["subject"],
                "teacher": r["teacher"],
                "room": r["room"],
                "isLent": bool(r["is_lent"]),
                "lentType": r["lent_type"],
                "lentGroup": r["lent_group"]
            }
        return result
    except Exception as e:
        print(f"Error fetching schedule: {e}")
        return {}

@app.post("/api/schedule")
async def save_full_schedule(schedule: dict):
    """Saves the entire schedule to DB, overwriting previous one"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("DELETE FROM schedule_cells")
        
        for cls_name, days in schedule.items():
            for day, slots in days.items():
                for time, cell in slots.items():
                    if not cell: continue
                    cur.execute('''
                        INSERT INTO schedule_cells (class_name, day, time_slot, subject, teacher, room, is_lent, lent_type, lent_group)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        cls_name, day, time, 
                        cell.get("subject"), cell.get("teacher"), cell.get("room"),
                        cell.get("isLent", False), cell.get("lentType"), cell.get("lentGroup")
                    ))
        conn.commit()
        conn.close()
        return {"success": True, "message": "Schedule saved to database"}
    except Exception as e:
        print(f"Error saving schedule: {e}")
        return {"success": False, "error": str(e)}

@app.get("/api/teachers")
async def get_teachers():
    try:
        # Берем уникальных учителей прямо из текущего расписания + из статической таблицы
        from_cells = query_db("SELECT DISTINCT teacher FROM schedule_cells WHERE teacher IS NOT NULL AND teacher != ''")
        set1 = {r["teacher"] for r in from_cells}
        
        from_table = query_db("SELECT name FROM teachers")
        set2 = {r["name"] for r in from_table}
        
        all_teachers = sorted(list(set1 | set2))
        return all_teachers
    except Exception as e:
        print(f"Error fetching teachers: {e}")
        return []

@app.get("/api/rooms")
async def get_rooms():
    try:
        rows = query_db("SELECT name FROM rooms ORDER BY name")
        return [r["name"] for r in rows]
    except:
        return []

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

