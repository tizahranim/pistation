import aiosqlite
import json
from typing import Optional, List, Dict, Any
from app.config import get_db_path

async def get_db():
    db = await aiosqlite.connect(get_db_path())
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA busy_timeout=5000;")
    return db

async def init_db():
    async with aiosqlite.connect(get_db_path()) as db:
        await db.execute("PRAGMA journal_mode=WAL;")
        await db.execute("PRAGMA busy_timeout=5000;")
        await db.execute("""
        CREATE TABLE IF NOT EXISTS agents (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            avatar TEXT NOT NULL DEFAULT '🤖',
            role TEXT NOT NULL,
            system_prompt TEXT NOT NULL,
            model_provider TEXT NOT NULL DEFAULT 'ollama',
            model_id TEXT NOT NULL DEFAULT 'qwen3.8:27b',
            temperature REAL NOT NULL DEFAULT 0.2,
            thinking_level TEXT NOT NULL DEFAULT 'medium',
            tools TEXT NOT NULL DEFAULT '["read", "bash", "edit", "write"]',
            status TEXT NOT NULL DEFAULT 'idle',
            current_task TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            mode TEXT NOT NULL DEFAULT 'single',
            agent_id TEXT,
            model_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            path TEXT NOT NULL,
            template TEXT NOT NULL DEFAULT 'blank',
            description TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS project_messages (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            agent_id TEXT,
            extracted_code TEXT DEFAULT '',
            suggested_filename TEXT DEFAULT '',
            auto_created_path TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
        );
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            agent_id TEXT,
            agent_name TEXT,
            agent_avatar TEXT,
            content TEXT NOT NULL,
            thinking_content TEXT DEFAULT '',
            tool_calls TEXT DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
        );
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            file_type TEXT NOT NULL,
            size INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            chunk_count INTEGER NOT NULL DEFAULT 0,
            summary TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS doc_chunks (
            id TEXT PRIMARY KEY,
            doc_id TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (doc_id) REFERENCES documents (id) ON DELETE CASCADE
        );
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS discussions (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            topic TEXT NOT NULL,
            document_ids TEXT NOT NULL DEFAULT '[]',
            agent_ids TEXT NOT NULL DEFAULT '[]',
            rounds INTEGER NOT NULL DEFAULT 3,
            current_round INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'active',
            summary TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_id TEXT,
            agent_name TEXT,
            action_type TEXT NOT NULL,
            details TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

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

        await db.execute("""
        CREATE TABLE IF NOT EXISTS memories (
            id TEXT PRIMARY KEY,
            category TEXT NOT NULL DEFAULT 'user_profile',
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            source TEXT DEFAULT 'manual',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS finetune_datasets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            sample_count INTEGER NOT NULL DEFAULT 0,
            format TEXT NOT NULL DEFAULT 'alpaca',
            data_json TEXT NOT NULL DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS finetune_jobs (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            trainer_model TEXT NOT NULL,
            trainee_model TEXT NOT NULL,
            target_identifier TEXT NOT NULL,
            dataset_id TEXT,
            domain_focus TEXT DEFAULT '',
            status TEXT NOT NULL DEFAULT 'draft',
            pre_eval_json TEXT DEFAULT '{}',
            post_eval_json TEXT DEFAULT '{}',
            modelfile_content TEXT DEFAULT '',
            logs TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # Auto-migrate columns if missing
        try:
            await db.execute("ALTER TABLE messages ADD COLUMN model_id TEXT;")
        except Exception:
            pass
        try:
            await db.execute("ALTER TABLE messages ADD COLUMN model_provider TEXT DEFAULT 'ollama';")
        except Exception:
            pass
        try:
            await db.execute("ALTER TABLE messages ADD COLUMN latency_ms INTEGER DEFAULT 0;")
        except Exception:
            pass
        try:
            await db.execute("ALTER TABLE discussions ADD COLUMN leader_id TEXT;")
        except Exception:
            pass
        try:
            await db.execute("ALTER TABLE discussions ADD COLUMN roles_map TEXT DEFAULT '{}';")
        except Exception:
            pass
        try:
            await db.execute("ALTER TABLE discussions ADD COLUMN transcript TEXT DEFAULT '[]';")
        except Exception:
            pass
        try:
            await db.execute("ALTER TABLE discussions ADD COLUMN human_guidance TEXT DEFAULT '';")
        except Exception:
            pass

        # Insert default agents if table is empty
        cursor = await db.execute("SELECT COUNT(*) as count FROM agents;")
        row = await cursor.fetchone()
        if row and row[0] == 0:
            default_agents = [
                (
                    "agent-general",
                    "Pi Lead Agent",
                    "⚡",
                    "Generalist Problem Solver & Code Orchestrator",
                    "You are Pi Lead Agent, an autonomous master assistant. You coordinate solutions, analyze code, and execute tasks with extreme precision and brevity.",
                    "ollama",
                    "qwen3.8:27b",
                    0.2,
                    "high",
                    json.dumps(["read", "bash", "edit", "write", "browser"]),
                    "idle",
                    ""
                ),
                (
                    "agent-architect",
                    "System Architect",
                    "📐",
                    "Software Architecture & Design Review",
                    "You are a Principal Software Architect. You analyze high-level designs, data flows, scalability, fault tolerance, and system trade-offs. You debate and provide constructive architectural critiques.",
                    "ollama",
                    "gemma4:31b",
                    0.3,
                    "high",
                    json.dumps(["read"]),
                    "idle",
                    ""
                ),
                (
                    "agent-security",
                    "Security Auditor",
                    "🛡️",
                    "Vulnerability & Safety Specialist",
                    "You are a Security Specialist. You scrutinize code, APIs, and document proposals for vulnerabilities, data leaks, SQL injections, insecure permissions, and edge cases.",
                    "ollama",
                    "gemma4:26b",
                    0.1,
                    "medium",
                    json.dumps(["read"]),
                    "idle",
                    ""
                ),
                (
                    "agent-researcher",
                    "Doc Analyst & Researcher",
                    "🔬",
                    "Deep Document Synthesis & Fact-Checker",
                    "You are a Research Analyst. You extract key facts, cite exact references from documents, compare technical nuances, and synthesize clear executive briefs.",
                    "ollama",
                    "gemma4:12b",
                    0.2,
                    "medium",
                    json.dumps(["read"]),
                    "idle",
                    ""
                ),
            ]
            await db.executemany("""
            INSERT INTO agents (id, name, avatar, role, system_prompt, model_provider, model_id, temperature, thinking_level, tools, status, current_task)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, default_agents)

        try:
            await db.execute("ALTER TABLE memories ADD COLUMN is_pinned INTEGER DEFAULT 0;")
        except Exception:
            pass

        await db.commit()
