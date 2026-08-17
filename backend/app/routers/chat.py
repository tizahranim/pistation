from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json
import uuid
import os
import time
import asyncio
from typing import List, Dict, Any, Optional
from app.db import get_db
from app.services.llm_router import LLMRouter
from app.services.multi_agent_orchestrator import MultiAgentOrchestrator
from app.services.doc_indexer import DocIndexer

router = APIRouter(prefix="/api/chat", tags=["chat"])

class SingleChatRequest(BaseModel):
    session_id: Optional[str] = None
    agent_id: str
    message: str
    model_id: Optional[str] = None
    model_provider: Optional[str] = None
    document_ids: Optional[List[str]] = []

@router.post("/reset-stuck-agents")
async def reset_stuck_agents():
    """Resets all agent statuses to idle."""
    db = await get_db()
    try:
        await db.execute("UPDATE agents SET status = 'idle', current_task = '';")
        await db.execute("UPDATE discussions SET status = 'interrupted' WHERE status = 'in_progress';")
        await db.commit()
        return {"status": "reset"}
    finally:
        await db.close()

@router.post("/single/stream")
async def chat_single_stream(req: SingleChatRequest):
    db = await get_db()
    
    # 1. Resolve session
    session_id = req.session_id
    if not session_id:
        session_id = f"session-{uuid.uuid4().hex[:8]}"
        session_title = req.message.strip()[:35]
        if len(req.message.strip()) > 35:
            session_title += "..."
        await db.execute("""
        INSERT INTO sessions (id, title, mode, agent_id, created_at, updated_at)
        VALUES (?, ?, 'single', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        """, (session_id, session_title, req.agent_id))
        await db.commit()

    # 2. Resolve agent
    cursor = await db.execute("SELECT * FROM agents WHERE id = ?;", (req.agent_id,))
    agent_row = await cursor.fetchone()
    if not agent_row:
        # Fallback to default agent
        cursor = await db.execute("SELECT * FROM agents LIMIT 1;")
        agent_row = await cursor.fetchone()
    agent = dict(agent_row)

    # 3. Store user message in DB
    user_msg_id = f"msg-{uuid.uuid4().hex[:8]}"
    await db.execute("""
    INSERT INTO messages (id, session_id, role, content, created_at)
    VALUES (?, ?, 'user', ?, CURRENT_TIMESTAMP);
    """, (user_msg_id, session_id, req.message))
    await db.execute("UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?;", (session_id,))
    await db.commit()

    # 4. Fetch previous conversation context
    cursor = await db.execute("""
    SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC;
    """, (session_id,))
    msg_rows = await cursor.fetchall()
    context_messages = [{"role": r["role"], "content": r["content"]} for r in msg_rows]

    # 5. Fetch attached file content directly
    doc_context = ""
    if req.document_ids:
        placeholders = ",".join("?" for _ in req.document_ids)
        cursor = await db.execute(f"SELECT id, filename, file_path, summary FROM documents WHERE id IN ({placeholders});", tuple(req.document_ids))
        doc_rows = await cursor.fetchall()
        attached_files_context = []
        for d in doc_rows:
            content = ""
            if os.path.exists(d["file_path"]):
                try:
                    with open(d["file_path"], "r", errors="ignore") as f:
                        content = f.read(25000)
                except Exception:
                    pass
            attached_files_context.append(
                f"--- Attached File: {d['filename']} ---\n"
                f"Absolute Path: {d['file_path']}\n"
                f"File Content:\n```\n{content}\n```"
            )

        if attached_files_context:
            doc_context = "\n=== USER ATTACHED FILES ===\n" + "\n\n".join(attached_files_context) + "\n===========================\n"

    # 6. Fetch persistent long-term memories
    cursor = await db.execute("SELECT category, key, value FROM memories ORDER BY created_at ASC;")
    memory_rows = await cursor.fetchall()
    memory_context = ""
    if memory_rows:
        memory_lines = [f"- {r['key']}: {r['value']}" for r in memory_rows]
        memory_context = "### PERSISTENT LONG-TERM MEMORY & USER PROFILE:\n" + "\n".join(memory_lines)

    # 7. Execute any real-time Todo actions (Create, Delete, Complete) requested by the user
    cleaned_lower_user = req.message.lower().strip()
    import re

    # Check Deletion
    if any(k in cleaned_lower_user for k in ["delete all", "clear all", "delete todo", "delete the todo", "clear todo", "clear the todo", "clear my todo", "clear my to do", "remove todo", "remove the todo", "delete to-do", "delete the to-do", "delete all tasks", "delete all goals"]):
        await db.execute("DELETE FROM todos;")
        await db.commit()
    # Check Completion
    elif ("mark" in cleaned_lower_user or "set" in cleaned_lower_user) and ("done" in cleaned_lower_user or "completed" in cleaned_lower_user or "finished" in cleaned_lower_user):
        await db.execute("UPDATE todos SET completed = 1;")
        await db.commit()
    # Check Creation / Addition
    else:
        patterns = [
            r'(?:create|add|put|record|make|insert|set|save|new)\s+(?:a|an|the|new|another)?\s*(?:to-do|to do|todo|task|goal|item)?\s*(?:to\s+(?:my\s+)?(?:to-do|to do|todo|tasks|task|goals|list)(?:\s+list)?)?[:\s]+(.*)',
            r'remind me to\s+(.*)',
            r'(?:new|add)\s+(?:task|todo|to-do|to do)[:\s]+(.*)'
        ]
        for p in patterns:
            m = re.search(p, req.message, re.IGNORECASE)
            if m:
                raw_task = m.group(1).strip(' .!?-')
                for prefix in ['to ', 'that ', 'list: ', 'list ']:
                    if raw_task.lower().startswith(prefix):
                        raw_task = raw_task[len(prefix):].strip()
                if len(raw_task) > 1:
                    new_t_id = f"todo-{uuid.uuid4().hex[:8]}"
                    clean_task_text = raw_task[0].upper() + raw_task[1:]
                    await db.execute("INSERT INTO todos (id, text, completed, category, priority) VALUES (?, ?, 0, 'general', 'medium');", (new_t_id, clean_task_text))
                    await db.commit()
                    break

    # Fetch active & pending to-dos
    cursor = await db.execute("SELECT id, text, completed, priority, category FROM todos ORDER BY completed ASC, created_at DESC;")
    todo_rows = await cursor.fetchall()
    
    pending = [f"- [{r['priority'].upper()}] {r['text']}" for r in todo_rows if not r['completed']]
    completed = [f"- [COMPLETED] {r['text']}" for r in todo_rows if r['completed']]
    
    todo_lines = []
    if pending:
        todo_lines.append("ACTIVE PENDING TASKS:")
        todo_lines.extend(pending)
    else:
        todo_lines.append("ACTIVE PENDING TASKS: None (The user's to-do list currently has no active items).")
        
    if completed:
        todo_lines.append("\nRECENTLY COMPLETED TASKS:")
        todo_lines.extend(completed)
        
    todo_context = (
        "### CURRENT STATION TO-DO LIST & ACTIVE TASKS (Persistent SQLite Database State):\n"
        + "\n".join(todo_lines)
        + "\n\n"
        "### CRITICAL BUILT-IN TO-DO SYSTEM INSTRUCTIONS:\n"
        "1. You have direct, real-time access to the user's PiStation station database and to-do list above.\n"
        "2. When the user asks 'do I have any active to do?', 'check my todos', 'what are my tasks?', or asks for their checklist, ALWAYS answer directly and accurately using the real-time list above (or tell them their to-do list is currently empty if there are 0 tasks).\n"
        "3. When the user asks you to add, complete, or delete a task, it has ALREADY been modified in their local SQLite database before generating this response. Confirm the change concisely and helpfully.\n"
        "4. NEVER say that you lack visibility into the station database, and NEVER offer to build/scaffold external to-do apps."
    )

    target_model = req.model_id or agent["model_id"]
    
    # Auto-resolve provider: if model_id is a local Ollama model or custom model (no '/' in name), use 'ollama'
    if req.model_provider:
        target_provider = req.model_provider
    elif "/" in target_model and not target_model.startswith("unsloth/"):
        target_provider = "openrouter"
    else:
        target_provider = "ollama"

    # 8. Check if target_model is a custom fine-tuned model or direct model
    cursor = await db.execute("SELECT id, name, target_identifier, domain_focus, modelfile_content FROM finetune_jobs WHERE target_identifier = ? OR name = ?;", (target_model, target_model))
    custom_job_row = await cursor.fetchone()

    if custom_job_row:
        custom_job = dict(custom_job_row)
        display_agent_name = custom_job["name"]
        display_agent_avatar = "🎯"
        display_agent_role = f"Custom Fine-Tuned Model ({custom_job.get('domain_focus', 'Specialist')})"
        system_prompt = f"You are {display_agent_name}, a specialized fine-tuned AI model running directly on local Dual RTX 5070 GPUs under identifier {target_model}.\nYour core specialty and domain focus is: {custom_job.get('domain_focus', 'Specialized tasks')}.\nProvide authoritative, precise, high-accuracy responses adhering strictly to domain best practices."
    elif target_model != agent["model_id"]:
        # User explicitly chose a specific model engine from the dropdown that differs from the agent's default
        display_agent_name = target_model
        display_agent_avatar = "⚡"
        display_agent_role = f"Direct Engine ({target_model})"
        system_prompt = f"You are an AI assistant running directly on {target_model} via {target_provider}.\nBe direct, intelligent, and helpful."
    else:
        # Standard configured agent persona
        display_agent_name = agent["name"]
        display_agent_avatar = agent["avatar"]
        display_agent_role = agent["role"]
        system_prompt = f"You are {agent['name']} ({agent['role']}). Your active underlying engine is {target_model}. If asked what model you are, accurately state you are {target_model}.\n\n{agent['system_prompt']}"
    
    if memory_context:
        system_prompt += f"\n\n{memory_context}"
    if todo_context:
        system_prompt += f"\n\n{todo_context}"

    if doc_context:
        system_prompt += f"\n\nUse the following document excerpts to ground your answers:\n{doc_context}"

    await db.close()

    async def sse_generator():
        yield f"data: {json.dumps({'type': 'init', 'session_id': session_id, 'agent': {'id': agent['id'], 'name': display_agent_name, 'avatar': display_agent_avatar, 'model': target_model}})}\n\n"
        
        # Update agent status to thinking
        db_stream = await get_db()
        try:
            await db_stream.execute("UPDATE agents SET status = 'thinking', current_task = ? WHERE id = ?;", (f"Replying to: {req.message[:25]}...", agent["id"]))
            await db_stream.commit()
        except Exception:
            pass

        full_reply = ""
        full_thinking = ""
        start_time = time.time()

        try:
            # Stream directly and smoothly via LLMRouter
            async for chunk in LLMRouter.chat_stream(
                model=target_model,
                messages=context_messages,
                system_prompt=system_prompt,
                provider=target_provider,
                temperature=agent.get("temperature", 0.2)
            ):
                if chunk.get("thinking"):
                    full_thinking += chunk["thinking"]
                    yield f"data: {json.dumps({'type': 'thinking', 'content': chunk['thinking']})}\n\n"
                if chunk.get("content"):
                    full_reply += chunk["content"]
                    yield f"data: {json.dumps({'type': 'token', 'content': chunk['content']})}\n\n"
        except Exception as e:
            err_msg = f"⚠️ Generation error: {str(e)}"
            full_reply = err_msg
            yield f"data: {json.dumps({'type': 'token', 'content': err_msg})}\n\n"

        elapsed_ms = int((time.time() - start_time) * 1000)

        if not full_reply and full_thinking:
            full_reply = full_thinking

        # Save assistant message and update session timestamps
        asst_msg_id = f"msg-{uuid.uuid4().hex[:8]}"
        try:
            await db_stream.execute("""
            INSERT INTO messages (id, session_id, role, agent_id, agent_name, agent_avatar, content, thinking_content, model_id, model_provider, latency_ms, created_at)
            VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
            """, (asst_msg_id, session_id, agent["id"], display_agent_name, display_agent_avatar, full_reply or "...", full_thinking, target_model, target_provider, elapsed_ms))
            
            await db_stream.execute("UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?;", (session_id,))
            await db_stream.execute("UPDATE agents SET status = 'idle', current_task = '' WHERE id = ?;", (agent["id"],))
            await db_stream.commit()

            yield f"data: {json.dumps({'type': 'done', 'session_id': session_id, 'message_id': asst_msg_id, 'model_id': target_model, 'model_provider': target_provider, 'latency_ms': elapsed_ms})}\n\n"
        finally:
            await db_stream.close()

    return StreamingResponse(sse_generator(), media_type="text/event-stream")

