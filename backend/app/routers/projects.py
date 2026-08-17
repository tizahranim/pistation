from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
import os
import json
import uuid
import asyncio
import time
import re
import mimetypes
from pathlib import Path
from typing import Optional, List, Dict, Any
from app.db import get_db
from app.config import HOME_DIR, PROJECT_ROOT, WORKSPACE_BASE
from app.services.llm_router import LLMRouter

router = APIRouter(prefix="/api/projects", tags=["projects"])

DEFAULT_WORKSPACE_BASE = WORKSPACE_BASE

class CreateProjectRequest(BaseModel):
    name: str
    path: Optional[str] = None
    template: Optional[str] = "blank"
    description: Optional[str] = ""

class SaveFileRequest(BaseModel):
    path: str
    content: str

class ExecCommandRequest(BaseModel):
    command: str

class ProjectChatMessage(BaseModel):
    role: str
    content: str

class ProjectChatRequest(BaseModel):
    agent_id: Optional[str] = "agent-general"
    model_id: Optional[str] = "qwen3.8:27b"
    model_provider: Optional[str] = "ollama"
    messages: List[Dict[str, str]]
    focused_folder: Optional[str] = ""
    active_file_path: Optional[str] = None
    active_file_content: Optional[str] = None
    auto_create_file: Optional[bool] = True
    document_ids: Optional[List[str]] = None
    attachments: Optional[List[Dict[str, Any]]] = None

def get_directory_tree(dir_path: Path, root_path: Optional[Path] = None, max_depth: int = 4, current_depth: int = 0) -> List[Dict[str, Any]]:
    """Crawls directory recursively and builds a tree structure with proper relative paths."""
    if current_depth >= max_depth or not dir_path.exists():
        return []

    if root_path is None:
        root_path = dir_path

    ignored = {
        ".git", "node_modules", "__pycache__", ".venv", "dist", "build", ".cache", 
        ".next", ".local", ".cargo", ".rustup", ".npm", ".mozilla", ".gemini", 
        ".config", ".gnupg", ".pki", ".vscode", ".antigravity", ".system_generated"
    }
    items = []

    try:
        entries = sorted(os.scandir(dir_path), key=lambda e: (not e.is_dir(follow_symlinks=False), e.name.lower()))
        for entry in entries:
            try:
                if entry.name in ignored or (entry.name.startswith(".") and entry.name not in {".env", ".gitignore", ".eslintrc.json"}):
                    continue

                is_dir = entry.is_dir(follow_symlinks=False)
                size = 0
                if not is_dir:
                    try:
                        size = entry.stat(follow_symlinks=False).st_size
                    except OSError:
                        size = 0

                rel_path = os.path.relpath(entry.path, root_path)
                item = {
                    "name": entry.name,
                    "path": rel_path,
                    "full_path": entry.path,
                    "is_dir": is_dir,
                    "size": size
                }

                if is_dir:
                    item["children"] = get_directory_tree(Path(entry.path), root_path, max_depth, current_depth + 1)

                items.append(item)
            except (OSError, PermissionError):
                continue
    except PermissionError:
        pass
    except Exception as e:
        print(f"Error scanning directory {dir_path}: {e}")

    return items

@router.get("")
async def list_projects():
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM projects WHERE id = 'proj-home';")
        home_row = await cursor.fetchone()
        if not home_row:
            await db.execute("""
            INSERT OR REPLACE INTO projects (id, name, path, template, description)
            VALUES ('proj-home', 'Home Directory (~/)', ?, 'blank', 'Your main Linux user home directory');
            """, (str(HOME_DIR),))
            await db.commit()

        cursor = await db.execute("SELECT * FROM projects WHERE id = 'proj-pi-cc';")
        cc_row = await cursor.fetchone()
        if not cc_row:
            await db.execute("""
            INSERT OR REPLACE INTO projects (id, name, path, template, description)
            VALUES ('proj-pi-cc', 'PiStation', ?, 'react', 'Primary Agent OS & Dashboard');
            """, (str(PROJECT_ROOT),))
            await db.commit()

        cursor = await db.execute("SELECT * FROM projects ORDER BY CASE WHEN id = 'proj-home' THEN 0 ELSE 1 END, updated_at DESC;")
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()

