"""Prepare private, response-only fine-tuning examples from Companion assets."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
from pathlib import Path


APP_ROOT = Path(__file__).resolve().parents[1]
SYSTEM_PROMPT = (
    "You are Manasika, a warm, concise, grounded wellbeing companion. Answer the user's actual request directly. "
    "Acknowledge feelings without judgment or forced cheer, and offer one manageable next step when useful. "
    "Do not add follow-up questions. Use supplied memory when relevant and do not invent source facts. "
    "You are not a clinician: do not diagnose or recommend medication. Encourage qualified professional help "
    "for clinical concerns. For imminent danger, direct the person to local emergency services and a trusted person."
)
TOPIC = re.compile(r"\b(mental health|mental illness|anxiety|anxious|depress(?:ed|ion|ive)?|trauma|suicid|self[- ]harm|eating disorder|panic attack|grief|loneliness|lonely|therapy|therapist|coping|emotion(?:al)?|hopelessness|burnout)\b", re.I)
REQUEST = re.compile(r"\b(i am|i'm|i've|i have|my |we |our |how can i|what can i do|i feel|i'm feeling|i want to|i need help)\b", re.I)
EXCLUDE = re.compile(r"\b(SEC|short[- ]selling|great depression|clinical case|diagnos(?:e|is|tic)|prescrib|medication|dosage|medical consultant|medical professional|act as (?:a|an) (?:doctor|expert|consultant)|research paper|legal implications)\b", re.I)
UNSAFE_RESPONSE = re.compile(r"\b(dosage|prescribe|prescription|stop taking|start taking|you have (?:bipolar|depression)|you are (?:bipolar|depressed)|diagnos(?:e|is)|suicide method|ways to kill|how to hurt yourself)\b", re.I)
URGENT = re.compile(r"\b(suicid(?:e|al)|kill myself|end my life|want to die|don't want to live|do not want to live|self[- ]harm|hurt myself|harm myself|overdose|can't keep myself safe|cannot keep myself safe|not safe with myself|unsafe in my own thoughts|struggling to keep myself safe|keep myself safe right now|immediate danger|urgent mental[- ]health help|kill someone|hurt someone)\b", re.I)
CRISIS_RESPONSE = re.compile(r"\b(real[- ]time support|may hurt yourself|hurt someone else|cannot stay safe|can't stay safe|local emergency services|emergency department|crisis line|immediate danger|safeguarding lead|safety is at risk|urgent support|emergency or crisis support)\b", re.I)


def records(path: Path):
    opener = gzip.open if path.suffix == ".gz" else open
    decoder = json.JSONDecoder()
    with opener(path, "rt", encoding="utf-8") as stream:
        buffer = ""
        started = False
        eof = False
        while True:
            if not eof:
                block = stream.read(64 * 1024)
                eof = not block
                buffer += block
            position = 0
            if not started:
                opening = buffer.find("[")
                if opening < 0:
                    if eof:
                        raise ValueError(f"Expected a JSON array in {path}.")
                    buffer = buffer[-1:]
                    continue
                started = True
                position = opening + 1
            while True:
                while position < len(buffer) and (buffer[position].isspace() or buffer[position] == ","):
                    position += 1
                if position < len(buffer) and buffer[position] == "]":
                    return
                if position >= len(buffer):
                    break
                try:
                    item, end = decoder.raw_decode(buffer, position)
                except json.JSONDecodeError:
                    if eof:
                        raise
                    break
                position = end
                yield item
            buffer = buffer[position:]
            if eof:
                if buffer.strip():
                    raise ValueError(f"Unterminated JSON array in {path}.")
                return


def clean_answer(text: str) -> str:
    sentences = re.split(r"(?<=[.!?])\s+", re.sub(r"\s+", " ", text).strip())
    return " ".join(sentence for sentence in sentences if sentence and "?" not in sentence)[:4000].strip()


def training_row(user: str, answer: str) -> dict:
    return {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user.strip()},
            {"role": "assistant", "content": answer.strip()},
        ]
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--app-root", type=Path, default=APP_ROOT)
    parser.add_argument("--output", type=Path, default=APP_ROOT / "training" / "data" / "companion.jsonl")
    args = parser.parse_args()
    root = args.app_root.resolve()
    support_files = [
        root / "public" / "data" / "mental_health_support_chat.json",
        root / "public" / "data" / "datasets" / "ai_companion" / "mental_health_support_chat_augmented.json.gz",
    ]
    literature_file = root / "literature-data" / "public-domain-literature.json.gz"
    style_file = root / "training" / "datasets" / "ai_companion_training_mndataset.json"
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    seen = set()
    counts = {"support": 0, "curated_wellbeing": 0, "companion_response_style": 0, "literature": 0, "rejected": 0}
    with output.open("w", encoding="utf-8", newline="\n") as destination:
        for source in support_files:
            if not source.exists():
                continue
            for item in records(source):
                prompt = str(item.get("enhanced_prompt", "")).strip()
                answer = clean_answer(str(item.get("enhanced_completion", "")))
                if not prompt or not answer or len(prompt) > 12000 or len(answer) > 4000:
                    counts["rejected"] += 1
                    continue
                if not TOPIC.search(prompt) or not REQUEST.search(prompt) or EXCLUDE.search(prompt) or UNSAFE_RESPONSE.search(answer) or URGENT.search(prompt):
                    counts["rejected"] += 1
                    continue
                digest = hashlib.sha256((prompt.lower() + "\0" + answer.lower()).encode("utf-8")).hexdigest()
                if digest in seen:
                    continue
                seen.add(digest)
                destination.write(json.dumps(training_row(prompt, answer), ensure_ascii=False) + "\n")
                counts["support"] += 1

        curated_file = root / "public" / "data" / "datasets" / "ai_companion" / "companion_wellbeing_topics.json"
        if curated_file.exists():
            curated = json.loads(curated_file.read_text(encoding="utf-8"))
            for item in curated.get("records", []):
                prompt = str(item.get("prompt", "")).strip()
                answer = clean_answer(str(item.get("completion", "")))
                # Emergency and urgent clinical examples stay on fixed runtime safety paths.
                if item.get("safety_tier") not in {"general", "professional"}:
                    counts["rejected"] += 1
                    continue
                if not prompt or not answer or len(prompt) > 12000 or len(answer) > 4000 or UNSAFE_RESPONSE.search(answer):
                    counts["rejected"] += 1
                    continue
                topic = str(item.get("topic", "")).strip()
                if topic:
                    prompt = f"Topic: {topic}\n{prompt}"
                digest = hashlib.sha256((prompt.lower() + "\0" + answer.lower()).encode("utf-8")).hexdigest()
                if digest in seen:
                    continue
                seen.add(digest)
                destination.write(json.dumps(training_row(prompt, answer), ensure_ascii=False) + "\n")
                counts["curated_wellbeing"] += 1

        if style_file.exists():
            style_data = json.loads(style_file.read_text(encoding="utf-8"))
            if style_data.get("version") != 1 or style_data.get("dataset_key") != "ai_companion_training_mndataset" or not isinstance(style_data.get("records"), list):
                raise ValueError(f"Unsupported response-style dataset format in {style_file}.")
            for item in style_data["records"]:
                prompt = str(item.get("prompt", "")).strip()
                answer = clean_answer(str(item.get("completion", "")))
                if (item.get("style_eligible") is False or item.get("topic", "").strip().casefold() in {"panic and intense distress", "safety and supportive planning"}
                        or not prompt or not answer
                        or len(prompt) > 12000 or len(answer) > 4000
                        or UNSAFE_RESPONSE.search(answer) or URGENT.search(prompt) or URGENT.search(answer)
                        or CRISIS_RESPONSE.search(answer)):
                    counts["rejected"] += 1
                    continue
                topic = str(item.get("topic", "")).strip()
                if topic:
                    prompt = f"Topic: {topic}\n{prompt}"
                digest = hashlib.sha256((prompt.lower() + "\0" + answer.lower()).encode("utf-8")).hexdigest()
                if digest in seen:
                    continue
                seen.add(digest)
                destination.write(json.dumps(training_row(prompt, answer), ensure_ascii=False) + "\n")
                counts["companion_response_style"] += 1

        if literature_file.exists():
            for item in records(literature_file):
                content = re.sub(r"\s+", " ", str(item.get("content", ""))).strip()
                title = str(item.get("title", "")).strip()
                author = str(item.get("author", "")).strip()
                section = str(item.get("source_location", "")).strip()
                if len(content) < 400 or not title or not author:
                    counts["rejected"] += 1
                    continue
                # Passage-grounded examples teach the model to use its retrieved source context.
                prompt = f"Answer directly from this passage in {title} by {author} ({section}). Do not add a follow-up question.\n\n{content}"
                opening = [sentence.strip() for sentence in re.split(r"(?<=[.!?])\s+", content)
                           if sentence.strip() and "?" not in sentence]
                answer = f"In {title} by {author} ({section}), the passage describes: {' '.join(opening[:2])}"[:1800]
                digest = hashlib.sha256((prompt.lower() + "\0" + answer.lower()).encode("utf-8")).hexdigest()
                if digest in seen:
                    continue
                seen.add(digest)
                destination.write(json.dumps(training_row(prompt, answer), ensure_ascii=False) + "\n")
                counts["literature"] += 1

    total = counts["support"] + counts["curated_wellbeing"] + counts["companion_response_style"] + counts["literature"]
    if not total:
        output.unlink(missing_ok=True)
        raise SystemExit("No eligible examples were prepared; check that the datasets and literature corpus are present.")
    manifest = {"examples": counts, "total": total, "output": str(output), "private_user_content_included": False,
                "copyrighted_psychology_text_included": False}
    output.with_suffix(".manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
