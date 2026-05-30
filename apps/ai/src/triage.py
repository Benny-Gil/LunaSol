import asyncio
import json
import logging
from typing import List
from src.schemas import ChatMessage, Doctor
from src.utils import extract_recommendations

logger = logging.getLogger("lunasol.ai")

async def mock_recommendation_stream(messages: List[ChatMessage], doctors: List[Doctor]):
    try:
        user_texts = [msg.content for msg in messages if msg.role == "user"]
        symptoms = " ".join(user_texts)

        # Pre-check for emergency query in mock mode
        emergency_keywords = ["chest pain", "heart attack", "stroke", "cannot breathe", "heavy breathing", "suicide", "kill myself"]
        is_emergency = any(kw in symptoms.lower() for kw in emergency_keywords)
        
        reasoning_text = ""
        if is_emergency:
            warning = "⚠️ EMERGENCY NOTICE: If you are experiencing severe, life-threatening symptoms, please call emergency services (like 911) or visit the nearest emergency room immediately.\n\n"
            yield f"event: reasoning\ndata: {warning}\n\n"
            reasoning_text += warning
            await asyncio.sleep(0.5)

        # Check if the query is vague/doesn't have key match terms
        has_keywords = any(kw in symptoms.lower() for kw in ["headache", "chest", "skin"])
        if not has_keywords:
            question = "Could you please describe your symptoms in more detail (for example, their location, duration, or any other related issues) so that MedGemma can recommend the most appropriate specialist?"
            yield f"event: reasoning\ndata: {question}\n\n"
            yield "event: done\ndata: [DONE]\n\n"
            return

        intro = f"Analyzing symptoms: '{symptoms}'. Mapping symptoms to appropriate medical specializations...\n\n"
        yield f"event: reasoning\ndata: {intro}\n\n"
        reasoning_text += intro
        await asyncio.sleep(0.5)

        body = "Based on the symptom description, we are reviewing availability of specializations.\n"
        yield f"event: reasoning\ndata: {body}\n\n"
        reasoning_text += body
        await asyncio.sleep(0.5)

        # Match mock recommendations
        recommendations = []
        for doc in doctors:
            matched = False
            reason = ""
            if "headache" in symptoms.lower() and doc.specialization.lower() in ["neurology", "general medicine"]:
                matched = True
                reason = f"Dr. {doc.name} specializes in {doc.specialization}, which is highly relevant for evaluating persistent headaches."
            elif "chest" in symptoms.lower() and doc.specialization.lower() in ["cardiology", "family medicine"]:
                matched = True
                reason = f"Dr. {doc.name} is in {doc.specialization}. Immediate cardiology evaluation is recommended for chest pain."
            elif "skin" in symptoms.lower() and doc.specialization.lower() == "dermatology":
                matched = True
                reason = f"Dr. {doc.name} specializes in Dermatology, matching your skin concerns."
            
            # Default to general medicine if no matches
            if not matched and doc.specialization.lower() in ["general medicine", "family medicine"]:
                matched = True
                reason = f"Recommended a general consultation with Dr. {doc.name} ({doc.specialization}) as an initial step."

            if matched:
                recommendations.append({"id": doc.id, "reason": reason})
                rec_text = f"- Recommended: Dr. {doc.name} ({doc.specialization}) - {reason}\n"
                yield f"event: reasoning\ndata: {rec_text}\n\n"
                reasoning_text += rec_text
                await asyncio.sleep(0.5)

        # Add quick remedies section (mock mode comfort suggestions)
        remedy_intro = "\nGeneral Comfort Guidelines (Informational & Non-Prescriptive):\n"
        yield f"event: reasoning\ndata: {remedy_intro}\n\n"
        reasoning_text += remedy_intro
        await asyncio.sleep(0.3)

        remedies = []
        if "headache" in symptoms.lower():
            remedies = [
                "- Rest in a quiet, dark room to minimize light and sound sensitivity.\n",
                "- Ensure adequate hydration by drinking water or electrolyte solutions.\n",
                "- Apply a cold or warm compress to your forehead or temples for comfort.\n"
            ]
        elif "chest" in symptoms.lower():
            remedies = [
                "- Sit upright in a comfortable position and focus on steady breathing.\n",
                "- Avoid any physical exertion or high-stress environments.\n",
                "- Seek emergency medical evaluation immediately. Do not delay consultation.\n"
            ]
        elif "skin" in symptoms.lower():
            remedies = [
                "- Avoid scratching, rubbing, or picking at the affected skin areas.\n",
                "- Wash the area gently with lukewarm water and mild, fragrance-free soap.\n",
                "- Apply a cool, damp compress to soothe irritation and itchiness.\n"
            ]
        else:
            remedies = [
                "- Prioritize rest and sleep to allow your body's immune system to function optimally.\n",
                "- Maintain a steady intake of water, herbal teas, or clear broths.\n",
                "- Monitor your temperature and symptoms, noting changes to discuss with your doctor.\n"
            ]

        for rem in remedies:
            yield f"event: reasoning\ndata: {rem}\n\n"
            reasoning_text += rem
            await asyncio.sleep(0.3)

        safety_note = "\n⚠️ DISCLAIMER: These comfort suggestions are not medical treatments or prescriptions. Please consult your matched physician to get a personalized medical plan.\n\n"
        yield f"event: reasoning\ndata: {safety_note}\n\n"
        reasoning_text += safety_note
        await asyncio.sleep(0.3)

        # Emit delimiter
        yield "event: reasoning\ndata: \n\n[RECOMMENDATIONS]\n\n"
        await asyncio.sleep(0.1)
        
        # Emit structured data
        yield f"event: recommendations\ndata: {json.dumps(recommendations)}\n\n"
        yield "event: done\ndata: [DONE]\n\n"
    except Exception:
        logger.exception("recommendation stream failed")
        yield "event: error\ndata: The recommendation service hit an error. Please try again.\n\n"

