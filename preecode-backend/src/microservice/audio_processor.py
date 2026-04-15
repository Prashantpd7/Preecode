"""Audio processing utilities for speech metrics."""
import re

FILLER_WORDS = {"um", "uh", "like", "you", "know", "basically", "actually", "so", "right"}

def compute_metrics(transcription: str, audio_duration_seconds: float = None) -> dict:
    words = transcription.lower().split()
    total_words = len(words) if words else 1

    # Speech rate (words per minute)
    if audio_duration_seconds and audio_duration_seconds > 0:
        duration_minutes = audio_duration_seconds / 60
    else:
        # Estimate: average speaking pace ~2.5 words/second
        duration_minutes = total_words / (2.5 * 60)
    speech_rate = round(total_words / duration_minutes) if duration_minutes > 0 else 0

    # Filler word percentage
    filler_count = sum(1 for w in words if re.sub(r"[^a-z]", "", w) in FILLER_WORDS)
    filler_percent = round((filler_count / total_words) * 100, 1)

    # Clarity score: vocabulary richness proxy
    unique_words = len(set(re.sub(r"[^a-z]", "", w) for w in words if w))
    clarity_score = min(100, round((unique_words / total_words) * 200))

    # Energy score: placeholder for MVP
    energy_score = 75

    return {
        "speechRate": speech_rate,
        "fillerWordPercent": filler_percent,
        "clarityScore": clarity_score,
        "energyScore": energy_score,
    }
