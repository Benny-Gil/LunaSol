import os
import llama_cpp
from llama_cpp import Llama

model = None

def get_model():
    return model

def _ggml_type(name: str) -> int:
    """Map a KV-cache type name (e.g. 'q8_0', 'q4_0', 'f16') to its ggml type id."""
    try:
        return getattr(llama_cpp, f"GGML_TYPE_{name.strip().upper()}")
    except AttributeError:
        raise RuntimeError(
            f"Unknown KV cache type '{name}'. Use one of: f16, q8_0, q4_0, q5_0, q5_1."
        )

def load_model():
    global model
    mock_mode = os.getenv("MOCK_MODE", "false").lower() == "true"
    model_path = os.getenv("MODEL_PATH", "/models/model.gguf")
    n_gpu_layers = int(os.getenv("N_GPU_LAYERS", "-1"))
    n_ctx = int(os.getenv("N_CTX", "2048"))
    flash_attn = os.getenv("FLASH_ATTN", "true").lower() == "true"
    kv_k = os.getenv("KV_CACHE_TYPE_K", "q8_0")
    kv_v = os.getenv("KV_CACHE_TYPE_V", "q8_0")

    if mock_mode:
        print("Starting in MOCK MODE - local LLM model will not be loaded.")
        return None

    print(
        f"Loading GGUF model from {model_path} with {n_gpu_layers} GPU layers, "
        f"n_ctx={n_ctx}, flash_attn={flash_attn}, kv_cache=({kv_k}/{kv_v})..."
    )
    if not os.path.exists(model_path):
        raise RuntimeError(f"Model file not found at path: {model_path}")
    try:
        model = Llama(
            model_path=model_path,
            n_ctx=n_ctx,
            n_gpu_layers=n_gpu_layers,
            flash_attn=flash_attn,
            type_k=_ggml_type(kv_k),
            type_v=_ggml_type(kv_v),
            verbose=False
        )
        print("Model loaded successfully!")
        return model
    except Exception as e:
        print(f"Failed to load model: {e}")
        raise RuntimeError(f"Model loading failed: {e}")

def unload_model():
    global model
    if model is not None:
        del model
        model = None
