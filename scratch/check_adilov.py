import sqlite3
import json

def check():
    conn = sqlite3.connect('server/schedule.db')
    cur = conn.cursor()
    # Check Adilov using substring to avoid encoding issues here
    cur.execute("SELECT day, time_slot, class_name, subject, teacher FROM schedule_cells")
    all_lessons = cur.fetchall()
    
    # Filter in python to be safe
    adilov_lessons = [l for l in all_lessons if l[4] and 'Аділов' in l[4]]
    
    with open('adilov_debug.json', 'w', encoding='utf-8') as f:
        json.dump(adilov_lessons, f, ensure_ascii=False, indent=2)
    conn.close()

if __name__ == "__main__":
    check()
