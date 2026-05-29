import os
from llama_cpp import Llama

model = None

def get_model():
    return model

def load_model():
    global model
    mock_mode = os.getenv("MOCK_MODE", "false").lower() == "true"
    model_path = os.getenv("MODEL_PATH", "/models/model.gguf")
    n_gpu_layers = int(os.getenv("N_GPU_LAYERS", "-1"))
    
    if mock_mode:
        print("Starting in MOCK MODE - local LLM model will not be loaded.")
        return None
        
    print(f"Loading GGUF model from {model_path} with {n_gpu_layers} GPU layers...")
    if not os.path.exists(model_path):
        raise RuntimeError(f"Model file not found at path: {model_path}")
    try:
        model = Llama(
            model_path=model_path,
            n_ctx=2048,
            n_gpu_layers=n_gpu_layers,
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