@router.post("")
async def create_project(req: CreateProjectRequest):
    db = await get_db()
    try:
        p_id = f"proj-{uuid.uuid4().hex[:8]}"
        project_dir = Path(req.path) if req.path else DEFAULT_WORKSPACE_BASE / req.name.strip().lower().replace(" ", "-")
        project_dir.mkdir(parents=True, exist_ok=True)

        if req.template == "python":
            (project_dir / "main.py").write_text('"""Main entrypoint."""\n\ndef main():\n    print("Hello from Python Project!")\n\nif __name__ == "__main__":\n    main()\n')
            (project_dir / "requirements.txt").write_text("fastapi\nuvicorn\nhttpx\npytest\n")
            (project_dir / "README.md").write_text(f"# {req.name}\n\nPython project initialized with PiStation.\n")
        elif req.template == "react":
            (project_dir / "index.html").write_text('<!DOCTYPE html>\n<html>\n<head><title>App</title></head>\n<body><div id="root"></div></body>\n</html>')
            (project_dir / "package.json").write_text('{\n  "name": "' + req.name.lower() + '",\n  "version": "1.0.0",\n  "scripts": {\n    "dev": "vite",\n    "build": "vite build"\n  }\n}\n')
            (project_dir / "README.md").write_text(f"# {req.name}\n\nReact Web App scaffolded by Pi Agent.\n")
        elif req.template == "node":
            (project_dir / "index.js").write_text('console.log("Hello from Node.js project!");\n')
            (project_dir / "package.json").write_text('{\n  "name": "' + req.name.lower() + '",\n  "version": "1.0.0",\n  "main": "index.js"\n}\n')
            (project_dir / "README.md").write_text(f"# {req.name}\n\nNode.js CLI scaffolded by Pi Agent.\n")
        else:
            (project_dir / "README.md").write_text(f"# {req.name}\n\n{req.description or 'Custom Project Workspace'}\n")

        await db.execute("""
        INSERT INTO projects (id, name, path, template, description)
        VALUES (?, ?, ?, ?, ?);
        """, (p_id, req.name, str(project_dir), req.template, req.description))
        await db.commit()

        return {
            "id": p_id,
            "name": req.name,
            "path": str(project_dir),
            "template": req.template,
            "description": req.description
        }
    finally:
        await db.close()

@router.delete("/{project_id}")
async def delete_project(project_id: str, remove_files: bool = False):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT path FROM projects WHERE id = ?;", (project_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Project not found")

        path = row["path"]
        if remove_files and os.path.exists(path) and path.startswith(str(DEFAULT_WORKSPACE_BASE)) and path != str(HOME_DIR):
            import shutil
            shutil.rmtree(path, ignore_errors=True)

        await db.execute("DELETE FROM projects WHERE id = ?;", (project_id,))
        await db.commit()
        return {"status": "deleted", "id": project_id}
    finally:
        await db.close()

@router.get("/{project_id}/tree")
async def get_project_tree(project_id: str, subpath: Optional[str] = None):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM projects WHERE id = ?;", (project_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Project not found")

        root_path = Path(row["path"])
        if subpath:
            target_path = (root_path / subpath.lstrip("/")).resolve()
        else:
            target_path = root_path

        if not target_path.exists():
            target_path.mkdir(parents=True, exist_ok=True)

        tree = get_directory_tree(target_path, max_depth=3 if root_path != HOME_DIR else 2)
        return {
            "project_id": project_id,
            "project_name": row["name"],
            "root_path": str(root_path),
            "target_path": str(target_path),
            "tree": tree
        }
    finally:
        await db.close()