async def real_recommendation_stream(messages: List[ChatMessage], doctors: List[Doctor], model):
    try:
        doctors_list_str = "\n".join([
            f"- ID: {doc.id}, Name: {doc.name}, Specialization: {doc.specialization}"
            for doc in doctors
        ])
        
        system_content = (
            "You are a medical triage assistant for a telehealth platform. Given a patient's symptoms "
            "and a list of available doctors, recommend the most relevant doctors.\n\n"
            "CRITICAL SAFETY RULE: You are NOT a doctor. You must NOT diagnose illnesses, prescribe "
            "medications, or suggest specific medical treatments. Your role is strictly to map the "
            "patient's symptoms to the most relevant doctor specialization (e.g. Cardiology for chest pain, "
            "Dermatology for skin issues), explain why that specialization is appropriate, and offer "
            "basic, safe, non-prescriptive self-care comfort suggestions.\n\n"
            "SELF-CARE REMEDIES: You may suggest general, conservative, and low-risk self-care comfort guidelines "
            "(such as rest, hydration, cool/warm compresses, or avoiding triggers). You MUST include a disclaimer "
            "stating that these suggestions do not constitute a medical plan or replace a doctor's diagnosis, and "
            "that the patient should consult their matched physician before trying them.\n\n"
            "EMERGENCY PROTOCOL: If the symptoms described indicate an acute, life-threatening emergency "
            "(e.g., severe chest pain, sudden numbness, difficulty breathing, heavy bleeding), you MUST "
            "begin your response with a prominent warning: '⚠️ EMERGENCY NOTICE: If you are experiencing "
            "life-threatening symptoms, please call emergency services (like 911) or go to the nearest "
            "emergency room immediately.'\n\n"
            "For each recommended doctor, provide their ID and a brief, professional reason (1-2 sentences) "
            "explaining why their specialization matches the symptoms. Be supportive and helpful.\n\n"
            "If no doctors are a strong match for the symptoms, recommend general practitioners (General Medicine or Family Medicine) "
            "and explain that a general consultation is the best starting point.\n\n"
            "CONVERSATIONAL FLOW: You are in a multi-turn chat with the patient. "
            "If the patient's symptoms are unclear, incomplete, or need more detail to recommend a doctor specialization, "
            "ask one or two friendly, brief clarifying questions to get more information from the patient. "
            "In this case, do NOT output '[RECOMMENDATIONS]' or the JSON array. "
            "Only output '[RECOMMENDATIONS]' and the JSON array at the very end of your response when you have enough details "
            "to confidently map their symptoms to specific doctors.\n\n"
            "At the end of your response, output the exact word '[RECOMMENDATIONS]' on its own line, "
            "followed by a JSON array containing only the recommended doctors' IDs and reasons in this format:\n"
            '[{"id": "doctor_id", "reason": "short explanation"}]\n\n'
            "Do not include any other text after the JSON array."
        )
        
        system_content_with_docs = system_content + f"\n\nAvailable Doctors:\n{doctors_list_str}"
        
        formatted_messages = [
            {"role": "system", "content": system_content_with_docs}
        ]
        for msg in messages:
            formatted_messages.append({"role": msg.role, "content": msg.content})
            
        response = model.create_chat_completion(
            messages=formatted_messages,
            stream=True,
            temperature=0.4,
            max_tokens=512,
            top_p=0.9
        )
        
        full_text = ""
        reasoning_buffer = ""
        json_buffer = ""
        in_json_mode = False
        delimiter = "[RECOMMENDATIONS]"
        
        for chunk in response:
            delta = chunk["choices"][0]["delta"]
            if "content" not in delta:
                continue
            content = delta["content"]
            full_text += content
            
            if not in_json_mode:
                reasoning_buffer += content
                if delimiter in reasoning_buffer:
                    parts = reasoning_buffer.split(delimiter)
                    reasoning_part = parts[0]
                    json_part = parts[1] if len(parts) > 1 else ""
                    
                    if reasoning_part.strip():
                        yield f"event: reasoning\ndata: {reasoning_part}\n\n"
                    
                    in_json_mode = True
                    json_buffer = json_part
                else:
                    yield f"event: reasoning\ndata: {content}\n\n"
            else:
                json_buffer += content
                
        # Only parse recommendations if the delimiter is present
        if delimiter in full_text:
            recommendations = extract_recommendations(full_text, doctors)
            yield f"event: recommendations\ndata: {json.dumps(recommendations)}\n\n"
        
        yield "event: done\ndata: [DONE]\n\n"
        
    except Exception:
        logger.exception("recommendation stream failed")
        yield "event: error\ndata: The recommendation service hit an error. Please try again.\n\n"
