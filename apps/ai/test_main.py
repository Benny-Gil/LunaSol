import os
import pytest
from fastapi.testclient import TestClient

# Force mock mode during testing
os.environ["MOCK_MODE"] = "true"

from src.main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["mock_mode"] is True
    assert data["model_loaded"] is False

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert "LunaSol AI Service is running" in response.json()["message"]

def test_recommend_mock_stream_standard():
    payload = {
        "symptoms": "skin rash and itching",
        "doctors": [
            {"id": "doc_1", "name": "Dr. Santos", "specialization": "Dermatology"},
            {"id": "doc_2", "name": "Dr. Reyes", "specialization": "Neurology"}
        ]
    }
    response = client.post("/recommend", json=payload)
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    
    content = response.text
    # Verify standard SSE sections are formatted correctly
    assert "event: reasoning" in content
    assert "event: recommendations" in content
    assert "event: done" in content
    assert "Dermatology" in content
    assert "doc_1" in content
    assert "doc_2" not in content

def test_recommend_mock_stream_emergency():
    payload = {
        "symptoms": "severe chest pain and left arm numbness",
        "doctors": [
            {"id": "doc_1", "name": "Dr. Santos", "specialization": "Cardiology"}
        ]
    }
    response = client.post("/recommend", json=payload)
    assert response.status_code == 200
    
    content = response.text
    # Verify emergency banner is triggered in mock stream for "chest pain"
    assert "EMERGENCY NOTICE" in content
    assert "911" in content

def test_recommend_mock_stream_messages_clarifying():
    payload = {
        "messages": [
            {"role": "user", "content": "I feel unwell and am in pain"}
        ],
        "doctors": [
            {"id": "doc_1", "name": "Dr. Santos", "specialization": "Dermatology"}
        ]
    }
    response = client.post("/recommend", json=payload)
    assert response.status_code == 200
    content = response.text
    # Verify clarifying question is asked (no symptoms matched)
    assert "Could you please describe your symptoms in more detail" in content
    assert "event: recommendations" not in content

def test_recommend_mock_stream_messages_resolved():
    payload = {
        "messages": [
            {"role": "user", "content": "I feel unwell and am in pain"},
            {"role": "assistant", "content": "Could you please describe your symptoms in more detail?"},
            {"role": "user", "content": "My skin rash is really itchy and red"}
        ],
        "doctors": [
            {"id": "doc_1", "name": "Dr. Santos", "specialization": "Dermatology"}
        ]
    }
    response = client.post("/recommend", json=payload)
    assert response.status_code == 200
    content = response.text
    # Verify recommendations are outputted because symptoms are resolved
    assert "event: recommendations" in content
    assert "Dermatology" in content
    assert "doc_1" in content

