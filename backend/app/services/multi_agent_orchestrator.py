import asyncio
import json
import re
import uuid
from typing import AsyncGenerator, Dict, Any, List, Optional, Tuple
from app.db import get_db
from app.services.llm_router import LLMRouter
from app.services.doc_indexer import DocIndexer

STANCE_RE = re.compile(r"^\s*\[STANCE\]\s*(AGREE|DISAGREE|PARTIAL|NEUTRAL)\s*(?:with\s+)?([^—\-]*?)(?:[—\-]\s*(.*))?$", re.IGNORECASE)

STANCE_INSTRUCTION = """CRITICAL FORMAT: Begin your reply with exactly one line in this format:
[STANCE] AGREE|DISAGREE|PARTIAL with <Name of the agent you address> — <one-line reason>
If you address the overall topic rather than a specific agent, use: [STANCE] NEUTRAL — <one-line reason>"""

def parse_stance(text: str) -> Dict[str, Any]:
    """Extracts the [STANCE] line from an agent reply, returning stance metadata and the clean reply."""
    lines = text.split("\n")
    stance = {"type": "NEUTRAL", "target": "", "reason": "", "clean": text}
    for i, line in enumerate(lines[:4]):
        m = STANCE_RE.match(line.strip())
        if m:
            stance = {
                "type": m.group(1).upper(),
                "target": (m.group(2) or "").strip() or "",
                "reason": (m.group(3) or "").strip() or "",
                "clean": "\n".join(lines[:i] + lines[i + 1:]).strip()
            }
            break
    return stance

