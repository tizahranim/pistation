from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import glob
import uuid
from pathlib import Path
from typing import List, Dict, Any, Optional
from app.config import PI_SESSIONS_DIR, PI_SKILLS_DIR, PI_PROMPTS_DIR, HOME_DIR, BASE_DIR
from app.db import get_db

router = APIRouter(prefix="/api/memory", tags=["memory"])

class MemoryFactRequest(BaseModel):
    category: Optional[str] = "user_profile"
    key: str
    value: str
    source: Optional[str] = "manual"
    is_pinned: Optional[int] = 0

class BatchDeleteFactsRequest(BaseModel):
    fact_ids: List[str]

class ImportFactsRequest(BaseModel):
    facts: List[Dict[str, Any]]

class UpdateRulesRequest(BaseModel):
    filepath: str
    content: str

@router.get("/facts")
async def list_memory_facts():
    db = await get_db()
    try:
        try:
            cursor = await db.execute("SELECT * FROM memories ORDER BY is_pinned DESC, updated_at DESC, created_at DESC;")
        except Exception:
            cursor = await db.execute("SELECT * FROM memories ORDER BY created_at DESC;")
        rows = await cursor.fetchall()
        
        # If table is empty, initialize default memory
        if not rows:
            default_memories = [
                ("mem-user-name", "user_profile", "User Name", "Alex", "system", 1),
                ("mem-pref-style", "preference", "Coding Style", "Clean, concise, modular, and production-ready", "system", 1),
                ("mem-proj-stack", "project_rule", "Tech Stack", "FastAPI (Python) backend + React (Vite/Tailwind) frontend + Dual RTX 5070s", "system", 1)
            ]
            for m in default_memories:
                try:
                    await db.execute("""
                    INSERT INTO memories (id, category, key, value, source, is_pinned)
                    VALUES (?, ?, ?, ?, ?, ?);
                    """, m)
                except Exception:
                    await db.execute("""
                    INSERT INTO memories (id, category, key, value, source)
                    VALUES (?, ?, ?, ?, ?);
                    """, m[:5])
            await db.commit()
            cursor = await db.execute("SELECT * FROM memories ORDER BY created_at DESC;")
            rows = await cursor.fetchall()

        return [dict(r) for r in rows]
    finally:
        await db.close()

@router.post("/facts")
async def create_or_update_memory_fact(req: MemoryFactRequest):
    db = await get_db()
    try:
        fact_id = f"mem-{uuid.uuid4().hex[:8]}"
        # Check if key already exists
        cursor = await db.execute("SELECT id FROM memories WHERE LOWER(key) = LOWER(?);", (req.key,))
        existing = await cursor.fetchone()
        if existing:
            try:
                await db.execute("""
                UPDATE memories SET value = ?, category = ?, is_pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;
                """, (req.value, req.category or "user_profile", req.is_pinned or 0, existing["id"]))
            except Exception:
                await db.execute("""
                UPDATE memories SET value = ?, category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;
                """, (req.value, req.category or "user_profile", existing["id"]))
            await db.commit()
            return {"status": "updated", "id": existing["id"]}
        else:
            try:
                await db.execute("""
                INSERT INTO memories (id, category, key, value, source, is_pinned)
                VALUES (?, ?, ?, ?, ?, ?);
                """, (fact_id, req.category or "user_profile", req.key, req.value, req.source or "manual", req.is_pinned or 0))
            except Exception:
                await db.execute("""
                INSERT INTO memories (id, category, key, value, source)
                VALUES (?, ?, ?, ?, ?);
                """, (fact_id, req.category or "user_profile", req.key, req.value, req.source or "manual"))
            await db.commit()
            return {"status": "created", "id": fact_id}
    finally:
        await db.close()

@router.put("/facts/{fact_id}")
async def update_memory_fact_by_id(fact_id: str, req: MemoryFactRequest):
    db = await get_db()
    try:
        try:
            await db.execute("""
            UPDATE memories SET key = ?, value = ?, category = ?, is_pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;
            """, (req.key, req.value, req.category or "user_profile", req.is_pinned or 0, fact_id))
        except Exception:
            await db.execute("""
            UPDATE memories SET key = ?, value = ?, category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;
            """, (req.key, req.value, req.category or "user_profile", fact_id))
        await db.commit()
        return {"status": "updated", "id": fact_id}
    finally:
        await db.close()

@router.post("/facts/{fact_id}/pin")
async def toggle_pin_fact(fact_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT is_pinned FROM memories WHERE id = ?;", (fact_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Fact not found")
        
        current_pin = row["is_pinned"] if "is_pinned" in row.keys() and row["is_pinned"] is not None else 0
        new_pin = 0 if current_pin else 1
        
        try:
            await db.execute("UPDATE memories SET is_pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;", (new_pin, fact_id))
            await db.commit()
        except Exception:
            pass
        return {"status": "ok", "id": fact_id, "is_pinned": new_pin}
    finally:
        await db.close()

