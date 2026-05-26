# AI Service

## Decision: Local GGUF Model over External API

**Why local inference:**
- No API key, no per-request cost, no rate limits
- Patient symptom data never leaves the server — critical for a healthcare application
- Works fully offline after setup
- Model can be swapped by replacing a single file on the server

**Trade-off accepted:** Inference is slower than a hosted model API, especially on CPU. Response time depends on the server's hardware. The SSE streaming pattern mitigates perceived latency by sending partial results as they're generated.

---

## Stack: FastAPI + llama-cpp-python

**Why FastAPI:**
- Python is required — `llama-cpp-python` is a Python binding for `llama.cpp`
- FastAPI is async-first and handles streaming responses natively via `StreamingResponse`
- Type annotations + Pydantic for request validation
- Fast startup compared to Django or Flask

**Why llama-cpp-python over Ollama or Transformers:**
- `llama-cpp-python` is a thin wrapper around `llama.cpp` — minimal overhead, runs on CPU without GPU
- No separate daemon process (unlike Ollama)
- GGUF format is widely supported and models are available at various quantization levels to balance quality vs. speed

**Model:** A quantized GGUF model (e.g., Qwen-2.5-1.5B-Instruct-Q4_K_M) is used. Smaller quantized models are chosen to keep inference fast on CPU hardware. The model file is not bundled in the Docker image — it is mounted from the host at `/models/model.gguf`.

---

## Service Design

### Endpoint
```
POST /recommend
Content-Type: application/json

{
  "symptoms": "I have chest pain and shortness of breath",
  "doctors": [
    { "id": "...", "name": "Dr. Santos", "specialization": "Cardiology" },
    ...
  ]
}
```

Response: `text/event-stream` (SSE)

### Why SSE over WebSocket or plain HTTP
- The recommendation is a one-way stream from server to browser — SSE is the right primitive
- SSE works over standard HTTP, no special proxy config needed
- Browser's `EventSource` API handles reconnection automatically
- WebSocket would be overkill for a one-shot request/stream pattern

### Prompt Design
The model receives a structured prompt:
1. System context: "You are a medical triage assistant..."
2. Available doctors (id, name, specialization)
3. Patient's symptom description
4. Instruction: recommend the most relevant doctors with a brief reason for each

The model output is streamed as plain text. NestJS parses the final event to extract doctor IDs and appends matched full doctor objects from the database.

---

## SSE Chain

```
Browser  →  NestJS  →  FastAPI  →  llama-cpp-python
  ↑                                        │
  └──────────── SSE stream ────────────────┘
```

### NestJS SSE Relay (GET /api/ai/recommend)

1. Fetch all doctors from the database
2. Call `POST http://ai:8000/recommend` with symptoms + doctor summaries
3. Set response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`
4. Pipe the FastAPI `ReadableStream` to the HTTP response using `fetch` + `body.getReader()`
5. After the stream closes, emit a final `data: {"type":"doctors","payload":[...]}` event with full doctor objects from the DB

### Fallback
If FastAPI is unavailable or returns an error, NestJS returns all doctors as a fallback `doctors` event without any AI reasoning. The patient still gets a list of doctors — the AI reasoning is just absent.

---

## Docker Volume for Model File

The GGUF model file is large (1–4 GB depending on quantization) and changes independently of the code. It is:
- Stored on the host at `/data/models/model.gguf`
- Mounted into the `ai` container at `/models/model.gguf`
- **Never committed to the repository**
- **Never baked into the Docker image**

This means the image stays small and rebuilding the image does not require re-downloading the model.
