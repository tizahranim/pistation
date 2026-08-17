from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
import mimetypes
from typing import List, Dict, Any, Optional
from app.db import get_db
from app.services.doc_indexer import DocIndexer

router = APIRouter(prefix="/api/documents", tags=["documents"])

class SearchDocsRequest(BaseModel):
    document_ids: List[str]
    query: str
    top_k: Optional[int] = 5

@router.get("")
async def list_documents():
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM documents ORDER BY created_at DESC;")
        rows = await cursor.fetchall()
        docs = [dict(r) for r in rows]
        
        # Count chunks per document
        for doc in docs:
            c_cur = await db.execute("SELECT COUNT(*) as chunk_count FROM doc_chunks WHERE doc_id = ?;", (doc["id"],))
            c_row = await c_cur.fetchone()
            doc["chunk_count"] = c_row["chunk_count"] if c_row else 0
            
        return docs
    finally:
        await db.close()

@router.get("/{doc_id}")
async def get_document_detail(doc_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM documents WHERE id = ?;", (doc_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Document not found")
        
        doc = dict(row)
        
        # Fetch chunks
        c_cur = await db.execute("SELECT chunk_index, content FROM doc_chunks WHERE doc_id = ? ORDER BY chunk_index ASC;", (doc_id,))
        chunks = await c_cur.fetchall()
        doc["chunks"] = [dict(c) for c in chunks]
        doc["chunk_count"] = len(chunks)
        
        # Read raw content if file exists
        file_path = doc.get("file_path")
        if file_path and os.path.exists(file_path):
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    doc["raw_preview"] = f.read(50000)
            except Exception:
                doc["raw_preview"] = ""
        else:
            doc["raw_preview"] = ""
            
        return doc
    finally:
        await db.close()

@router.get("/{doc_id}/download")
async def download_document(doc_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM documents WHERE id = ?;", (doc_id,))
        row = await cursor.fetchone()
        if not row or not os.path.exists(row["file_path"]):
            raise HTTPException(status_code=404, detail="Document file not found")
        
        mime_type, _ = mimetypes.guess_type(row["filename"])
        return FileResponse(
            path=row["file_path"],
            filename=row["filename"],
            media_type=mime_type or "application/octet-stream"
        )
    finally:
        await db.close()

@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    
    result = await DocIndexer.process_and_index_file(file.filename, contents)
    return {"status": "indexed", "document": result}

@router.post("/search")
async def search_documents(req: SearchDocsRequest):
    chunks = await DocIndexer.search_relevant_chunks(
        doc_ids=req.document_ids,
        query=req.query,
        top_k=req.top_k or 5
    )
    return {"results": chunks}

@router.delete("/{doc_id}")
async def delete_document(doc_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT file_path FROM documents WHERE id = ?;", (doc_id,))
        row = await cursor.fetchone()
        if row and os.path.exists(row["file_path"]):
            try:
                os.remove(row["file_path"])
            except Exception:
                pass

        await db.execute("DELETE FROM doc_chunks WHERE doc_id = ?;", (doc_id,))
        await db.execute("DELETE FROM documents WHERE id = ?;", (doc_id,))
        await db.commit()
        return {"status": "deleted", "id": doc_id}
    finally:
        await db.close()