@router.delete("/facts/{fact_id}")
async def delete_memory_fact(fact_id: str):
    db = await get_db()
    try:
        await db.execute("DELETE FROM memories WHERE id = ?;", (fact_id,))
        await db.commit()
        return {"status": "deleted", "id": fact_id}
    finally:
        await db.close()

@router.post("/facts/batch-delete")
async def batch_delete_facts(req: BatchDeleteFactsRequest):
    db = await get_db()
    try:
        for fid in req.fact_ids:
            await db.execute("DELETE FROM memories WHERE id = ?;", (fid,))
        await db.commit()
        return {"status": "deleted", "count": len(req.fact_ids)}
    finally:
        await db.close()

@router.post("/facts/import")
async def import_memory_facts(req: ImportFactsRequest):
    db = await get_db()
    imported_count = 0
    try:
        for item in req.facts:
            key = str(item.get("key", "")).strip()
            val = str(item.get("value", "")).strip()
            if not key or not val:
                continue
            cat = str(item.get("category", "user_profile")).strip() or "user_profile"
            src = str(item.get("source", "import")).strip() or "import"
            pin = 1 if item.get("is_pinned") else 0
            
            # Check if key exists
            cursor = await db.execute("SELECT id FROM memories WHERE LOWER(key) = LOWER(?);", (key,))
            existing = await cursor.fetchone()
            if existing:
                try:
                    await db.execute("""
                    UPDATE memories SET value = ?, category = ?, is_pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;
                    """, (val, cat, pin, existing["id"]))
                except Exception:
                    await db.execute("""
                    UPDATE memories SET value = ?, category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;
                    """, (val, cat, existing["id"]))
            else:
                fid = f"mem-{uuid.uuid4().hex[:8]}"
                try:
                    await db.execute("""
                    INSERT INTO memories (id, category, key, value, source, is_pinned)
                    VALUES (?, ?, ?, ?, ?, ?);
                    """, (fid, cat, key, val, src, pin))
                except Exception:
                    await db.execute("""
                    INSERT INTO memories (id, category, key, value, source)
                    VALUES (?, ?, ?, ?, ?);
                    """, (fid, cat, key, val, src))
            imported_count += 1
        await db.commit()
        return {"status": "imported", "count": imported_count}
    finally:
        await db.close()

@router.get("/rules")
async def get_project_rules(project_path: Optional[str] = None):
    target_dir = Path(project_path) if project_path else BASE_DIR
    agents_md = target_dir / "AGENTS.md"
    claude_md = HOME_DIR / ".claude" / "CLAUDE.md"
    home_agents_md = HOME_DIR / "AGENTS.md"
    
    # Ensure default AGENTS.md exists if missing
    if not agents_md.exists():
        try:
            agents_md.write_text("""# PiStation Project Guidelines

## Core Principles
1. Autonomous multi-agent coordination with full local and cloud model flexibility.
2. Fast, resilient streaming via SSE and persistent SQLite storage.
3. Keep code modular, type-safe, and cleanly separated between FastAPI routers and React components.

## User Preferences
- Preferred Response Style: Concise, direct, and actionable.
""", encoding="utf-8")
        except Exception:
            pass

    rules = []
    for candidate in [agents_md, home_agents_md, claude_md]:
        if candidate.exists():
            try:
                with open(candidate, "r", encoding="utf-8") as f:
                    rules.append({
                        "file": str(candidate),
                        "filename": candidate.name,
                        "content": f.read()
                    })
            except Exception:
                pass
    return {"rules": rules}

