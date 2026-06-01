import asyncio
import json
import logging
import re
from typing import List
from src.schemas import ChatMessage, Doctor
from src.utils import extract_recommendations

logger = logging.getLogger("lunasol.ai")


# Hard cap on the streamed reasoning ("thought") block. The small local model
# ignores prompt-level brevity limits and will write a multi-thousand-character
# differential that exhausts the token budget before reaching the reply. Once
# the thought reaches this many characters we force the transition to the reply
# phase server-side, independent of whether the model emitted [REPLY].
THOUGHT_CHAR_CAP = 600

# Leading marker the model sometimes emits before its reasoning ('thought',
# '**Thought:**', 'thought\n', etc.). Stripped from the start of the thought
# block so the panel shows reasoning, not the literal marker word.
_THOUGHT_PREFIX_RE = re.compile(r'^[\s>`*#_-]*["\']?\s*thought\b\s*["\']?\s*[:\n]?', re.IGNORECASE)


def _sse(event: str, data) -> str:
    """Encode an SSE event with a JSON-serialized payload.

    JSON-encoding guarantees the payload never contains a raw newline. A raw
    newline would otherwise break SSE framing (a blank line terminates the
    event), causing paragraph breaks to be dropped and text after them to be
    truncated downstream. The API controller JSON-parses the payload back into
    a string, restoring the real newlines for the browser.
    """
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _find_line_marker(text: str, marker: str, preceding_char: str = "\n"):
    """Find `marker` only when it sits on its own line.

    Returns (cut, end) where `text[:cut]` is the content before the marker and
    `text[end:]` is the content after it, or (-1, -1) if not found line-anchored.
    `preceding_char` is the character right before text[0] in the wider stream
    (the buffer may have had its prefix already streamed away), so a marker at
    text[0] is only line-anchored if that preceding char was a newline.

    The model is instructed to put markers like [REPLY] on their own line, but
    it sometimes *narrates* them mid-sentence ("...then I output the [REPLY]
    marker..."). Matching only line-anchored occurrences prevents such a mention
    from being mistaken for the real delimiter and leaking planning text.
    """
    start = 0
    while True:
        i = text.find(marker, start)
        if i == -1:
            return -1, -1
        # The char before the marker, ignoring trailing inline whitespace on
        # the line. Use preceding_char when the marker is at/near text start.
        before = text[:i].rstrip(" \t")
        prev = before[-1] if before else preceding_char
        if prev == "\n":
            return len(before.rstrip("\n")), i + len(marker)
        start = i + 1


def _safe_emit_len(text: str, delimiter: str) -> int:
    """Length of `text` safe to stream without leaking a partial delimiter.

    Returns the cut point such that `text[:cut]` cannot contain the start of a
    forthcoming `delimiter`. Any trailing run that matches a prefix of the
    delimiter is held back, so we never stream "[RECOMMEND..." to the client
    only to discover the marker a few tokens later.
    """
    max_keep = min(len(text), len(delimiter) - 1)
    for keep in range(max_keep, 0, -1):
        if text.endswith(delimiter[:keep]):
            return len(text) - keep
    return len(text)


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
            yield _sse("reasoning", warning)
            reasoning_text += warning
            await asyncio.sleep(0.5)

        # Check if the query is vague/doesn't have key match terms
        has_keywords = any(kw in symptoms.lower() for kw in ["headache", "chest", "skin"])
        if not has_keywords:
            question = "Could you please describe your symptoms in more detail (for example, their location, duration, or any other related issues) so that MedGemma can recommend the most appropriate specialist?"
            yield _sse("reasoning", question)
            yield _sse("done", "[DONE]")
            return

        intro = f"Analyzing symptoms: '{symptoms}'. Mapping symptoms to appropriate medical specializations...\n\n"
        yield _sse("reasoning", intro)
        reasoning_text += intro
        await asyncio.sleep(0.5)

        body = "Based on the symptom description, we are reviewing availability of specializations.\n"
        yield _sse("reasoning", body)
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
                yield _sse("reasoning", rec_text)
                reasoning_text += rec_text
                await asyncio.sleep(0.5)

        # Add quick remedies section (mock mode comfort suggestions)
        remedy_intro = "\nGeneral Comfort Guidelines (Informational & Non-Prescriptive):\n"
        yield _sse("reasoning", remedy_intro)
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
            yield _sse("reasoning", rem)
            reasoning_text += rem
            await asyncio.sleep(0.3)

        safety_note = "\n⚠️ DISCLAIMER: These comfort suggestions are not medical treatments or prescriptions. Please consult your matched physician to get a personalized medical plan.\n\n"
        yield _sse("reasoning", safety_note)
        reasoning_text += safety_note
        await asyncio.sleep(0.3)

        # Emit structured data. The delimiter is an internal protocol marker
        # between the model and the parser; it is never streamed to the client.
        # Pass the raw list: _sse JSON-encodes exactly once so the controller
        # parses each data line back into a single value (here, an array).
        yield _sse("recommendations", recommendations)
        yield _sse("done", "[DONE]")
    except Exception:
        # Log the real cause server-side; emit only a generic error to the client.
        logger.exception("recommendation stream failed")
        yield _sse("error", "The recommendation service hit an error. Please try again.")

