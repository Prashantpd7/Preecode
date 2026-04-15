"""
Preecode Audio Processing Microservice
Runs on port 8001. Transcribes audio via Whisper and returns speech metrics.

Start with:
    uvicorn main:app --host 0.0.0.0 --port 8001
"""

import base64
import os
import tempfile
import uuid

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from audio_processor import compute_metrics

app = FastAPI(title="Preecode Audio Processor", version="1.0.0")


class AudioRequest(BaseModel):
    audio_base64: str


class AudioResponse(BaseModel):
    transcription: str
    speechRate: float
    fillerWordPercent: float
    clarityScore: float
    energyScore: float


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/process-audio", response_model=AudioResponse)
async def process_audio(payload: AudioRequest):
    if not payload.audio_base64:
        raise HTTPException(status_code=400, detail="audio_base64 is required")

    # Decode base64 → temp WAV file
    tmp_path = os.path.join(tempfile.gettempdir(), f"preecode_{uuid.uuid4().hex}.wav")
    try:
        audio_bytes = base64.b64decode(payload.audio_base64)
        with open(tmp_path, "wb") as f:
            f.write(audio_bytes)

        # Transcribe with Whisper
        try:
            import whisper  # type: ignore
            model = whisper.load_model("base")
            result = model.transcribe(tmp_path)
            transcription = result.get("text", "").strip()
        except Exception as whisper_err:
            # Graceful fallback if Whisper not available
            print(f"[whisper] error: {whisper_err}")
            transcription = "[Transcription unavailable]"

        metrics = compute_metrics(transcription)

        return AudioResponse(
            transcription=transcription,
            speechRate=metrics["speechRate"],
            fillerWordPercent=metrics["fillerWordPercent"],
            clarityScore=metrics["clarityScore"],
            energyScore=metrics["energyScore"],
        )
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