class DiscussionRequest(BaseModel):
    title: str
    topic: str
    agent_ids: List[str]
    document_ids: Optional[List[str]] = []
    leader_id: Optional[str] = None
    roles_map: Optional[Dict[str, str]] = {}
    human_guidance: Optional[str] = None
    rounds: int = 2

@router.post("/discussion/stream")
async def discussion_stream(req: DiscussionRequest):
    db = await get_db()
    discussion_id = f"disc-{uuid.uuid4().hex[:8]}"
    await db.execute("""
    INSERT INTO discussions (id, title, topic, document_ids, agent_ids, leader_id, roles_map, human_guidance, rounds, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
    """, (
        discussion_id, 
        req.title or f"Debate: {req.topic[:35]}...", 
        req.topic, 
        json.dumps(req.document_ids), 
        json.dumps(req.agent_ids),
        req.leader_id,
        json.dumps(req.roles_map or {}),
        req.human_guidance or "",
        req.rounds
    ))
    await db.commit()
    await db.close()

    async def sse_disc_generator():
        async for event in MultiAgentOrchestrator.run_discussion(
            discussion_id=discussion_id,
            topic=req.topic,
            agent_ids=req.agent_ids,
            document_ids=req.document_ids or [],
            leader_id=req.leader_id,
            roles_map=req.roles_map or {},
            human_guidance=req.human_guidance,
            rounds=req.rounds
        ):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(sse_disc_generator(), media_type="text/event-stream")

