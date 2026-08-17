import asyncio
import time
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from app.db import get_db

router = APIRouter(prefix="/api/overview", tags=["overview"])

_weather_cache = {"data": None, "timestamp": 0}

class TodoCreate(BaseModel):
    text: str
    category: Optional[str] = "general" # 'ai', 'dev', 'general'
    priority: Optional[str] = "medium"  # 'low', 'medium', 'high'

class TodoUpdate(BaseModel):
    text: Optional[str] = None
    completed: Optional[bool] = None
    category: Optional[str] = None
    priority: Optional[str] = None

async def init_todos_table():
    db = await get_db()
    await db.execute("""
        CREATE TABLE IF NOT EXISTS todos (
            id TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            completed BOOLEAN DEFAULT 0,
            category TEXT DEFAULT 'general',
            priority TEXT DEFAULT 'medium',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    await db.commit()

@router.get("/weather")
async def get_weather():
    global _weather_cache
    now = time.time()
    if _weather_cache["data"] and (now - _weather_cache["timestamp"] < 900): # 15 min cache
        return _weather_cache["data"]

    try:
        # Fetch weather from wttr.in or open-meteo
        async with httpx.AsyncClient(timeout=4.0) as client:
            res = await client.get("https://wttr.in/?format=j1")
            if res.status_code == 200:
                data = res.json()
                current = data.get("current_condition", [{}])[0]
                area = data.get("nearest_area", [{}])[0]
                city = area.get("areaName", [{}])[0].get("value", "Local City")
                country = area.get("country", [{}])[0].get("value", "")
                
                temp_c = current.get("temp_C", "24")
                desc = current.get("weatherDesc", [{}])[0].get("value", "Clear")
                humidity = current.get("humidity", "45")
                wind_kmph = current.get("windspeedKmph", "12")
                feels_like = current.get("FeelsLikeC", temp_c)

                weather_payload = {
                    "city": city,
                    "country": country,
                    "temperature": int(temp_c) if temp_c.isdigit() else 24,
                    "feels_like": int(feels_like) if feels_like.isdigit() else 24,
                    "condition": desc,
                    "humidity": f"{humidity}%",
                    "wind": f"{wind_kmph} km/h",
                    "status": "online"
                }
                _weather_cache = {"data": weather_payload, "timestamp": now}
                return weather_payload
    except Exception as e:
        pass

    # Fallback default if offline / timed out
    fallback = {
        "city": "Local Station",
        "country": "",
        "temperature": 25,
        "feels_like": 25,
        "condition": "Partly Cloudy",
        "humidity": "48%",
        "wind": "14 km/h",
        "status": "cached"
    }
    return fallback

@router.get("/todos")
async def list_todos():
    await init_todos_table()
    db = await get_db()
    cursor = await db.execute("SELECT id, text, completed, category, priority, created_at FROM todos ORDER BY completed ASC, created_at DESC;")
    rows = await cursor.fetchall()
    todos = []
    for r in rows:
        d = dict(r)
        d["completed"] = bool(d["completed"])
        todos.append(d)
    return todos

@router.post("/todos")
async def create_todo(todo: TodoCreate):
    await init_todos_table()
    import uuid
    todo_id = f"todo-{uuid.uuid4().hex[:8]}"
    db = await get_db()
    await db.execute(
        "INSERT INTO todos (id, text, completed, category, priority) VALUES (?, ?, 0, ?, ?);",
        (todo_id, todo.text, todo.category, todo.priority)
    )
    await db.commit()
    return {"id": todo_id, "text": todo.text, "completed": False, "category": todo.category, "priority": todo.priority}

@router.patch("/todos/{todo_id}")
async def update_todo(todo_id: str, updates: TodoUpdate):
    await init_todos_table()
    db = await get_db()
    cursor = await db.execute("SELECT id, text, completed, category, priority FROM todos WHERE id = ?;", (todo_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Todo not found")
    
    current = dict(row)
    new_text = updates.text if updates.text is not None else current["text"]
    new_completed = int(updates.completed) if updates.completed is not None else current["completed"]
    new_cat = updates.category if updates.category is not None else current["category"]
    new_pri = updates.priority if updates.priority is not None else current["priority"]

    await db.execute(
        "UPDATE todos SET text = ?, completed = ?, category = ?, priority = ? WHERE id = ?;",
        (new_text, new_completed, new_cat, new_pri, todo_id)
    )
    await db.commit()
    return {"id": todo_id, "text": new_text, "completed": bool(new_completed), "category": new_cat, "priority": new_pri}

@router.delete("/todos/{todo_id}")
async def delete_todo(todo_id: str):
    await init_todos_table()
    db = await get_db()
    await db.execute("DELETE FROM todos WHERE id = ?;", (todo_id,))
    await db.commit()
    return {"status": "deleted", "id": todo_id}
