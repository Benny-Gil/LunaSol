import json
import re

def extract_recommendations(full_text: str, doctors: list) -> list:
    # 1. Delimiter split
    if "[RECOMMENDATIONS]" in full_text:
        try:
            json_part = full_text.split("[RECOMMENDATIONS]")[1].strip()
            # Remove markdown JSON code blocks if present
            json_part = re.sub(r'^```json\s*', '', json_part, flags=re.IGNORECASE)
            json_part = re.sub(r'\s*```$', '', json_part)
            data = json.loads(json_part.strip())
            if isinstance(data, list):
                return [{"id": str(item["id"]), "reason": str(item.get("reason", ""))} for item in data]
        except Exception:
            pass

    # 2. Regex fallback to find any JSON-like list in the text
    match = re.search(r'\[\s*\{.*\}\s*\]', full_text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(0))
            if isinstance(data, list):
                return [{"id": str(item["id"]), "reason": str(item.get("reason", ""))} for item in data]
        except Exception:
            pass

    # 3. Direct matching keyword search fallback
    recommendations = []
    for doc in doctors:
        doc_id = doc.id if hasattr(doc, "id") else doc.get("id", "")
        doc_name = doc.name if hasattr(doc, "name") else doc.get("name", "")
        doc_spec = doc.specialization if hasattr(doc, "specialization") else doc.get("specialization", "")
        
        if not doc_id:
            continue
            
        # Match if the doctor ID, name, or specialization is mentioned in the text
        if (str(doc_id) in full_text or 
            (doc_name and doc_name.lower() in full_text.lower()) or 
            (doc_spec and doc_spec.lower() in full_text.lower())):
            recommendations.append({
                "id": str(doc_id),
                "reason": f"Recommended based on symptoms indicating matching specialization: {doc_spec}."
            })
            
    return recommendations
