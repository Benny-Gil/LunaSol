from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict
import asyncio

app = FastAPI(title="LunaSol AI Service Mock")

class Doctor(BaseModel):
    id: str
    name: str
    specialization: str

class RecommendRequest(BaseModel):
    symptoms: str
    doctors: List[Doctor]

async def mock_recommendation_stream(symptoms: str, doctors: List[Doctor]):
    yield "data: Starting AI analysis of symptoms...\n\n"
    await asyncio.sleep(0.5)
    yield f"data: Received symptoms: '{symptoms}'\n\n"
    await asyncio.sleep(0.5)
    yield "data: Matching available doctors...\n\n"
    await asyncio.sleep(0.5)
    for doc in doctors:
        yield f"data: Recommendation: {doc.name} ({doc.specialization}) - highly relevant specialization for matching symptoms.\n\n"
        await asyncio.sleep(0.5)
    yield "data: [DONE]\n\n"

@app.post("/recommend")
async def recommend(request: RecommendRequest):
    return StreamingResponse(
        mock_recommendation_stream(request.symptoms, request.doctors),
        media_type="text/event-stream"
    )

@app.get("/")
def read_root():
    return {"status": "ok", "message": "LunaSol AI Service Mock is running"}