@router.post("/rules")
async def save_project_rules(req: UpdateRulesRequest):
    target = Path(req.filepath).resolve()
    allowed_rule_files = {
        str((BASE_DIR / "AGENTS.md").resolve()),
        str((HOME_DIR / "AGENTS.md").resolve()),
        str((HOME_DIR / ".claude" / "CLAUDE.md").resolve()),
    }
    if str(target) not in allowed_rule_files:
        raise HTTPException(status_code=403, detail="Path not allowed")
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        with open(target, "w", encoding="utf-8") as f:
            f.write(req.content)
        return {"status": "saved", "file": str(target)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions")
async def list_pi_native_sessions():
    """Lists raw Pi agent sessions stored in ~/.pi/agent/sessions/"""
    sessions = []
    if PI_SESSIONS_DIR.exists():
        jsonl_files = glob.glob(str(PI_SESSIONS_DIR / "**/*.jsonl"), recursive=True)
        for filepath in jsonl_files:
            try:
                stat = os.stat(filepath)
                rel_path = os.path.relpath(filepath, str(PI_SESSIONS_DIR))
                sessions.append({
                    "id": Path(filepath).stem,
                    "rel_path": rel_path,
                    "size": stat.st_size,
                    "modified": stat.st_mtime
                })
            except Exception:
                continue
    sessions.sort(key=lambda x: x["modified"], reverse=True)
    return sessions[:30]

@router.get("/skills")
async def list_installed_skills():
    skill_dirs = [
        PI_SKILLS_DIR,
        HOME_DIR / ".gemini" / "config" / "skills",
        HOME_DIR / ".gemini" / "antigravity" / "builtin" / "skills",
    ]
    
    # Ensure PI_SKILLS_DIR exists
    PI_SKILLS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Fetch skill activation states from DB
    state_map = {}
    db = await get_db()
    try:
        await db.execute("""
        CREATE TABLE IF NOT EXISTS skills_state (
            skill_name TEXT PRIMARY KEY,
            is_active INTEGER DEFAULT 1,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        await db.commit()

        cursor = await db.execute("SELECT skill_name, is_active FROM skills_state;")
        rows = await cursor.fetchall()
        for r in rows:
            state_map[r["skill_name"]] = bool(r["is_active"])
    except Exception:
        pass
    finally:
        await db.close()

    seen = set()
    skills = []
    for sdir in skill_dirs:
        if sdir.exists():
            for item in sorted(sdir.iterdir()):
                if item.is_dir() and item.name not in seen and not item.name.startswith("."):
                    seen.add(item.name)
                    skill_md = item / "SKILL.md"
                    desc = ""
                    if skill_md.exists():
                        try:
                            with open(skill_md, "r", encoding="utf-8", errors="ignore") as f:
                                content = f.read()
                                # Clean frontmatter if present
                                if content.startswith("---"):
                                    parts = content.split("---", 2)
                                    if len(parts) >= 3:
                                        content = parts[2]
                                lines = [l.strip() for l in content.split("\n") if l.strip() and not l.startswith("#")]
                                desc = " ".join(lines[:3])
                        except Exception:
                            pass
                    
                    is_active = state_map.get(item.name, True)
                    skills.append({
                        "name": item.name,
                        "path": str(item),
                        "description": desc[:250] if desc else "Custom autonomous agent skill capability.",
                        "is_active": is_active
                    })
    return skills

class SkillToggleRequest(BaseModel):
    is_active: Optional[bool] = None

@router.post("/skills/{skill_name}/toggle")
async def toggle_skill_state(skill_name: str, req: Optional[SkillToggleRequest] = None):
    db = await get_db()
    try:
        await db.execute("""
        CREATE TABLE IF NOT EXISTS skills_state (
            skill_name TEXT PRIMARY KEY,
            is_active INTEGER DEFAULT 1,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        await db.commit()

        cursor = await db.execute("SELECT is_active FROM skills_state WHERE skill_name = ?;", (skill_name,))
        row = await cursor.fetchone()
        
        if req and req.is_active is not None:
            new_state = 1 if req.is_active else 0
        else:
            current_state = row["is_active"] if row else 1
            new_state = 0 if current_state else 1
        
        await db.execute("""
        INSERT INTO skills_state (skill_name, is_active, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(skill_name) DO UPDATE SET is_active = ?, updated_at = CURRENT_TIMESTAMP;
        """, (skill_name, new_state, new_state))
        await db.commit()

        return {
            "status": "ok",
            "skill_name": skill_name,
            "is_active": bool(new_state)
        }
    finally:
        await db.close()

class SkillUpsertRequest(BaseModel):
    name: str
    content: str
    target_path: Optional[str] = None

@router.get("/skills/{skill_name}")
async def get_skill_detail(skill_name: str):
    skill_dirs = [
        PI_SKILLS_DIR,
        HOME_DIR / ".gemini" / "config" / "skills",
        HOME_DIR / ".gemini" / "antigravity" / "builtin" / "skills",
    ]
    for sdir in skill_dirs:
        target = sdir / skill_name / "SKILL.md"
        if target.exists():
            try:
                with open(target, "r", encoding="utf-8") as f:
                    return {
                        "name": skill_name,
                        "path": str(target),
                        "dir": str(target.parent),
                        "content": f.read()
                    }
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
    raise HTTPException(status_code=404, detail="Skill not found")

@router.post("/skills")
async def upsert_skill(req: SkillUpsertRequest):
    clean_name = req.name.strip().lower().replace(" ", "-")
    if not clean_name:
        raise HTTPException(status_code=400, detail="Invalid skill name")
    
    # If target_path specified and exists, write there; otherwise write to ~/.pi/agent/skills/
    if req.target_path and Path(req.target_path).exists():
        target = Path(req.target_path)
    else:
        target_dir = PI_SKILLS_DIR / clean_name
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / "SKILL.md"
    
    try:
        with open(target, "w", encoding="utf-8") as f:
            f.write(req.content)
        return {"status": "saved", "name": clean_name, "path": str(target)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/skills/{skill_name}")
async def delete_skill(skill_name: str):
    import shutil
    skill_dirs = [
        PI_SKILLS_DIR,
        HOME_DIR / ".gemini" / "config" / "skills",
        HOME_DIR / ".gemini" / "antigravity" / "builtin" / "skills",
    ]
    for sdir in skill_dirs:
        target_dir = sdir / skill_name
        if target_dir.exists() and target_dir.is_dir():
            try:
                shutil.rmtree(target_dir)
                return {"status": "deleted", "name": skill_name}
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
    raise HTTPException(status_code=404, detail="Skill not found")
