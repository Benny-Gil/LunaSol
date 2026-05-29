from typing import List, Optional
from pydantic import BaseModel

class Doctor(BaseModel):
    id: str
    name: str
    specialization: str

class ChatMessage(BaseModel):
    role: str
    content: str

class RecommendRequest(BaseModel):
    symptoms: Optional[str] = None
    messages: Optional[List[ChatMessage]] = None
    doctors: List[Doctor]
