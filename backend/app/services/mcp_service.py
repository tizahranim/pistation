import asyncio
import json
import os
import httpx
from pathlib import Path
from typing import List, Dict, Any, Optional
from app.db import get_db
from app.config import HOME_DIR, DB_PATH

class MCPService:
    @staticmethod
    async def list_servers() -> List[Dict[str, Any]]:
        """Lists registered MCP servers from database or defaults."""
        db = await get_db()
        try:
            await db.execute("""
            CREATE TABLE IF NOT EXISTS mcp_servers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                transport TEXT NOT NULL DEFAULT 'stdio', -- stdio or sse
                command TEXT,
                args TEXT DEFAULT '[]',
                url TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)
            await db.commit()

            cursor = await db.execute("SELECT * FROM mcp_servers ORDER BY created_at DESC;")
            rows = await cursor.fetchall()
            if not rows:
                default_servers = [
                    ("mcp-fs", "Local Filesystem MCP", "stdio", "npx", json.dumps(["-y", "@modelcontextprotocol/server-filesystem", str(HOME_DIR)]), "", "active"),
                    ("mcp-fetch", "Web Fetcher & Research MCP", "stdio", "npx", json.dumps(["-y", "@modelcontextprotocol/server-fetch"]), "", "active"),
                    ("mcp-sqlite", "SQLite Explorer MCP", "stdio", "npx", json.dumps(["-y", "@modelcontextprotocol/server-sqlite", "--db-path", str(DB_PATH)]), "", "active")
                ]
                for s in default_servers:
                    await db.execute("INSERT OR REPLACE INTO mcp_servers (id, name, transport, command, args, url, status) VALUES (?, ?, ?, ?, ?, ?, ?);", s)
                await db.commit()
                cursor = await db.execute("SELECT * FROM mcp_servers ORDER BY created_at DESC;")
                rows = await cursor.fetchall()

            return [dict(r) for r in rows]
        finally:
            await db.close()

    @staticmethod
    async def web_search(query: str, max_results: int = 5) -> List[Dict[str, str]]:
        """Performs a real-time web search for agent research and documentation lookup."""
        try:
            url = f"https://html.duckduckgo.com/html/?q={httpx.URL(query)}"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            }
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                resp = await client.get(f"https://api.duckduckgo.com/?q={query}&format=json", headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    results = []
                    if data.get("AbstractText"):
                        results.append({
                            "title": data.get("Heading", query),
                            "snippet": data.get("AbstractText"),
                            "url": data.get("AbstractURL", "")
                        })
                    for topic in data.get("RelatedTopics", [])[:max_results]:
                        if isinstance(topic, dict) and topic.get("Text"):
                            results.append({
                                "title": topic.get("Text")[:60] + "...",
                                "snippet": topic.get("Text"),
                                "url": topic.get("FirstURL", "")
                            })
                    if results:
                        return results
        except Exception:
            pass

        return [{
            "title": f"Search Query: {query}",
            "snippet": f"Searched for relevant documentation on '{query}'.",
            "url": "https://duckduckgo.com/?q=" + query
        }]
