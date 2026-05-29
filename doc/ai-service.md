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

**Model:** [MedGemma 1.5 4B IT](https://huggingface.co/google/medgemma-1.5-4b-it) — a medical-domain instruction-tuned model by Google, quantized to **IQ4_XS** GGUF format (`medgemma-1.5-4b-it-IQ4_XS.gguf`, ~2.2 GB). Built on Gemma 3 architecture with 4B parameters, 128K context window, and grouped-query attention. The model file is not bundled in the Docker image — it is mounted from the host at `/models/model.gguf`.

### Why MedGemma

- **Medical domain fine-tuning**: Trained on clinical text and medical image-text pairs — significantly better at symptom analysis and doctor-specialization matching than general-purpose models of the same size
- **Right-sized for the hardware**: At 2.2 GB (IQ4_XS), it fits entirely in the server's 4 GB GTX 1650 VRAM with headroom to spare
- **Gemma 3 architecture**: Modern architecture with grouped-query attention, efficient inference
- **Privacy-first**: Runs fully local — patient symptom data never leaves the server

### Quantization Choice: IQ4_XS

IQ4_XS is an importance-matrix quantization at ~4.25 bits per weight. It offers a good balance:

| Quant | File Size | Quality | Speed |
|---|---|---|---|
| Q8_0 | ~4.5 GB | Best | ❌ Won't fit in 4 GB VRAM |
| Q5_K_M | ~3.1 GB | Very good | ⚠️ Tight fit, no headroom |
| **IQ4_XS** | **~2.2 GB** | **Good** | **✅ Fits with ~1.8 GB headroom** |
| IQ2_XS | ~1.2 GB | Degraded | Too lossy for medical use |

For a symptom → doctor matching task (short prompts, short responses), IQ4_XS retains sufficient reasoning quality while keeping inference fast.

> **Note**: MedGemma is also multimodal (vision), but loading the vision projector (`mmproj`) is not needed for our text-only symptom analysis use case. We load only the text GGUF to save memory and reduce startup time.

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

The GGUF model file (~2.2 GB) changes independently of the code. It is:

- Stored on the host (e.g. project root during dev, `/data/models/` in production)
- Mounted into the `ai` container at `/models/model.gguf`
- **Never committed to the repository** (listed in `.gitignore`)
- **Never baked into the Docker image**

This means the image stays small and rebuilding the image does not require re-downloading the model.

---

## Hardware Analysis & Capacity Planning

### Server Specs

| Component | Spec |
|---|---|
| CPU | AMD Ryzen 5 2600 — 6 cores / 12 threads @ 3.4 GHz |
| RAM | 16 GB DDR4 (~6.3 GB available at runtime) |
| GPU | NVIDIA GeForce GTX 1650 — 4 GB VRAM (Turing, compute capability 7.5) |
| Disk | 115 GB SSD (~40 GB free) |
| OS | Arch Linux, kernel 6.18 LTS |

### MedGemma IQ4_XS on This Hardware

| Metric | Value |
|---|---|
| Model file size | 2.2 GB |
| VRAM required (full offload) | ~2.2 GB + ~200 MB KV cache |
| VRAM remaining | ~1.6 GB (for OS/display/other) |
| Fits entirely in GPU? | **✅ Yes** |
| `n_gpu_layers` | All layers (full GPU offload) |
| Estimated throughput | **~20–30 tok/s** (full GPU) |
| Context window (usable) | 2048–4096 tokens (limited by VRAM for KV cache; model supports 128K natively but KV cache for that won't fit) |

### Request Characteristics

For the doctor recommendation use case, each request is lightweight:

| Metric | Estimate |
|---|---|
| System prompt + doctor list | ~200–400 tokens |
| Patient symptom input | ~50–150 tokens |
| Model response | ~200–400 tokens |
| **Total per request** | **~500–900 tokens** |
| **Time per request** | **~15–30 seconds** (at ~20 tok/s generation) |

### Concurrent User Capacity

`llama-cpp-python` processes inference requests **sequentially** — there is no request batching. Concurrent requests queue up.

| Concurrent Users | Behavior | Wait Time (worst case) |
|---|---|---|
| **1** | Immediate response | ~20s |
| **2** | Second user waits for first | ~40s |
| **3** | Third user waits for both | ~60s |
| **5+** | Queueing becomes painful | 100s+ |

**Realistic capacity: 1–2 concurrent users with acceptable UX.**

The SSE streaming pattern helps significantly — the first tokens appear within ~2 seconds, so the user sees activity immediately even if the full response takes 20s. This makes the perceived latency much better than a blocking HTTP request.

### Operational Notes

- **GPU memory is shared with the display server**: If running a desktop environment, ~200–500 MB of VRAM is consumed by the compositor. Consider running the server headless for maximum inference headroom.
- **Swap is fully used** (512 MB): The system is memory-constrained. Avoid running other heavy services alongside inference.
- **Model startup time**: First load takes ~5–10 seconds as the model is memory-mapped from disk. Subsequent requests reuse the loaded model.
- **`n_ctx` configuration**: Set to 2048 for our use case (doctor recommendations with short prompts). Higher values consume more VRAM for the KV cache. At `n_ctx=4096`, expect ~400 MB additional VRAM usage.
- **Temperature**: Use a low temperature (0.3–0.5) for medical recommendations to reduce hallucination risk. The model's outputs are triage suggestions, not diagnoses.