@router.get("/{project_id}/file")
async def read_project_file(project_id: str, path: Optional[str] = None, file_path: Optional[str] = None):
    db = await get_db()
    target_rel_path = path or file_path
    if not target_rel_path:
        raise HTTPException(status_code=400, detail="Missing path parameter")

    try:
        cursor = await db.execute("SELECT path FROM projects WHERE id = ?;", (project_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Project not found")

        root = Path(row["path"]).resolve()
        target = (root / target_rel_path.lstrip("/")).resolve()

        if not str(target).startswith(str(root)):
            raise HTTPException(status_code=403, detail="Access denied outside project root")

        if not target.exists():
            raise HTTPException(status_code=404, detail="File does not exist")

        if target.is_dir():
            raise HTTPException(status_code=400, detail="Target is a directory")

        # Determine file type
        ext = target.suffix.lower()
        is_image = ext in {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico"}
        is_binary = ext in {".pdf", ".zip", ".tar", ".gz", ".exe", ".bin"}

        if is_image or is_binary:
            return {
                "file_path": target_rel_path,
                "full_path": str(target),
                "is_binary": True,
                "is_image": is_image,
                "raw_url": f"/api/projects/{project_id}/raw-file?path={target_rel_path}",
                "size": target.stat().st_size
            }

        try:
            with open(target, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read(500000)
            return {
                "file_path": target_rel_path,
                "full_path": str(target),
                "content": content,
                "is_binary": False,
                "is_image": False,
                "size": target.stat().st_size
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")
    finally:
        await db.close()

@router.get("/{project_id}/raw-file")
async def get_raw_file(project_id: str, path: str = Query(...)):
    """Serves binary/raw files like images, PDFs, and assets directly to browser."""
    db = await get_db()
    try:
        cursor = await db.execute("SELECT path FROM projects WHERE id = ?;", (project_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Project not found")

        root = Path(row["path"]).resolve()
        target = (root / path.lstrip("/")).resolve()

        if not str(target).startswith(str(root)) or not target.exists() or target.is_dir():
            raise HTTPException(status_code=404, detail="File not found")

        mime_type, _ = mimetypes.guess_type(str(target))
        return FileResponse(path=str(target), media_type=mime_type or "application/octet-stream")
    finally:
        await db.close()

@router.post("/{project_id}/file")
async def save_project_file(project_id: str, req: SaveFileRequest):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT path FROM projects WHERE id = ?;", (project_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Project not found")

        root = Path(row["path"]).resolve()
        target = (root / req.path.lstrip("/")).resolve()

        if not str(target).startswith(str(root)):
            raise HTTPException(status_code=403, detail="Access denied outside project root")

        target.parent.mkdir(parents=True, exist_ok=True)
        with open(target, "w", encoding="utf-8") as f:
            f.write(req.content)

        await db.execute("UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?;", (project_id,))
        await db.commit()

        return {
            "status": "saved",
            "file_path": req.path,
            "full_path": str(target),
            "size": target.stat().st_size
        }
    finally:
        await db.close()

@router.delete("/{project_id}/file")
async def delete_project_file(project_id: str, path: Optional[str] = None, file_path: Optional[str] = None):
    db = await get_db()
    target_rel_path = path or file_path
    if not target_rel_path:
        raise HTTPException(status_code=400, detail="Missing path parameter")

    try:
        cursor = await db.execute("SELECT path FROM projects WHERE id = ?;", (project_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Project not found")

        root = Path(row["path"]).resolve()
        target = (root / target_rel_path.lstrip("/")).resolve()

        if not str(target).startswith(str(root)):
            raise HTTPException(status_code=403, detail="Access denied outside project root")

        if not target.exists():
            raise HTTPException(status_code=404, detail="File does not exist")

        if target.is_dir():
            import shutil
            shutil.rmtree(target, ignore_errors=True)
        else:
            os.remove(target)

        return {"status": "deleted", "file_path": target_rel_path}
    finally:
        await db.close()

@router.post("/{project_id}/exec")
async def execute_project_command(project_id: str, req: ExecCommandRequest):
    """Executes a command inside the project directory and returns output and exit code."""
    db = await get_db()
    try:
        cursor = await db.execute("SELECT path FROM projects WHERE id = ?;", (project_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Project not found")

        work_dir = Path(row["path"]).resolve()
        if not work_dir.exists():
            work_dir.mkdir(parents=True, exist_ok=True)

        start_time = time.time()
        try:
            process = await asyncio.create_subprocess_shell(
                req.command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=str(work_dir),
                env=os.environ.copy()
            )

            try:
                stdout, _ = await asyncio.wait_for(process.communicate(), timeout=30.0)
                output = stdout.decode("utf-8", errors="replace")
                exit_code = process.returncode
            except asyncio.TimeoutError:
                process.kill()
                output = "⚠️ Command execution timed out after 30 seconds."
                exit_code = -1
        except Exception as e:
            output = f"⚠️ Failed to execute command: {str(e)}"
            exit_code = 1

        elapsed_ms = int((time.time() - start_time) * 1000)

        return {
            "command": req.command,
            "output": output,
            "exit_code": exit_code,
            "cwd": str(work_dir),
            "elapsed_ms": elapsed_ms
        }
    finally:
        await db.close()

@router.post("/{project_id}/chat")
async def project_copilot_chat(project_id: str, req: ProjectChatRequest):
    """
    Conversational Copilot Chat with deep Folder Scope & Active File Awareness.
    When a folder is selected/expanded (e.g. Desktop, Downloads), the agent knows its exact contents.
    """
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM projects WHERE id = ?;", (project_id,))
        proj_row = await cursor.fetchone()
        if not proj_row:
            raise HTTPException(status_code=404, detail="Project not found")

        project_root = Path(proj_row["path"]).resolve()
        
        # Determine focused directory scope
        if req.focused_folder and req.focused_folder.strip():
            focused_dir = (project_root / req.focused_folder.strip().lstrip("/")).resolve()
            if not focused_dir.exists() or not str(focused_dir).startswith(str(project_root)):
                focused_dir = project_root
        else:
            focused_dir = project_root

        # Inspect items inside the focused folder
        dir_items = []
        try:
            entries = sorted(os.scandir(focused_dir), key=lambda e: (not e.is_dir(follow_symlinks=False), e.name.lower()))
            for e in entries:
                if not e.name.startswith(".") and e.name not in {"node_modules", "__pycache__", ".venv"}:
                    try:
                        size_str = ""
                        if not e.is_dir(follow_symlinks=False):
                            size_bytes = e.stat(follow_symlinks=False).st_size
                            size_str = f" ({round(size_bytes/1024, 1)} KB)" if size_bytes > 1024 else f" ({size_bytes} B)"
                        dir_items.append(f"📁 {e.name}/" if e.is_dir(follow_symlinks=False) else f"📄 {e.name}{size_str}")
                    except OSError:
                        dir_items.append(f"📄 {e.name}")
        except Exception as e:
            dir_items.append(f"(Error scanning: {e})")

        focused_dir_listing = "\n".join(dir_items[:60]) or "(Empty folder)"

        cursor = await db.execute("SELECT * FROM agents WHERE id = ?;", (req.agent_id,))
        agent_row = await cursor.fetchone()
        agent = dict(agent_row) if agent_row else {"name": "Senior Software Architect", "system_prompt": "You are an elite coding assistant."}

        # Retrieve attached library documents / files if specified
        attached_docs_text = ""
        if req.document_ids:
            for doc_id in req.document_ids:
                try:
                    d_cur = await db.execute("SELECT filename FROM documents WHERE id = ?;", (doc_id,))
                    d_row = await d_cur.fetchone()
                    if d_row:
                        c_cur = await db.execute("SELECT content FROM doc_chunks WHERE doc_id = ? ORDER BY chunk_index ASC LIMIT 10;", (doc_id,))
                        c_rows = await c_cur.fetchall()
                        chunks_text = "\n\n".join(r["content"] for r in c_rows)
                        attached_docs_text += f"\n--- ATTACHED FILE: {d_row['filename']} ---\n{chunks_text[:8000]}\n"
                except Exception as e:
                    pass

        if req.attachments:
            for att in req.attachments:
                att_name = att.get("name", "attachment")
                att_content = att.get("content", "")
                if att_content:
                    attached_docs_text += f"\n--- ATTACHED FILE: {att_name} ---\n{att_content[:8000]}\n"

        system_prompt = f"""You are {agent['name']}, an autonomous AI software engineer and Copilot inside the PiStation IDE.
You are fully connected to the user's filesystem and active workspace. The IDE engine automatically executes and saves all files you create or modify directly to disk.

### ACTIVE FILESYSTEM CONTEXT:
- Workspace Root: {project_root}
- Current Focused Folder: {focused_dir}
- Items Currently in Focused Folder:
{focused_dir_listing}

{f"### CURRENTLY OPEN FILE: {req.active_file_path}\nFile Content:\n```\n{req.active_file_content}\n```" if (req.active_file_path and req.active_file_content) else "No file is currently open."}
{f"### ATTACHED REFERENCE DOCUMENTS & KNOWLEDGE:\n{attached_docs_text}" if attached_docs_text else ""}

CRITICAL RULES:
1. NEVER say "I cannot execute commands", "I don't have filesystem access", or tell the user to manually run `touch` or `mkdir` in their terminal. The IDE automatically writes and saves all files you generate directly to disk!
2. When the user asks you to create ANY file (e.g. 'create tariq.txt', 'create a python script', 'create an empty text file'), confirm that you have created it, provide the file content in a fenced block (or an empty block for empty files), and specify the filename.
3. When asked questions about what files exist, attached documents, or if a file was created, answer with 100% accuracy based on the provided context.
"""

        # Format conversation messages for LLMRouter
        formatted_messages = []
        for msg in req.messages:
            formatted_messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})

        full_reply = ""
        try:
            async for chunk in LLMRouter.chat_stream(
                model=req.model_id or "qwen3.8:27b",
                messages=formatted_messages,
                system_prompt=system_prompt,
                provider=req.model_provider or "ollama"
            ):
                if chunk.get("content"):
                    full_reply += chunk["content"]
        except Exception as e:
            full_reply = f"⚠️ Generation error: {str(e)}"

        # Detect intent and extract code
        last_user_msg = formatted_messages[-1]["content"] if formatted_messages else ""
        inst_lower = last_user_msg.lower()
        is_create_intent = any(k in inst_lower for k in [
            "create", "write", "generate", "build", "make", "add file", "scaffold", "save as", "new file", "code a", "implement", "empty", "touch", "add a file"
        ])

        extracted_code = ""
        has_fenced_code = False
        code_match = re.search(r"```(?:\w+)?\n([\s\S]*?)```", full_reply)
        if code_match:
            has_fenced_code = True
            extracted_code = code_match.group(1).strip()

        # Extract filename from user request or model reply
        detected_filename = None
        if is_create_intent:
            file_match = re.search(r"(?:named|called|create|touch|file|save as|filename:?)\s*['\"`]?([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)['\"`]?", last_user_msg + " " + full_reply, re.IGNORECASE)
            if file_match:
                detected_filename = file_match.group(1).strip()
            else:
                if "html" in inst_lower:
                    detected_filename = "index.html"
                elif "python" in inst_lower or "py" in inst_lower:
                    detected_filename = "app.py"
                elif "react" in inst_lower or "jsx" in inst_lower:
                    detected_filename = "App.jsx"
                elif "css" in inst_lower:
                    detected_filename = "style.css"
                elif "json" in inst_lower:
                    detected_filename = "data.json"
                elif "text" in inst_lower or "txt" in inst_lower:
                    detected_filename = "newfile.txt"

        if not detected_filename and req.active_file_path:
            detected_filename = req.active_file_path

        # Resolve relative path inside focused folder if applicable
        resolved_rel_path = detected_filename
        if detected_filename and req.focused_folder and not detected_filename.startswith(req.focused_folder):
            resolved_rel_path = f"{req.focused_folder}/{detected_filename}".lstrip("/")

        # Auto create file if create intent exists
        created_file_path = None
        if req.auto_create_file and is_create_intent and resolved_rel_path:
            target = (project_root / resolved_rel_path.lstrip("/")).resolve()
            if str(target).startswith(str(project_root)):
                target.parent.mkdir(parents=True, exist_ok=True)
                with open(target, "w", encoding="utf-8") as f:
                    f.write(extracted_code)
                created_file_path = resolved_rel_path

        # Persist messages in SQLite project_messages table
        try:
            user_msg_id = f"pmsg-usr-{uuid.uuid4().hex[:8]}"
            await db.execute("""
            INSERT INTO project_messages (id, project_id, role, content, agent_id)
            VALUES (?, ?, ?, ?, ?);
            """, (user_msg_id, project_id, "user", last_user_msg, req.agent_id))

            asst_msg_id = f"pmsg-asst-{uuid.uuid4().hex[:8]}"
            await db.execute("""
            INSERT INTO project_messages (id, project_id, role, content, agent_id, extracted_code, suggested_filename, auto_created_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                asst_msg_id, 
                project_id, 
                "assistant", 
                full_reply, 
                req.agent_id, 
                extracted_code if has_fenced_code else "", 
                resolved_rel_path if is_create_intent else "", 
                created_file_path or ""
            ))
            await db.commit()
        except Exception as e:
            print("Failed to persist project message:", e)

        return {
            "reply": full_reply,
            "extracted_code": extracted_code if has_fenced_code else "",
            "suggested_filename": resolved_rel_path if is_create_intent else None,
            "auto_created_path": created_file_path,
            "focused_folder": str(focused_dir)
        }
    finally:
        await db.close()

@router.get("/{project_id}/messages")
async def get_project_messages(project_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM project_messages WHERE project_id = ? ORDER BY created_at ASC;", (project_id,))
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()

@router.delete("/{project_id}/messages")
async def clear_project_messages(project_id: str):
    db = await get_db()
    try:
        await db.execute("DELETE FROM project_messages WHERE project_id = ?;", (project_id,))
        await db.commit()
        return {"status": "cleared"}
    finally:
        await db.close()