@router.get("/discussions")
async def list_discussions():
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM discussions ORDER BY created_at DESC LIMIT 50;")
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()

@router.get("/discussions/{discussion_id}")
async def get_discussion(discussion_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM discussions WHERE id = ?;", (discussion_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Discussion not found")
        return dict(row)
    finally:
        await db.close()

@router.post("/discussions/reset-stuck")
async def reset_stuck_discussions():
    db = await get_db()
    try:
        await db.execute("UPDATE agents SET status = 'idle', current_task = '';")
        await db.execute("UPDATE discussions SET status = 'interrupted' WHERE status = 'in_progress';")
        await db.commit()
        return {"status": "reset"}
    finally:
        await db.close()

class DiscussionParticipateRequest(BaseModel):
    message: str
    target_agent_id: Optional[str] = None

@router.post("/discussions/{discussion_id}/participate/stream")
async def participate_discussion_stream(discussion_id: str, req: DiscussionParticipateRequest):
    async def sse_part_generator():
        async for event in MultiAgentOrchestrator.participate_in_discussion(
            discussion_id=discussion_id,
            human_message=req.message,
            target_agent_id=req.target_agent_id
        ):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(sse_part_generator(), media_type="text/event-stream")

@router.delete("/discussions/{discussion_id}")
async def delete_discussion(discussion_id: str):
    db = await get_db()
    try:
        await db.execute("DELETE FROM discussions WHERE id = ?;", (discussion_id,))
        await db.commit()
        return {"status": "deleted", "id": discussion_id}
    finally:
        await db.close()

@router.get("/sessions")
async def list_sessions():
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM sessions ORDER BY updated_at DESC LIMIT 50;")
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()

@router.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC;", (session_id,))
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    db = await get_db()
    try:
        await db.execute("DELETE FROM messages WHERE session_id = ?;", (session_id,))
        await db.execute("DELETE FROM sessions WHERE id = ?;", (session_id,))
        await db.commit()
        return {"status": "deleted", "id": session_id}
    finally:
        await db.close()
