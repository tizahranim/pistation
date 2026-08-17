import asyncio
import json
import uuid
from typing import AsyncGenerator, Dict, Any, List, Optional
from app.db import get_db
from app.services.llm_router import LLMRouter
from app.services.doc_indexer import DocIndexer

class MultiAgentOrchestrator:
    @staticmethod
    async def run_discussion(
        discussion_id: str,
        topic: str,
        agent_ids: List[str],
        document_ids: List[str] = [],
        leader_id: Optional[str] = None,
        roles_map: Dict[str, str] = {},
        human_guidance: Optional[str] = None,
        rounds: int = 2
    ) -> AsyncGenerator[Dict[str, Any], None]:
        db = await get_db()
        try:
            # 1. Fetch participating agents
            placeholders = ",".join(["?"] * len(agent_ids))
            cursor = await db.execute(f"SELECT * FROM agents WHERE id IN ({placeholders})", agent_ids)
            agent_rows = await cursor.fetchall()
            agents_map = {row["id"]: dict(row) for row in agent_rows}

            # Identify team leader
            leader = agents_map.get(leader_id) if leader_id else (agents_map.get(agent_ids[0]) if agent_ids else None)
            leader_name = leader["name"] if leader else "Team Lead"

            # 2. Retrieve document context if provided
            doc_context = ""
            if document_ids:
                placeholders_doc = ",".join("?" for _ in document_ids)
                cursor = await db.execute(f"SELECT id, filename, file_path FROM documents WHERE id IN ({placeholders_doc});", tuple(document_ids))
                doc_rows = await cursor.fetchall()
                excerpts = []
                for d in doc_rows:
                    import os
                    if os.path.exists(d["file_path"]):
                        try:
                            with open(d["file_path"], "r", errors="ignore") as f:
                                excerpts.append(f"[{d['filename']}]:\n{f.read(10000)}")
                        except Exception:
                            pass
                if excerpts:
                    doc_context = "\n=== RELEVANT ATTACHED DOCUMENTS ===\n" + "\n\n".join(excerpts) + "\n===================================\n"

            # 3. Create or update discussion state in database
            await db.execute("""
            UPDATE discussions 
            SET status = 'in_progress', current_round = 1, leader_id = ?, roles_map = ?, human_guidance = ?
            WHERE id = ?;
            """, (leader["id"] if leader else None, json.dumps(roles_map), human_guidance or "", discussion_id))
            await db.commit()

            conversation_history = []
            
            yield {
                "type": "start",
                "discussion_id": discussion_id,
                "topic": topic,
                "leader": {"id": leader["id"], "name": leader["name"], "avatar": leader["avatar"]} if leader else None,
                "participants": [
                    {
                        "id": a["id"], 
                        "name": a["name"], 
                        "avatar": a["avatar"], 
                        "role": roles_map.get(a["id"], a["role"]),
                        "model": a["model_id"],
                        "provider": a["model_provider"],
                        "is_leader": a["id"] == (leader["id"] if leader else None)
                    }
                    for a in agents_map.values()
                ]
            }

            # 4. Multi-round discussion
            for round_num in range(1, rounds + 1):
                yield {
                    "type": "round_start",
                    "round": round_num,
                    "total_rounds": rounds
                }

                # If human guidance was provided, inject it
                if human_guidance and round_num == 1:
                    yield {
                        "type": "human_intervention",
                        "content": human_guidance
                    }
                    conversation_history.append({
                        "role": "user",
                        "speaker": "Human Supervisor",
                        "content": human_guidance
                    })

                for agent_id in agent_ids:
                    agent = agents_map.get(agent_id)
                    if not agent:
                        continue

                    assigned_role = roles_map.get(agent_id, agent["role"])
                    is_leader_turn = agent_id == (leader["id"] if leader else None)

                    # Update agent status
                    await db.execute("""
                    UPDATE agents SET status = 'collaborating', current_task = ? WHERE id = ?;
                    """, (f"Debating Round {round_num}: {topic[:25]}...", agent_id))
                    await db.commit()

                    yield {
                        "type": "agent_turn_start",
                        "round": round_num,
                        "agent": {
                            "id": agent["id"],
                            "name": agent["name"],
                            "avatar": agent["avatar"],
                            "role": assigned_role,
                            "model": agent["model_id"],
                            "is_leader": is_leader_turn
                        }
                    }

                    # Construct role-grounded system prompt
                    system_prompt = f"""You are {agent['name']}, acting with the specific assigned role of '{assigned_role}'.
Base instructions: {agent['system_prompt']}

You are participating in an executive roundtable debate with your team.
TOPIC: {topic}
TEAM LEADER: {leader_name}
CURRENT ROUND: {round_num} of {rounds}

DEBATE INSTRUCTIONS:
1. Speak strictly from your role perspective ({assigned_role}).
2. Directly reference, critique, agree with, or sharpen the points made by other agents earlier in the transcript.
3. If human supervisor instructions exist, align your proposals accordingly.
4. Keep your argument concise, impactful, and structured (2 to 4 crisp paragraphs)."""

                    messages = []
                    if doc_context:
                        messages.append({"role": "system", "content": doc_context})

                    for turn in conversation_history:
                        messages.append({"role": turn["role"], "content": f"[{turn['speaker']}]: {turn['content']}"})

                    messages.append({
                        "role": "user",
                        "content": f"It is your turn to speak, {agent['name']} ({assigned_role}). Deliver your analysis for Round {round_num}."
                    })

                    agent_full_reply = ""
                    async for chunk in LLMRouter.chat_stream(
                        model=agent["model_id"],
                        messages=messages,
                        system_prompt=system_prompt,
                        provider=agent.get("model_provider", "ollama"),
                        temperature=agent.get("temperature", 0.3)
                    ):
                        if chunk.get("content"):
                            agent_full_reply += chunk["content"]
                            yield {
                                "type": "agent_token",
                                "agent_id": agent["id"],
                                "content": chunk["content"]
                            }

                    # Append to transcript
                    turn_data = {
                        "round": round_num,
                        "agent_id": agent["id"],
                        "agent_name": agent["name"],
                        "agent_avatar": agent["avatar"],
                        "role": assigned_role,
                        "model": agent["model_id"],
                        "speaker": f"{agent['name']} ({assigned_role})",
                        "content": agent_full_reply
                    }
                    conversation_history.append(turn_data)

                    # Persist transcript in DB
                    await db.execute("""
                    UPDATE discussions SET transcript = ? WHERE id = ?;
                    """, (json.dumps(conversation_history), discussion_id))
                    await db.commit()

                    # Reset agent status
                    await db.execute("UPDATE agents SET status = 'idle', current_task = '' WHERE id = ?;", (agent_id,))
                    await db.commit()

                    yield {
                        "type": "agent_turn_end",
                        "agent_id": agent["id"],
                        "full_content": agent_full_reply
                    }

            # 5. Final Leader Consensus Synthesis
            yield {
                "type": "synthesis_start",
                "leader_name": leader_name
            }

            synthesis_prompt = f"""You are {leader_name}, the Executive Team Leader synthesizing this entire debate.
TOPIC: {topic}

TRANSCRIPT OF ALL ROUNDS:
""" + "\n\n".join([f"[{t['speaker']}]: {t['content']}" for t in conversation_history]) + """

Please generate the final structured Executive Synthesis:
### 1. Final Consensus & Agreed Verdict
### 2. Key Contradictions & Trade-offs Evaluated
### 3. Immediate Action Plan & Ownership Matrix"""

            synthesis_text = ""
            leader_model = leader["model_id"] if leader else "qwen3.8:27b"
            leader_provider = leader.get("model_provider", "ollama") if leader else "ollama"

            async for chunk in LLMRouter.chat_stream(
                model=leader_model,
                messages=[{"role": "user", "content": synthesis_prompt}],
                system_prompt=f"You are {leader_name}, the decisive Team Lead providing the final verdict.",
                provider=leader_provider,
                temperature=0.2
            ):
                if chunk.get("content"):
                    synthesis_text += chunk["content"]
                    yield {
                        "type": "synthesis_token",
                        "content": chunk["content"]
                    }

            await db.execute("""
            UPDATE discussions SET status = 'completed', summary = ?, transcript = ? WHERE id = ?;
            """, (synthesis_text, json.dumps(conversation_history), discussion_id))
            await db.commit()

            yield {
                "type": "complete",
                "discussion_id": discussion_id,
                "summary": synthesis_text,
                "transcript": conversation_history
            }

        finally:
            await db.close()

    @staticmethod
    async def participate_in_discussion(
        discussion_id: str,
        human_message: str,
        target_agent_id: Optional[str] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        db = await get_db()
        try:
            cursor = await db.execute("SELECT * FROM discussions WHERE id = ?;", (discussion_id,))
            disc_row = await cursor.fetchone()
            if not disc_row:
                yield {"type": "error", "message": "Discussion not found"}
                return

            disc = dict(disc_row)
            transcript = []
            try:
                transcript = json.loads(disc.get("transcript") or "[]")
            except Exception:
                transcript = []

            # 1. Add human intervention to transcript
            human_turn = {
                "speaker": "Human Supervisor",
                "role": "Executive Direction",
                "content": human_message,
                "is_human": True
            }
            transcript.append(human_turn)

            yield {
                "type": "human_intervention",
                "content": human_message
            }

            # 2. Pick replying agent (target agent or leader or first agent in list)
            chosen_agent_id = target_agent_id or disc.get("leader_id")
            if not chosen_agent_id:
                agent_ids = json.loads(disc.get("agent_ids") or "[]")
                chosen_agent_id = agent_ids[0] if agent_ids else None

            cursor = await db.execute("SELECT * FROM agents WHERE id = ?;", (chosen_agent_id,))
            agent_row = await cursor.fetchone()
            if not agent_row:
                cursor = await db.execute("SELECT * FROM agents LIMIT 1;")
                agent_row = await cursor.fetchone()

            agent = dict(agent_row)
            roles_map = json.loads(disc.get("roles_map") or "{}")
            assigned_role = roles_map.get(agent["id"], agent["role"])
            is_leader = agent["id"] == disc.get("leader_id")

            # 3. Construct prompt incorporating all discussion transcript + human question
            system_prompt = f"""You are {agent['name']}, acting in the role of '{assigned_role}'.
Base persona: {agent['system_prompt']}

You are participating in an ongoing executive debate.
TOPIC: {disc['topic']}
ROLE: {assigned_role} {'(Team Leader)' if is_leader else ''}

The Human Supervisor has just intervened with a direct question/instruction:
"{human_message}"

INSTRUCTIONS:
1. Address the Human Supervisor directly, respectfully, and decisively.
2. Incorporate the supervisor's guidance into the team's ongoing debate context.
3. If you are the Leader, give executive clarity or direct your specialists accordingly."""

            messages = []
            for turn in transcript[:-1]:
                speaker = turn.get("speaker") or turn.get("agent_name") or "Participant"
                messages.append({"role": "user" if turn.get("is_human") else "assistant", "content": f"[{speaker}]: {turn['content']}"})

            messages.append({"role": "user", "content": f"[Human Supervisor]: {human_message}"})

            yield {
                "type": "agent_turn_start",
                "agent": {
                    "id": agent["id"],
                    "name": agent["name"],
                    "avatar": agent["avatar"],
                    "role": assigned_role,
                    "model": agent["model_id"],
                    "is_leader": is_leader
                }
            }

            agent_reply = ""
            async for chunk in LLMRouter.chat_stream(
                model=agent["model_id"],
                messages=messages,
                system_prompt=system_prompt,
                provider=agent.get("model_provider", "ollama"),
                temperature=agent.get("temperature", 0.3)
            ):
                if chunk.get("content"):
                    agent_reply += chunk["content"]
                    yield {
                        "type": "agent_token",
                        "agent_id": agent["id"],
                        "content": chunk["content"]
                    }

            # 4. Save to transcript and update DB
            agent_turn_record = {
                "agent_id": agent["id"],
                "agent_name": agent["name"],
                "agent_avatar": agent["avatar"],
                "role": assigned_role,
                "model": agent["model_id"],
                "speaker": f"{agent['name']} ({assigned_role})",
                "content": agent_reply,
                "is_leader": is_leader
            }
            transcript.append(agent_turn_record)

            await db.execute("""
            UPDATE discussions SET transcript = ? WHERE id = ?;
            """, (json.dumps(transcript), discussion_id))
            await db.commit()

            yield {
                "type": "agent_turn_end",
                "agent_id": agent["id"],
                "full_content": agent_reply
            }

            yield {
                "type": "complete",
                "discussion_id": discussion_id,
                "transcript": transcript
            }

        finally:
            await db.close()
