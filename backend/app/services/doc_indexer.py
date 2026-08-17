import os
import uuid
import re
import json
import csv
import io
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import List, Dict, Any, Optional
from pypdf import PdfReader
from app.config import DOCUMENTS_STORAGE_DIR
from app.db import get_db

class DocIndexer:
    @staticmethod
    async def process_and_index_file(filename: str, file_bytes: bytes) -> Dict[str, Any]:
        doc_id = f"doc-{uuid.uuid4().hex[:8]}"
        save_path = DOCUMENTS_STORAGE_DIR / f"{doc_id}_{filename}"
        
        with open(save_path, "wb") as f:
            f.write(file_bytes)

        text_content = ""
        file_ext = Path(filename).suffix.lower()

        # 1. PDF Documents
        if file_ext == ".pdf":
            try:
                reader = PdfReader(save_path)
                for page_idx, page in enumerate(reader.pages):
                    text = page.extract_text()
                    if text:
                        text_content += f"\n[Page {page_idx + 1}]\n" + text
            except Exception as e:
                text_content = f"PDF Document: {filename}\n(Error extracting text: {e})"

        # 2. DOCX Word Documents (extract XML without external deps)
        elif file_ext in {".docx", ".doc"}:
            try:
                with zipfile.ZipFile(save_path) as z:
                    xml_content = z.read("word/document.xml")
                    tree = ET.fromstring(xml_content)
                    paragraphs = []
                    for node in tree.iter():
                        if node.tag.endswith("}p"):
                            texts = [t.text for t in node.iter() if t.tag.endswith("}t") and t.text]
                            if texts:
                                paragraphs.append("".join(texts))
                    text_content = f"Word Document: {filename}\n\n" + "\n\n".join(paragraphs)
            except Exception as e:
                text_content = f"Word Document: {filename}\n(Stored as document: {e})"

        # 3. CSV & TSV Data Sheets
        elif file_ext in {".csv", ".tsv"}:
            try:
                delimiter = "\t" if file_ext == ".tsv" else ","
                decoded = file_bytes.decode("utf-8", errors="ignore")
                reader = csv.reader(io.StringIO(decoded), delimiter=delimiter)
                rows = list(reader)
                if rows:
                    header = " | ".join(rows[0])
                    body_rows = [" | ".join(r) for r in rows[1:500]]
                    text_content = f"Data Sheet ({filename}):\nHeaders: {header}\n\nRows:\n" + "\n".join(body_rows)
                else:
                    text_content = f"Empty data sheet {filename}"
            except Exception as e:
                text_content = f"Data Sheet: {filename}\n(Error: {e})"

        # 4. JSON & Structured Data
        elif file_ext in {".json", ".jsonl", ".ndjson"}:
            try:
                decoded = file_bytes.decode("utf-8", errors="ignore")
                try:
                    parsed = json.loads(decoded)
                    text_content = f"JSON Data ({filename}):\n" + json.dumps(parsed, indent=2)[:30000]
                except Exception:
                    text_content = decoded[:30000]
            except Exception as e:
                text_content = f"JSON File: {filename}"

        # 5. Image & Visual Media (.png, .jpg, .svg, .webp)
        elif file_ext in {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico"}:
            text_content = f"Image Asset: {filename}\nFormat: {file_ext.upper()}\nSize: {len(file_bytes)} bytes\nPath: {save_path}"

        # 6. Audio / Video / Binary Archives
        elif file_ext in {".mp3", ".wav", ".mp4", ".zip", ".tar", ".gz", ".bin"}:
            text_content = f"Binary Media/Archive: {filename}\nFormat: {file_ext.upper()}\nSize: {len(file_bytes)} bytes"

        # 7. Text, Markdown, Source Code & Scripting Files
        else:
            try:
                text_content = file_bytes.decode("utf-8", errors="replace")
            except Exception as e:
                text_content = f"File: {filename}\n(Error reading content: {e})"

        # Chunk text (~1200 chars per chunk with 150 char overlap)
        chunks = DocIndexer._chunk_text(text_content, chunk_size=1200, overlap=150)
        if not chunks and text_content:
            chunks = [text_content[:1500]]

        # Store in SQLite
        db = await get_db()
        try:
            await db.execute("""
            INSERT INTO documents (id, filename, file_type, size, file_path, chunk_count, summary)
            VALUES (?, ?, ?, ?, ?, ?, ?);
            """, (
                doc_id,
                filename,
                file_ext,
                len(file_bytes),
                str(save_path),
                len(chunks),
                text_content[:250].strip() + "..."
            ))

            chunk_records = []
            for idx, chunk in enumerate(chunks):
                chunk_id = f"chunk-{doc_id}-{idx}"
                chunk_records.append((chunk_id, doc_id, idx, chunk))

            if chunk_records:
                await db.executemany("""
                INSERT INTO doc_chunks (id, doc_id, chunk_index, content)
                VALUES (?, ?, ?, ?);
                """, chunk_records)

            await db.commit()
        finally:
            await db.close()

        return {
            "id": doc_id,
            "filename": filename,
            "file_type": file_ext,
            "size": len(file_bytes),
            "chunk_count": len(chunks),
            "preview": text_content[:500]
        }

    @staticmethod
    def _chunk_text(text: str, chunk_size: int = 1200, overlap: int = 150) -> List[str]:
        if not text.strip():
            return []
        
        words = text.split()
        chunks = []
        current_chunk = []
        current_length = 0

        for word in words:
            current_chunk.append(word)
            current_length += len(word) + 1
            if current_length >= chunk_size:
                chunks.append(" ".join(current_chunk))
                # Retain overlap words
                overlap_words = current_chunk[-max(1, int(len(current_chunk) * 0.15)):]
                current_chunk = overlap_words
                current_length = sum(len(w) + 1 for w in current_chunk)

        if current_chunk:
            chunks.append(" ".join(current_chunk))

        return chunks

    @staticmethod
    async def search_relevant_chunks(doc_ids: List[str], query: str, top_k: int = 5) -> List[str]:
        if not doc_ids or not query.strip():
            return []

        db = await get_db()
        try:
            placeholders = ",".join(["?"] * len(doc_ids))
            cursor = await db.execute(f"""
            SELECT content FROM doc_chunks 
            WHERE doc_id IN ({placeholders});
            """, doc_ids)
            rows = await cursor.fetchall()
            
            all_chunks = [r["content"] for r in rows]
            if not all_chunks:
                return []

            # Match chunks containing query terms
            query_terms = [t.lower() for t in re.findall(r"\w+", query) if len(t) > 2]
            scored_chunks = []

            for chunk in all_chunks:
                chunk_lower = chunk.lower()
                score = sum(chunk_lower.count(term) for term in query_terms)
                if score > 0:
                    scored_chunks.append((score, chunk))

            scored_chunks.sort(key=lambda x: x[0], reverse=True)
            
            if scored_chunks:
                return [c[1] for c in scored_chunks[:top_k]]
            else:
                return all_chunks[:top_k]
        finally:
            await db.close()
