import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse

from src.schemas import RecommendRequest
from src.model import load_model, unload_model, get_model
from src.triage import mock_recommendation_stream, real_recommendation_stream

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("lunasol.ai")

@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield
    unload_model()

app = FastAPI(title="LunaSol AI Recommendation Service", lifespan=lifespan)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Log the real cause server-side; return a sanitized message to the client.
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

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