def compute_consensus(turns: List[Dict[str, Any]]) -> Tuple[int, int]:
    """Returns (consensus_score 0-100, disagreement_count) based on stance data."""
    stances = [t for t in turns if t.get("stance")]
    if not stances:
        return 50, 0
    score_weights = {"AGREE": 1.0, "PARTIAL": 0.6, "NEUTRAL": 0.6, "DISAGREE": 0.0}
    total = sum(score_weights.get(s["stance"].get("type", "NEUTRAL"), 0.5) for s in stances)
    avg = total / len(stances)
    disagreements = sum(1 for s in stances if s["stance"].get("type") == "DISAGREE")
    return int(round(avg * 100)), disagreements

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
            placeholders = ",".join(["?"] * len(agent_ids))
            cursor = await db.execute(f"SELECT * FROM agents WHERE id IN ({placeholders})", agent_ids)
            agent_rows = await cursor.fetchall()
            agents_map = {row["id"]: dict(row) for row in agent_rows}
            roster = [agents_map.get(aid) for aid in agent_ids if agents_map.get(aid)]

            leader = None
            for aid in (leader_id, agent_ids[0]):
                if aid and agents_map.get(aid):
                    leader = agents_map[aid]
                    break
            leader_name = leader["name"] if leader else "Team Lead"

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
                    for a in roster
                ]
            }

            def role_of(agent: Dict[str, Any]) -> str:
                return roles_map.get(agent["id"], agent["role"])

            def speaker_tag(agent: Dict[str, Any]) -> str:
                return f"{agent['name']} ({role_of(agent)})"

            def transcript_block() -> str:
                return "\n\n".join(
                    f"[{t.get('speaker') or t.get('agent_name')}]: {t['content']}"
                    for t in conversation_history
                )

            # ---- Round 1: Opening statements (clean sequential streaming) ----
            yield {"type": "round_start", "round": 1, "total_rounds": rounds, "phase": "opening"}

            if human_guidance:
                yield {"type": "human_intervention", "content": human_guidance}
                conversation_history.append({
                    "role": "user", "speaker": "Human Supervisor",
                    "content": human_guidance, "is_human": True
                })

            for a in roster:
                is_leader = a["id"] == (leader["id"] if leader else None)
                yield {
                    "type": "agent_turn_start",
                    "round": 1,
                    "agent_id": a["id"],
                    "agent_name": a["name"],
                    "agent_avatar": a["avatar"],
                    "role": role_of(a),
                    "model": a["model_id"],
                    "is_leader": is_leader,
                    "agent": {
                        "id": a["id"], "name": a["name"], "avatar": a["avatar"],
                        "role": role_of(a), "model": a["model_id"], "is_leader": is_leader
                    }
                }

                system_prompt = f"""You are {a['name']}, acting with the specific assigned role of '{role_of(a)}'.
Base instructions: {a['system_prompt']}

You are participating in an executive roundtable debate.
TOPIC: {topic}
TEAM LEADER: {leader_name}
PHASE: Round 1 — Opening Statements

{STANCE_INSTRUCTION}

INSTRUCTIONS:
1. Deliver a crisp opening statement from your role perspective ({role_of(a)}).
2. Establish your core position, key concerns, and what you will defend in later rounds.
3. Keep it concise, impactful, and structured (2 to 4 crisp paragraphs)."""

                messages = []
                if doc_context:
                    messages.append({"role": "system", "content": doc_context})
                for turn in conversation_history:
                    messages.append({"role": "user" if turn.get("is_human") else "assistant", "content": f"[{turn.get('speaker') or turn.get('agent_name')}]: {turn['content']}"})
                messages.append({
                    "role": "user",
                    "content": f"It is your turn to speak, {a['name']} ({role_of(a)}). Deliver your opening statement."
                })

                reply = ""
                async for chunk in LLMRouter.chat_stream(
                    model=a["model_id"],
                    messages=messages,
                    system_prompt=system_prompt,
                    provider=a.get("model_provider", "ollama"),
                    temperature=a.get("temperature", 0.3)
                ):
                    if chunk.get("content"):
                        reply += chunk["content"]
                        yield {"type": "agent_token", "agent_id": a["id"], "content": chunk["content"]}

                stance = parse_stance(reply)
                turn_data = {
                    "round": 1,
                    "agent_id": a["id"],
                    "agent_name": a["name"],
                    "agent_avatar": a["avatar"],
                    "role": role_of(a),
                    "model": a["model_id"],
                    "speaker": speaker_tag(a),
                    "content": stance["clean"],
                    "stance": {
                        "type": stance["type"],
                        "target": stance["target"],
                        "reason": stance["reason"]
                    }
                }
                conversation_history.append(turn_data)
                yield {"type": "stance", "agent_id": a["id"], "stance": turn_data["stance"]}
                yield {"type": "agent_turn_end", "agent_id": a["id"], "full_content": stance["clean"]}

                await db.execute("UPDATE discussions SET transcript = ? WHERE id = ?;",
                                 (json.dumps(conversation_history), discussion_id))
                await db.commit()

            score, disagreements = compute_consensus(conversation_history)
            yield {"type": "consensus_update", "score": score, "disagreements": disagreements, "round": 1}
            last_round_disagreements = disagreements
            consensus_breaks_early = False

            # ---- Rebuttal rounds (sequential, targeted) ----
            max_rounds = max(rounds, 2)
            for round_num in range(2, max_rounds + 1):
                if consensus_breaks_early:
                    yield {"type": "early_stop", "reason": "consensus_reached", "round": round_num}
                    break

                yield {"type": "round_start", "round": round_num, "total_rounds": max_rounds, "phase": "rebuttal"}

                for i, a in enumerate(roster):
                    # Target: previous speaker in this round's rotation
                    opponent = roster[i - 1] if len(roster) > 1 else None
                    opponent_turn = None
                    if opponent:
                        opponent_turn = next((t for t in reversed(conversation_history) if t.get("agent_id") == opponent["id"]), None)

                    is_leader = a["id"] == (leader["id"] if leader else None)
                    yield {
                        "type": "agent_turn_start",
                        "round": round_num,
                        "agent_id": a["id"],
                        "agent_name": a["name"],
                        "agent_avatar": a["avatar"],
                        "role": role_of(a),
                        "model": a["model_id"],
                        "target_agent": opponent["name"] if opponent else None,
                        "target_agent_id": opponent["id"] if opponent else None,
                        "is_leader": is_leader,
                        "agent": {
                            "id": a["id"], "name": a["name"], "avatar": a["avatar"],
                            "role": role_of(a), "model": a["model_id"], "is_leader": is_leader
                        }
                    }

                    opponent_brief = ""
                    if opponent_turn:
                        opp_stance = opponent_turn.get("stance") or {}
                        opp_line = f"Opponent to address: {opponent['name']}. Their position: {opponent_turn['content'][:1200]}\nTheir stance: {opp_stance.get('type', 'NEUTRAL')} — {opp_stance.get('reason', '')}"
                        opponent_brief = opp_line

                    system_prompt = f"""You are {a['name']}, acting with the specific assigned role of '{role_of(a)}'.
Base instructions: {a['system_prompt']}

You are participating in an executive roundtable debate.
TOPIC: {topic}
TEAM LEADER: {leader_name}
PHASE: Round {round_num} — Targeted Rebuttals

{STANCE_INSTRUCTION}

DEBATE INSTRUCTIONS:
1. {opponent_brief or "Address the debate topic from your role."}
2. Directly rebut or sharpen the strongest claim of the opponent above, then reinforce your own position.
3. Do NOT repeat your opening statement verbatim — advance new analysis.
4. Keep your argument concise, impactful, and structured (2 to 4 crisp paragraphs)."""

                    messages = []
                    if doc_context:
                        messages.append({"role": "system", "content": doc_context})
                    for turn in conversation_history:
                        messages.append({"role": "user" if turn.get("is_human") else "assistant", "content": f"[{turn.get('speaker') or turn.get('agent_name')}]: {turn['content']}"})
                    messages.append({
                        "role": "user",
                        "content": f"It is your turn to speak, {a['name']} ({role_of(a)}). Deliver your Round {round_num} rebuttal."
                    })

                    reply = ""
                    async for chunk in LLMRouter.chat_stream(
                        model=a["model_id"],
                        messages=messages,
                        system_prompt=system_prompt,
                        provider=a.get("model_provider", "ollama"),
                        temperature=a.get("temperature", 0.3)
                    ):
                        if chunk.get("content"):
                            reply += chunk["content"]
                            yield {"type": "agent_token", "agent_id": a["id"], "content": chunk["content"]}

                    stance = parse_stance(reply)
                    turn_data = {
                        "round": round_num,
                        "agent_id": a["id"],
                        "agent_name": a["name"],
                        "agent_avatar": a["avatar"],
                        "role": role_of(a),
                        "model": a["model_id"],
                        "speaker": speaker_tag(a),
                        "content": stance["clean"],
                        "stance": {
                            "type": stance["type"],
                            "target": stance["target"],
                            "reason": stance["reason"]
                        }
                    }
                    conversation_history.append(turn_data)
                    yield {"type": "stance", "agent_id": a["id"], "stance": turn_data["stance"]}
                    yield {"type": "agent_turn_end", "agent_id": a["id"], "full_content": stance["clean"]}

                    await db.execute("UPDATE discussions SET transcript = ? WHERE id = ?;",
                                     (json.dumps(conversation_history), discussion_id))
                    await db.commit()

                score, disagreements = compute_consensus(conversation_history)
                yield {"type": "consensus_update", "score": score, "disagreements": disagreements, "round": round_num}
                if last_round_disagreements == 0 and disagreements == 0 and round_num >= 2:
                    consensus_breaks_early = True
                last_round_disagreements = disagreements

            # ---- Final Leader Consensus Synthesis ----
            yield {"type": "synthesis_start", "leader_name": leader_name}

            consensus_score, _ = compute_consensus(conversation_history)

            synthesis_prompt = f"""You are {leader_name}, the Executive Team Leader synthesizing this entire debate.
TOPIC: {topic}
MEASURED CONSENSUS SCORE: {consensus_score}%

FULL TRANSCRIPT:
{transcript_block()}

Generate the final structured Executive Synthesis using EXACTLY these section headers (###):

### 1. Final Consensus & Verdict
### 2. Decision Matrix
### 3. Key Contradictions & Risks
### 4. Action Plan & Ownership Matrix

Rules:
- Section 1 must state the final verdict decisively and cite the consensus level.
- Section 2 must list the options considered with pros/cons per option (bullet lines).
- Section 3 must list the key contradictions and residual risks (bullet lines).
- Section 4 must list concrete actions, each with an owner (agent name) and timeline.
Keep the entire synthesis tight and executive-grade."""

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

            # Persist debate outcome into memory facts
            try:
                verdict_match = re.search(r"###\s*1\.\s*Final Consensus & Verdict\s*(.+)", synthesis_text, re.DOTALL)
                verdict = verdict_match.group(1).strip()[:500] if verdict_match else synthesis_text[:500]
                await db.execute("""
                INSERT OR REPLACE INTO memories (id, category, key, value, source, is_pinned)
                VALUES (?, 'debate_outcome', ?, ?, 'system', 0);
                """, (f"mem-debate-{discussion_id}", f"Debate: {topic[:60]}", verdict))
                await db.commit()
            except Exception:
                pass

            yield {
                "type": "complete",
                "discussion_id": discussion_id,
                "summary": synthesis_text,
                "transcript": conversation_history,
                "meta": {
                    "consensus_score": consensus_score,
                    "rounds_used": 1 if consensus_breaks_early else (max_rounds if not consensus_breaks_early else max_rounds - 1),
                    "rounds_total": max_rounds
                }
            }

        finally:
            await db.close()

    @staticmethod
    async def participate_in_discussion(
        discussion_id: str,
        human_message: str,
        target_agent_id: Optional[str] = None,
        document_ids: List[str] = []
    ) -> AsyncGenerator[Dict[str, Any], None]:
        db = await get_db()
        try:
            cursor = await db.execute("SELECT * FROM discussions WHERE id = ?;", (discussion_id,))
            disc_row = await cursor.fetchone()
            if not disc_row:
                await db.execute("""
                INSERT OR IGNORE INTO discussions (id, title, topic, status, created_at)
                VALUES (?, ?, ?, 'in_progress', CURRENT_TIMESTAMP);
                """, (discussion_id, f"Debate: {human_message[:30]}...", human_message))
                await db.commit()
                cursor = await db.execute("SELECT * FROM discussions WHERE id = ?;", (discussion_id,))
                disc_row = await cursor.fetchone()

            disc = dict(disc_row) if disc_row else {
                "id": discussion_id, "topic": human_message, "leader_id": None, "roles_map": "{}", "agent_ids": "[]"
            }
            transcript = []
            try:
                transcript = json.loads(disc.get("transcript") or "[]")
            except Exception:
                transcript = []

            # Load any attached documents
            doc_context = ""
            if document_ids:
                placeholders_doc = ",".join("?" for _ in document_ids)
                cursor = await db.execute(f"SELECT id, filename, file_path FROM documents WHERE id IN ({placeholders_doc});", tuple(document_ids))
                doc_rows = await cursor.fetchall()
                excerpts = []
                import os
                for d in doc_rows:
                    if os.path.exists(d["file_path"]):
                        try:
                            with open(d["file_path"], "r", errors="ignore") as f:
                                excerpts.append(f"[{d['filename']}]:\n{f.read(10000)}")
                        except Exception:
                            pass
                if excerpts:
                    doc_context = "\n=== RELEVANT NEWLY ATTACHED DOCUMENTS ===\n" + "\n\n".join(excerpts) + "\n=========================================\n"

            human_turn = {
                "speaker": "Human Supervisor",
                "role": "Executive Direction",
                "content": human_message,
                "is_human": True
            }
            transcript.append(human_turn)

            yield {"type": "human_intervention", "content": human_message}

            chosen_agent_id = None
            if target_agent_id and target_agent_id != "leader":
                chosen_agent_id = target_agent_id
            else:
                chosen_agent_id = disc.get("leader_id")
                if not chosen_agent_id:
                    try:
                        agent_ids = json.loads(disc.get("agent_ids") or "[]")
                        chosen_agent_id = agent_ids[0] if agent_ids else None
                    except Exception:
                        chosen_agent_id = None

            agent_row = None
            if chosen_agent_id:
                cursor = await db.execute("SELECT * FROM agents WHERE id = ?;", (chosen_agent_id,))
                agent_row = await cursor.fetchone()
            
            if not agent_row:
                cursor = await db.execute("SELECT * FROM agents LIMIT 1;")
                agent_row = await cursor.fetchone()

            agent = dict(agent_row)
            roles_map = json.loads(disc.get("roles_map") or "{}")
            assigned_role = roles_map.get(agent["id"], agent["role"])
            is_leader = agent["id"] == disc.get("leader_id")

            system_prompt = f"""You are {agent['name']}, acting in the role of '{assigned_role}'.
Base persona: {agent['system_prompt']}

You are participating in an ongoing executive debate.
TOPIC: {disc['topic']}
ROLE: {assigned_role} {'(Team Leader)' if is_leader else ''}

The Human Supervisor has just intervened with a direct question/instruction:
"{human_message}"

{STANCE_INSTRUCTION}

INSTRUCTIONS:
1. Address the Human Supervisor directly, respectfully, and decisively.
2. Incorporate the supervisor's guidance and any attached specs into the team's ongoing debate context.
3. If you are the Leader, give executive clarity or direct your specialists accordingly."""

            messages = []
            if doc_context:
                messages.append({"role": "system", "content": doc_context})
            for turn in transcript[:-1]:
                speaker = turn.get("speaker") or turn.get("agent_name") or "Participant"
                messages.append({"role": "user" if turn.get("is_human") else "assistant", "content": f"[{speaker}]: {turn['content']}"})

            messages.append({"role": "user", "content": f"[Human Supervisor]: {human_message}"})

            yield {
                "type": "agent_turn_start",
                "agent_id": agent["id"],
                "agent_name": agent["name"],
                "agent_avatar": agent["avatar"],
                "role": assigned_role,
                "model": agent["model_id"],
                "is_leader": is_leader,
                "agent": {
                    "id": agent["id"], "name": agent["name"], "avatar": agent["avatar"],
                    "role": assigned_role, "model": agent["model_id"], "is_leader": is_leader
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
                    yield {"type": "agent_token", "agent_id": agent["id"], "content": chunk["content"]}

            stance = parse_stance(agent_reply)
            agent_turn_record = {
                "agent_id": agent["id"],
                "agent_name": agent["name"],
                "agent_avatar": agent["avatar"],
                "role": assigned_role,
                "model": agent["model_id"],
                "speaker": f"{agent['name']} ({assigned_role})",
                "content": stance["clean"],
                "is_leader": is_leader,
                "stance": {"type": stance["type"], "target": stance["target"], "reason": stance["reason"]}
            }
            transcript.append(agent_turn_record)

            await db.execute("""
            UPDATE discussions SET transcript = ? WHERE id = ?;
            """, (json.dumps(transcript), discussion_id))
            await db.commit()

            yield {"type": "stance", "agent_id": agent["id"], "stance": agent_turn_record["stance"]}
            yield {"type": "agent_turn_end", "agent_id": agent["id"], "full_content": stance["clean"]}

            # If the leader responded or if the debate was already completed, update the executive summary
            updated_summary = stance["clean"]
            if is_leader or disc.get("summary"):
                await db.execute("""
                UPDATE discussions SET summary = ?, status = 'completed' WHERE id = ?;
                """, (updated_summary, discussion_id))
                await db.commit()
                score, disagreements = compute_consensus(transcript)
                yield {"type": "consensus_update", "score": score}
                yield {"type": "complete", "discussion_id": discussion_id, "summary": updated_summary, "transcript": transcript}
            else:
                yield {"type": "complete", "discussion_id": discussion_id, "transcript": transcript}

        finally:
            await db.close()

    @staticmethod
    async def challenge_in_discussion(
        discussion_id: str,
        message: str,
        challenger_id: str,
        challenged_id: str
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

            cursor = await db.execute("SELECT * FROM agents WHERE id IN (?, ?);", (challenger_id, challenged_id))
            rows = await cursor.fetchall()
            agents_map = {row["id"]: dict(row) for row in rows}
            challenger = agents_map.get(challenger_id)
            if not challenger:
                yield {"type": "error", "message": "Challenger agent not found"}
                return
            challenged = agents_map.get(challenged_id)

            challenged_turn = None
            if challenged:
                challenged_turn = next((t for t in reversed(transcript) if t.get("agent_id") == challenged_id), None)

            roles_map = json.loads(disc.get("roles_map") or "{}")
            assigned_role = roles_map.get(challenger["id"], challenger["role"])
            is_leader = challenger["id"] == disc.get("leader_id")

            human_turn = {
                "speaker": "Human Supervisor",
                "role": "Executive Direction",
                "content": f"@challenge {challenged['name'] if challenged else 'team'}: {message}",
                "is_human": True
            }
            transcript.append(human_turn)
            yield {"type": "human_intervention", "content": human_turn["content"]}

            challenged_brief = ""
            if challenged and challenged_turn:
                challenged_brief = f"Challenged position of {challenged['name']} ({challenged_turn.get('role', '')}):\n{challenged_turn['content'][:1500]}"

            system_prompt = f"""You are {challenger['name']}, acting in the role of '{assigned_role}'.
Base persona: {challenger['system_prompt']}

You are participating in an executive debate.
TOPIC: {disc['topic']}

The Human Supervisor has ordered you to directly CHALLENGE {challenged['name'] if challenged else 'the team'}:
"{message}"

{challenged_brief or "No specific target turn found — challenge the overall team consensus."}

{STANCE_INSTRUCTION}

INSTRUCTIONS:
1. Attack the specific weaknesses, assumptions, or gaps in the challenged position.
2. Be rigorous and direct — this is a formal challenge.
3. Then restate your own counter-position decisively."""

            messages = []
            for turn in transcript[:-1]:
                speaker = turn.get("speaker") or turn.get("agent_name") or "Participant"
                messages.append({"role": "user" if turn.get("is_human") else "assistant", "content": f"[{speaker}]: {turn['content']}"})
            messages.append({"role": "user", "content": f"[Human Supervisor]: {human_turn['content']}"})

            yield {
                "type": "agent_turn_start",
                "agent": {
                    "id": challenger["id"], "name": challenger["name"], "avatar": challenger["avatar"],
                    "role": assigned_role, "model": challenger["model_id"], "is_leader": is_leader,
                    "challenge": True
                }
            }

            reply = ""
            async for chunk in LLMRouter.chat_stream(
                model=challenger["model_id"],
                messages=messages,
                system_prompt=system_prompt,
                provider=challenger.get("model_provider", "ollama"),
                temperature=0.2
            ):
                if chunk.get("content"):
                    reply += chunk["content"]
                    yield {"type": "agent_token", "agent_id": challenger["id"], "content": chunk["content"]}

            stance = parse_stance(reply)
            record = {
                "agent_id": challenger["id"],
                "agent_name": challenger["name"],
                "agent_avatar": challenger["avatar"],
                "role": assigned_role,
                "model": challenger["model_id"],
                "speaker": f"{challenger['name']} ({assigned_role})",
                "content": stance["clean"],
                "is_leader": is_leader,
                "challenge": True,
                "stance": {"type": stance["type"], "target": stance["target"], "reason": stance["reason"]}
            }
            transcript.append(record)

            await db.execute("UPDATE discussions SET transcript = ? WHERE id = ?;",
                             (json.dumps(transcript), discussion_id))
            await db.commit()

            yield {"type": "stance", "agent_id": challenger["id"], "stance": record["stance"]}
            yield {"type": "agent_turn_end", "agent_id": challenger["id"], "full_content": stance["clean"]}
            yield {"type": "complete", "discussion_id": discussion_id, "transcript": transcript}

        finally:
            await db.close()

    @staticmethod
    async def export_discussion(discussion_id: str, fmt: str = "md") -> Dict[str, Any]:
        db = await get_db()
        try:
            cursor = await db.execute("SELECT * FROM discussions WHERE id = ?;", (discussion_id,))
            row = await cursor.fetchone()
            if not row:
                return {"error": "Discussion not found"}
            disc = dict(row)
            transcript = []
            try:
                transcript = json.loads(disc.get("transcript") or "[]")
            except Exception:
                transcript = []

            if fmt == "json":
                return {"id": disc["id"], "topic": disc["topic"], "summary": disc.get("summary", ""),
                        "transcript": transcript, "meta": {"created_at": disc.get("created_at")}}

            lines = [
                f"# Debate: {disc['topic']}",
                f"\n*Created: {disc.get('created_at')}*",
                "\n## Transcript\n"
            ]
            for t in transcript:
                speaker = t.get("speaker") or t.get("agent_name") or "Participant"
                stance = t.get("stance") or {}
                stance_str = f" **[STANCE: {stance.get('type', '')}{(' with ' + stance.get('target', '')) if stance.get('target') else ''}]**" if stance else ""
                lines.append(f"\n### {speaker}{stance_str}\n\n{t['content']}\n")
            if disc.get("summary"):
                lines.append(f"\n## Executive Synthesis\n\n{disc['summary']}\n")
            return {"content": "\n".join(lines)}

        finally:
            await db.close()