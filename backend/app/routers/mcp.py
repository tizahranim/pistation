from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import uuid
import json
from typing import List, Dict, Any, Optional
from app.db import get_db
from app.services.mcp_service import MCPService

router = APIRouter(prefix="/api/mcp", tags=["mcp"])

class MCPServerRequest(BaseModel):
    name: str
    transport: Optional[str] = "stdio"
    command: Optional[str] = "npx"
    args: Optional[List[str]] = []
    url: Optional[str] = None

@router.get("/servers")
async def list_mcp_servers():
    return await MCPService.list_servers()

@router.post("/servers")
async def add_mcp_server(req: MCPServerRequest):
    db = await get_db()
    try:
        server_id = f"mcp-{uuid.uuid4().hex[:6]}"
        await db.execute("""
        INSERT INTO mcp_servers (id, name, transport, command, args, url, status)
        VALUES (?, ?, ?, ?, ?, ?, 'active');
        """, (server_id, req.name, req.transport or "stdio", req.command, json.dumps(req.args or []), req.url or ""))
        await db.commit()
        return {"status": "created", "id": server_id}
    finally:
        await db.close()

@router.delete("/servers/{server_id}")
async def delete_mcp_server(server_id: str):
    db = await get_db()
    try:
        await db.execute("DELETE FROM mcp_servers WHERE id = ?;", (server_id,))
        await db.commit()
        return {"status": "deleted", "id": server_id}
    finally:
        await db.close()

@router.get("/search")
async def perform_search(q: str):
    if not q.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    results = await MCPService.web_search(q.strip())
    return {"query": q, "results": results}