async def real_recommendation_stream(messages: List[ChatMessage], doctors: List[Doctor], model):
    try:
        doctors_list_str = "\n".join([
            f"- ID: {doc.id}, Name: {doc.name}, Specialization: {doc.specialization}"
            for doc in doctors
        ])

        # Turn-aware policy: on the FIRST patient turn, recommend a doctor right
        # away if the symptoms are mappable at all (defaulting to a generalist
        # when unsure); only on LATER turns do we ask clarifying questions to
        # refine. Counting user messages in code is reliable; the model is bad
        # at tracking turn number itself.
        user_turns = sum(1 for m in messages if m.role == "user")
        is_first_turn = user_turns <= 1

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
            "CONVERSATIONAL FLOW: You are in a multi-turn chat with the patient.\n"
            + (
                "THIS IS THE PATIENT'S FIRST MESSAGE. Your priority now is to recommend a doctor right "
                "away if the symptoms can be mapped to a specialization at all — even loosely. Pick the "
                "best-matching available doctor (defaulting to a General Medicine or Family Medicine "
                "doctor when the symptoms are broad or unclear). Do NOT ask a clarifying question on this "
                "first turn; make a recommendation and include the [RECOMMENDATIONS] JSON.\n\n"
                if is_first_turn else
                "THIS IS A FOLLOW-UP MESSAGE. A recommendation was likely already made earlier. Now ask "
                "one or two friendly, brief clarifying questions to refine the match (e.g. duration, "
                "severity, other symptoms). Only output [RECOMMENDATIONS] and the JSON array if the new "
                "detail lets you confidently refine or change the recommended doctor; otherwise omit it.\n\n"
            )
            + "OUTPUT FORMAT — structure your entire response in this exact order. Be concise; you have a "
            "limited length budget and MUST reach the [REPLY] and [RECOMMENDATIONS] sections.\n"
            "1. REASONING: First, briefly think through the symptoms and which specialization fits. "
            "STRICT LIMIT: at most 3 short sentences (about 60 words). Do NOT list every doctor, do NOT "
            "write a long differential, do NOT restate these instructions. This is shown as a small "
            "collapsible 'thinking' note.\n"
            "2. Then output the marker [REPLY] on its own line. You MUST reach this marker quickly.\n"
            "3. REPLY: After [REPLY], write the polished patient-facing answer (2–4 short sentences) — "
            "warm, clear, and free of any meta-commentary or analysis. When you recommend a doctor, state "
            "the doctor's name in this reply (e.g. 'I'd suggest booking with Dr. Jane Smith, a "
            "Cardiologist.') so the patient sees who they are being matched with.\n"
            "4. Then output the exact word [RECOMMENDATIONS] on its own line, followed by a JSON array "
            "containing only the recommended doctors' IDs and reasons in this format:\n"
            '[{"id": "doctor_id", "reason": "short explanation"}]\n'
            "Do not include any other text after the JSON array.\n\n"
            "Always include the [REPLY] marker, and include [RECOMMENDATIONS] whenever you have enough "
            "detail to recommend doctors. If you are only asking a clarifying question, keep the reasoning "
            "to one sentence, then [REPLY], then the question, and omit [RECOMMENDATIONS]."
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
            # Room for: brief reasoning (thought) + [REPLY] + patient answer +
            # [RECOMMENDATIONS] + JSON. 512 was exhausted by reasoning alone once
            # the model was asked to think out loud, so the reply/JSON never
            # arrived; 1024 leaves headroom for all four sections.
            max_tokens=1024,
            top_p=0.9
        )
        
        full_text = ""
        delimiter = "[RECOMMENDATIONS]"   # internal: marks start of JSON payload
        reply_marker = "[REPLY]"          # internal: separates reasoning from reply

        # Streaming state machine. The model is instructed to write its reasoning
        # first, then a [REPLY] marker, then the patient-facing answer, then
        # [RECOMMENDATIONS] + JSON. We stream the reasoning as "thought" events
        # (the UI shows these live in a thinking panel, then collapses them) and
        # the answer as "reasoning" events. `buf` is a hold-back buffer: we only
        # stream the part that cannot be the start of a forthcoming marker, so no
        # partial marker ([REP…, [REC…) ever leaks to the client.
        #   thought -> reasoning prose, until [REPLY] (or the JSON delimiter)
        #   reply   -> patient-facing answer, until the JSON delimiter
        phase = "thought"
        buf = ""
        in_json_mode = False
        streamed_reply = False
        thought_chars = 0               # how much thought we have streamed
        thought_prefix_stripped = False  # leading 'thought' marker removed yet?
        # Character immediately before buf[0] in the (already consumed) stream.
        # Starts as "\n" since the stream begins at a line start. Used so the
        # line-anchored [REPLY] check stays correct even after we drop the
        # buffer prefix during hold-back streaming.
        preceding_char = "\n"

        for chunk in response:
            delta = chunk["choices"][0]["delta"]
            if "content" not in delta:
                continue
            content = delta["content"]
            full_text += content

            if in_json_mode:
                # Reply is done; remaining tokens are the JSON payload, parsed
                # in bulk from full_text after the stream completes.
                continue

            buf += content

            if phase == "thought":
                # Strip the leading 'thought' marker word once, before emitting.
                # Hold back (emit nothing) while the buffer is still a possible
                # prefix of the marker, so we never stream a bare 'tho'/'thought'
                # before deciding. The marker is short, so this delays at most a
                # few characters.
                if not thought_prefix_stripped:
                    head = buf.lstrip(' \t\r\n>`*#_-"\'')
                    if len(buf) < len("thought") + 2 and "thought".startswith(head[:7].lower()):
                        continue  # wait for more tokens before deciding
                    buf = _THOUGHT_PREFIX_RE.sub("", buf, count=1).lstrip()
                    thought_prefix_stripped = True

                ri, rend = _find_line_marker(buf, reply_marker, preceding_char)
                if ri != -1:
                    # Everything before [REPLY] is reasoning; emit it, drop the
                    # marker, and switch to streaming the patient reply.
                    thought_part = buf[:ri]
                    if thought_part.strip():
                        yield _sse("thought", thought_part)
                    buf = buf[rend:].lstrip()
                    phase = "reply"
                    # fall through to reply handling this same iteration
                elif delimiter in buf:
                    # Reached the JSON payload without a [REPLY] marker: the
                    # model never separated out a reply. Emit what we have as
                    # thought; the safety net below supplies a reply.
                    thought_part = buf[:buf.find(delimiter)]
                    if thought_part.strip():
                        yield _sse("thought", thought_part)
                    buf = ""
                    in_json_mode = True
                    continue
                else:
                    # Compute the portion that cannot begin [REPLY] or the
                    # delimiter; hold back the tail in case a marker is forming.
                    safe = min(_safe_emit_len(buf, reply_marker),
                               _safe_emit_len(buf, delimiter))
                    if safe > 0:
                        # HARD CAP: stop *showing* thought once it gets long. The
                        # model still generates its full ramble, but we bound the
                        # panel and keep scanning for the real [REPLY]/delimiter
                        # so the patient still gets a genuine reply when it comes
                        # (and the safety net otherwise).
                        if thought_chars < THOUGHT_CHAR_CAP:
                            room = THOUGHT_CHAR_CAP - thought_chars
                            emit = buf[:min(safe, room)]
                            if emit:
                                yield _sse("thought", emit)
                                thought_chars += len(emit)
                                if thought_chars >= THOUGHT_CHAR_CAP:
                                    yield _sse("thought", " …")
                        # Track the char preceding the new buf[0] so line-anchor
                        # detection stays correct after dropping this prefix.
                        preceding_char = buf[safe - 1]
                        buf = buf[safe:]
                    continue

            if phase == "reply":
                # Suppress leading whitespace at the very start of the reply
                # (e.g. a stray newline after the [REPLY] marker). Once real text
                # has streamed we stop trimming, preserving paragraph breaks.
                if not streamed_reply:
                    buf = buf.lstrip()
                idx = buf.find(delimiter)
                if idx != -1:
                    reply_part = buf[:idx]
                    if reply_part:
                        yield _sse("reasoning", reply_part)
                        streamed_reply = True
                    buf = ""
                    in_json_mode = True
                    continue
                cut = _safe_emit_len(buf, delimiter)
                if cut > 0:
                    yield _sse("reasoning", buf[:cut])
                    streamed_reply = True
                    buf = buf[cut:]

        # Flush any held-back tail from the reply phase (e.g. the response ended
        # with a literal "[REC" that never became the delimiter).
        if not in_json_mode and phase == "reply" and buf:
            yield _sse("reasoning", buf)
            streamed_reply = True

        # Safety net: if there is no patient-facing reply (model only reasoned,
        # or never emitted [REPLY]), emit a safe, non-diagnostic message so the
        # patient never sees an empty bubble. The message is turn-aware: on the
        # first turn we point to the recommended doctors; on follow-up turns the
        # intent is to refine, so we ask a clarifying question instead.
        if not streamed_reply:
            if is_first_turn:
                fallback = (
                    "Based on your symptoms, here are the most relevant doctors to "
                    "consider. Please consult one of them for a proper evaluation.\n\n"
                )
            else:
                fallback = (
                    "Thanks for the extra detail. To help refine the best match, could you tell me a "
                    "bit more — such as how long this has been going on, how severe it is, and whether "
                    "you have any other symptoms?\n\n"
                )
            yield _sse("reasoning", fallback)

        # Only parse recommendations if the delimiter is present
        if delimiter in full_text:
            recommendations = extract_recommendations(full_text, doctors)
            yield _sse("recommendations", recommendations)

        yield _sse("done", "[DONE]")

    except Exception:
        # Log the real cause server-side; emit only a generic error to the client.
        logger.exception("recommendation stream failed")
        yield _sse("error", "The recommendation service hit an error. Please try again.")
