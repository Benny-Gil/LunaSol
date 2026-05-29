import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

from src.schemas import RecommendRequest
from src.model import load_model, unload_model, get_model
from src.triage import mock_recommendation_stream, real_recommendation_stream

@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield
    unload_model()

app = FastAPI(title="LunaSol AI Recommendation Service", lifespan=lifespan)

@app.post("/recommend")
async def recommend(request: RecommendRequest):
    mock_mode = os.getenv("MOCK_MODE", "false").lower() == "true"
    model = get_model()
    
    # Extract messages or convert legacy symptoms input to a single message list
    if request.messages:
        messages = request.messages
    else:
        from src.schemas import ChatMessage
        messages = [ChatMessage(role="user", content=request.symptoms or "")]
        
    if mock_mode or model is None:
        return StreamingResponse(
            mock_recommendation_stream(messages, request.doctors),
            media_type="text/event-stream"
        )
    else:
        return StreamingResponse(
            real_recommendation_stream(messages, request.doctors, model),
            media_type="text/event-stream"
        )

@app.get("/health")
def health():
    mock_mode = os.getenv("MOCK_MODE", "false").lower() == "true"
    model = get_model()
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "mock_mode": mock_mode,
        "model_path": os.getenv("MODEL_PATH", "/models/model.gguf")
    }

@app.get("/")
def read_root():
    return {"status": "ok", "message": "LunaSol AI Service is running"}
