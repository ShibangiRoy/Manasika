"""Convert Manasika Companion response CSV exports into the runtime JSON corpus."""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path


APP_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE_DIR = APP_ROOT.parents[2] / "AI_companion_training_mndataset"
DEFAULT_OUTPUT = APP_ROOT / "training" / "datasets" / "ai_companion_training_mndataset.json"
INSTRUCTION_ENDINGS = (
    "Please respond with warmth, respect my pace, and offer one manageable next step.",
    "Offer a brief, encouraging exchange with a choice or follow-up question.",
)
URGENT = re.compile(
    r"\b(suicid(?:e|al)|kill myself|end my life|want to die|don't want to live|do not want to live|"
    r"self[- ]harm|hurt myself|harm myself|overdose|can't keep myself safe|cannot keep myself safe|"
    r"not safe with myself|unsafe in my own thoughts|struggling to keep myself safe|"
    r"keep myself safe right now|immediate danger|urgent mental[- ]health help|kill someone|hurt someone)\b",
    re.I,
)
CRISIS_RESPONSE = re.compile(
    r"\b(real[- ]time support|may hurt yourself|hurt someone else|cannot stay safe|can't stay safe|"
    r"local emergency services|emergency department|crisis line|immediate danger|safeguarding lead|"
    r"safety is at risk|urgent support|emergency or crisis support)\b",
    re.I,
)
UNSAFE_RESPONSE = re.compile(
    r"\b(dosage|prescribe|prescription|stop taking|start taking|diagnos(?:e|is)|"
    r"suicide method|ways to kill|how to hurt yourself)\b",
    re.I,
)


def normalize_scenario(context: str) -> tuple[str, str]:
    context = re.sub(r"\s+", " ", context).strip()
    if " — " in context:
        topic, scenario = context.split(" — ", 1)
    elif " – " in context:
        topic, scenario = context.split(" – ", 1)
    else:
        raise ValueError(f"Could not split the topic from its scenario: {context[:100]!r}")

    for ending in INSTRUCTION_ENDINGS:
        if scenario.endswith(ending):
            scenario = scenario[: -len(ending)].rstrip()
            break
    else:
        raise ValueError(f"Unrecognized prompt template ending: {context[-140:]!r}")

    if topic.strip().casefold() == "manasika interactive check-in":
        topic = ""
    if not scenario:
        raise ValueError("A source row has an empty normalized user scenario.")
    return topic.strip(), scenario


def read_sources(source_dir: Path) -> tuple[list[dict], list[str]]:
    source_files = sorted(source_dir.glob("*.csv"))
    if not source_files:
        raise FileNotFoundError(f"No CSV exports were found in {source_dir}.")

    rows: list[dict] = []
    topic_by_scenario: dict[str, str] = {}
    unresolved: list[tuple[dict, str, str]] = []
    for source in source_files:
        with source.open("r", encoding="utf-8-sig", newline="") as stream:
            reader = csv.DictReader(stream)
            headers = {name.strip().casefold() for name in (reader.fieldnames or [])}
            required = {"user_question_context", "creative_response"}
            if not required.issubset(headers):
                raise ValueError(f"{source.name} must contain columns {sorted(required)}.")
            field_map = {name.strip().casefold(): name for name in (reader.fieldnames or [])}
            for row_number, row in enumerate(reader, start=2):
                context = (row.get(field_map["user_question_context"]) or "").strip()
                completion = (row.get(field_map["creative_response"]) or "").strip()
                if not context or not completion:
                    raise ValueError(f"Blank prompt or response in {source.name}, row {row_number}.")
                topic, scenario = normalize_scenario(context)
                style_exclusion = ""
                if topic.casefold() in {"panic and intense distress", "safety and supportive planning"}:
                    style_exclusion = "crisis-support category stays on fixed safety path"
                elif URGENT.search(context):
                    style_exclusion = "urgent-risk prompt"
                elif URGENT.search(completion) or CRISIS_RESPONSE.search(completion):
                    style_exclusion = "crisis or immediate-safety response"
                elif UNSAFE_RESPONSE.search(completion):
                    style_exclusion = "unsafe clinical advice"
                item = {
                    "id": f"{source.stem}:{row_number}",
                    "topic": topic,
                    "prompt": scenario,
                    "completion": completion,
                    "source_context": context,
                    "source_file": source.name,
                    "source_row": row_number,
                    "style_eligible": not style_exclusion,
                    "style_exclusion_reason": style_exclusion,
                }
                if topic:
                    topic_by_scenario[scenario.casefold()] = topic
                    rows.append(item)
                else:
                    unresolved.append((item, source.name, context))

    for item, _source_name, _context in unresolved:
        item["topic"] = topic_by_scenario.get(item["prompt"].casefold(), "General wellbeing check-in")
        rows.append(item)
    if not rows:
        raise ValueError("No usable Companion response examples were found.")
    return rows, [source.name for source in source_files]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE_DIR)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    rows, sources = read_sources(args.source_dir.resolve())
    eligible = sum(row["style_eligible"] for row in rows)
    payload = {
        "version": 1,
        "dataset_key": "ai_companion_training_mndataset",
        "title": "Manasika AI Companion response examples",
        "source_format": "CSV export (Excel-compatible)",
        "source_license": "Not specified in the supplied files",
        "source_files": sources,
        "style_guidance": [
            "Respond warmly and without judgment.",
            "Answer the user's actual message directly and keep the response concise.",
            "Offer one manageable, practical next step when useful.",
            "Encourage without minimizing distress or forcing cheerfulness.",
            "Do not add a follow-up question; keep urgent-risk handling on the fixed safety path.",
        ],
        "record_count": len(rows),
        "style_eligible_count": eligible,
        "records": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output.resolve()), "records": len(rows), "style_eligible": eligible}, indent=2))


if __name__ == "__main__":
    main()
