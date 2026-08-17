from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import uuid
import json
from typing import List, Dict, Any, Optional
from app.db import get_db

router = APIRouter(prefix="/api/agents", tags=["agents"])

class CreateAgentRequest(BaseModel):
    name: str
    avatar: str = "🤖"
    role: str
    system_prompt: str
    model_provider: str = "ollama"
    model_id: str = "qwen3.8:27b"
    temperature: float = 0.2
    thinking_level: str = "medium"
    tools: List[str] = ["read", "bash", "edit", "write"]

class UpdateAgentRequest(BaseModel):
    name: Optional[str] = None
    avatar: Optional[str] = None
    role: Optional[str] = None
    system_prompt: Optional[str] = None
    model_provider: Optional[str] = None
    model_id: Optional[str] = None
    temperature: Optional[float] = None
    thinking_level: Optional[str] = None
    tools: Optional[List[str]] = None
    status: Optional[str] = None
    current_task: Optional[str] = None

@router.get("")
async def list_agents():
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM agents ORDER BY created_at ASC;")
        rows = await cursor.fetchall()
        agents = []
        for r in rows:
            agent = dict(r)
            try:
                agent["tools"] = json.loads(agent["tools"])
            except Exception:
                agent["tools"] = []
            agents.append(agent)
        return agents
    finally:
        await db.close()

@router.post("")
async def create_agent(req: CreateAgentRequest):
    db = await get_db()
    try:
        agent_id = f"agent-{uuid.uuid4().hex[:8]}"
        await db.execute("""
        INSERT INTO agents (id, name, avatar, role, system_prompt, model_provider, model_id, temperature, thinking_level, tools, status, current_task)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'idle', '');
        """, (
            agent_id,
            req.name,
            req.avatar,
            req.role,
            req.system_prompt,
            req.model_provider,
            req.model_id,
            req.temperature,
            req.thinking_level,
            json.dumps(req.tools)
        ))
        await db.commit()
        return {"status": "created", "id": agent_id}
    finally:
        await db.close()

@router.put("/{agent_id}")
async def update_agent(agent_id: str, req: UpdateAgentRequest):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM agents WHERE id = ?;", (agent_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        current = dict(row)
        name = req.name if req.name is not None else current["name"]
        avatar = req.avatar if req.avatar is not None else current["avatar"]
        role = req.role if req.role is not None else current["role"]
        system_prompt = req.system_prompt if req.system_prompt is not None else current["system_prompt"]
        model_provider = req.model_provider if req.model_provider is not None else current["model_provider"]
        model_id = req.model_id if req.model_id is not None else current["model_id"]
        temperature = req.temperature if req.temperature is not None else current["temperature"]
        thinking_level = req.thinking_level if req.thinking_level is not None else current["thinking_level"]
        tools = json.dumps(req.tools) if req.tools is not None else current["tools"]
        status = req.status if req.status is not None else current["status"]
        current_task = req.current_task if req.current_task is not None else current["current_task"]

        await db.execute("""
        UPDATE agents SET
            name = ?, avatar = ?, role = ?, system_prompt = ?, model_provider = ?,
            model_id = ?, temperature = ?, thinking_level = ?, tools = ?, status = ?, current_task = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?;
        """, (name, avatar, role, system_prompt, model_provider, model_id, temperature, thinking_level, tools, status, current_task, agent_id))
        await db.commit()
        return {"status": "updated", "id": agent_id}
    finally:
        await db.close()

@router.delete("/{agent_id}")
async def delete_agent(agent_id: str):
    db = await get_db()
    try:
        await db.execute("DELETE FROM agents WHERE id = ?;", (agent_id,))
        await db.commit()
        return {"status": "deleted", "id": agent_id}
    finally:
        await db.close()

@router.get("/activity/logs")
async def get_activity_logs(limit: int = 50):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT ?;", (limit,))
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()

@router.delete("/activity/logs")
async def clear_activity_logs():
    db = await get_db()
    try:
        await db.execute("DELETE FROM activity_logs;")
        await db.commit()
        return {"status": "cleared"}
    finally:
        await db.close()
