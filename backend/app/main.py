from __future__ import annotations

import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.analyzer.elf import InvalidELF, analyze_elf
from app.analyzer.compare import compare_elf

MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(25 * 1024 * 1024)))
app = FastAPI(title="errata API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
def health():
    return {"status": "ok"}


async def save_upload(upload: UploadFile, directory: str) -> Path:
    # Never use the client-provided filename as a filesystem path.
    path = Path(directory) / ("baseline.bin" if upload.filename == "__baseline__" else "candidate.bin")
    total = 0
    with path.open("wb") as output:
        while True:
            chunk = await upload.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail=f"Each file must be at most {MAX_UPLOAD_BYTES // (1024 * 1024)} MiB.")
            output.write(chunk)
    if total == 0:
        raise HTTPException(status_code=400, detail="Uploaded files cannot be empty.")
    return path


@app.post("/api/v1/analyze")
async def analyze(baseline: UploadFile = File(...), candidate: UploadFile = File(...)):
    with tempfile.TemporaryDirectory(prefix="errata-") as directory:
        original_b = Path(baseline.filename or "baseline.elf").name
        original_c = Path(candidate.filename or "candidate.elf").name
        baseline.filename = "__baseline__"
        b_path = await save_upload(baseline, directory)
        candidate.filename = "__candidate__"
        c_path = await save_upload(candidate, directory)
        try:
            b = analyze_elf(b_path, original_b)
            c = analyze_elf(c_path, original_c)
            return compare_elf(b, c)
        except InvalidELF as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
