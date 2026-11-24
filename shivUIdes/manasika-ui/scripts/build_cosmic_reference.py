"""Build compact, browser-ready astrology and tarot references from zodiac_db."""

from __future__ import annotations

import argparse
import json
import re
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any


APP_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = APP_ROOT.parents[2] / "zodiac_db"
OUTPUT_ROOT = APP_ROOT / "public" / "data" / "cosmic"
ZODIAC_SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
]
PLANETS = [
    "Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn",
    "Uranus", "Neptune", "Pluto", "Chiron", "Ceres", "North Node", "South Node",
]
ASPECTS = ["conjunction", "sextile", "square", "trine", "opposition", "quincunx", "semisextile", "semisquare"]
TAROT_FIELDS = {
    "card_name", "cards_involved", "category", "spread_name", "position", "reading_topic",
    "title", "traditional_symbolism", "upright_interpretation", "reversed_interpretation",
    "general_interpretation", "emotional_themes", "relationship_themes", "academic_career_themes",
    "growth_opportunities", "potential_challenges", "reflection_questions", "suggested_actions",
    "alternative_interpretations", "disclaimer",
}
ASTRO_FIELDS = {
    "id", "category", "planet", "celestial_body", "zodiac_sign", "house", "aspect", "pattern",
    "title", "name", "event", "phase", "astronomical_fact", "definition", "traditional_interpretation",
    "traditional_effect", "underlying_theme", "emotional_themes", "relationship_themes",
    "academic_career_themes", "growth_opportunities", "growth_themes", "potential_challenges",
    "positive_interpretation", "encouraging_message", "practical_action", "activities", "affirmation",
    "self_care_suggestions", "self_development_suggestions", "reflection_questions", "reflection_question",
    "journaling_prompts", "disclaimer",
}
MAJOR_ARCANA = [
    "The Fool", "The Magician", "The High Priestess", "The Empress", "The Emperor", "The Hierophant",
    "The Lovers", "The Chariot", "Strength", "The Hermit", "Wheel of Fortune", "Justice",
    "The Hanged Man", "Death", "Temperance", "The Devil", "The Tower", "The Star", "The Moon",
    "The Sun", "Judgement", "The World",
]
RANKS = ["Ace", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Page", "Knight", "Queen", "King"]
SUITS = ["Wands", "Cups", "Swords", "Pentacles"]
CANONICAL_CARDS = MAJOR_ARCANA + [f"{rank} of {suit}" for suit in SUITS for rank in RANKS]


def decode_completion(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, dict):
        return [value]
    if not isinstance(value, str):
        return []
    text = value.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.I)
    decoder = json.JSONDecoder()
    starts = [0]
    object_start = text.find("{")
    if object_start > 0:
        starts.append(object_start)
    for start in starts:
        try:
            parsed, _end = decoder.raw_decode(text, start)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            return [parsed]
        if isinstance(parsed, list):
            return [item for item in parsed if isinstance(item, dict)]
    return []


def rows_from_json(path: Path) -> list[dict[str, Any]]:
    if not path.exists() or path.stat().st_size == 0:
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, dict):
        payload = payload.get("records", payload.get("data", []))
    return payload if isinstance(payload, list) else []


def rows_from_zip(path: Path, inner_name: str) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    with zipfile.ZipFile(path) as archive:
        member = next((name for name in archive.namelist() if Path(name).name == inner_name), None)
        if not member:
            raise ValueError(f"{inner_name} was not found in {path.name}.")
        payload = json.loads(archive.read(member).decode("utf-8"))
    return payload if isinstance(payload, list) else []


def compact_record(record: dict[str, Any], fields: set[str], source: str, row: int) -> dict[str, Any]:
    compact = {key: value for key, value in record.items() if key in fields and value not in (None, "", [], {})}
    compact["source"] = source
    compact["source_row"] = row
    return compact


def index_terms(record: dict[str, Any], dataset: str) -> set[str]:
    terms: set[str] = {f"dataset:{dataset}"}
    for raw in [record.get("zodiac_sign")]:
        value = str(raw or "")
        for sign in ZODIAC_SIGNS:
            if re.search(rf"\b{re.escape(sign)}\b", value, re.I):
                terms.add(f"sign:{sign}")
    for raw in [record.get("planet"), record.get("celestial_body")]:
        value = str(raw or "")
        for planet in PLANETS:
            if re.search(rf"\b{re.escape(planet)}\b", value, re.I):
                terms.add(f"planet:{planet}")
    house = str(record.get("house") or "")
    match = re.search(r"\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:house)?\b", house, re.I)
    if match and 1 <= int(match.group(1)) <= 12:
        terms.add(f"house:{int(match.group(1))}")
    for raw in [record.get("aspect"), record.get("pattern")]:
        value = str(raw or "")
        for aspect in ASPECTS:
            if re.search(rf"\b{aspect}\b", value, re.I):
                terms.add(f"aspect:{aspect.title()}")
    category = str(record.get("category") or "").strip()
    if category:
        terms.add(f"category:{category[:54]}")
    for key in ("event", "phase"):
        value = str(record.get(key) or "").strip()
        if value:
            terms.add(f"event:{value[:58]}")
    for raw in (record.get("emotional_themes"), record.get("growth_opportunities"), record.get("personal_growth_themes"), record.get("underlying_theme")):
        value = str(raw or "").lower()
        for theme, pattern in {
            "change": r"change|transition|reset|transform",
            "boundaries": r"boundar|limit|space|protect",
            "communication": r"communicat|conversation|listen|express",
            "patience": r"patient|pace|steady|slow",
            "confidence": r"confiden|self-worth|courage|trust yourself",
            "rest": r"rest|recover|pause|renew",
            "connection": r"connect|relationship|belong|community",
            "growth": r"growth|learn|develop|practice",
        }.items():
            if re.search(pattern, value):
                terms.add(f"theme:{theme.title()}")
    # The Vedic karmic lore file is prompt/completion prose rather than
    # structured astrology records. Index a bounded vocabulary from that text
    # so its concepts join the existing map without importing generated prose.
    graph_text = str(record.get("graph_text") or "")
    if graph_text:
        for sign in ZODIAC_SIGNS:
            if re.search(rf"\b{re.escape(sign)}\b", graph_text, re.I):
                terms.add(f"sign:{sign}")
        for planet in PLANETS:
            if re.search(rf"\b{re.escape(planet)}\b", graph_text, re.I):
                terms.add(f"planet:{planet}")
        for concept, pattern in {
            "Karma": r"\bkarm(?:a|ic)(?: balance)?\b",
            "Nakshatra": r"\bnakshatra(?:s)?\b",
            "Graha": r"\bgrahas?\b",
            "Dharma": r"\bdharma\b",
            "Moksha": r"\bmoksha\b",
            "Rahu": r"\brahu\b",
            "Ketu": r"\bketu\b",
            "Dasha": r"\bdashas?\b|vimshottari",
            "Lagna": r"\blagna\b|ascendant",
            "Rashi": r"\brashi(?:s)?\b",
        }.items():
            if re.search(pattern, graph_text, re.I):
                terms.add(f"theme:{concept}")
    return terms


def graph_from(records: list[dict[str, Any]], source_rows: dict[str, int]) -> dict[str, Any]:
    node_counts: Counter[str] = Counter()
    edge_counts: Counter[tuple[str, str]] = Counter()
    edge_sources: dict[tuple[str, str], set[str]] = {}
    for dataset, count in source_rows.items():
        node_counts[f"dataset:{dataset}"] = count
    for record in records:
        dataset = str(record.get("source", "Astrology library"))
        entities = sorted(index_terms(record, dataset))
        for entity in entities:
            if not entity.startswith("dataset:"):
                node_counts[entity] += 1
        for i, left in enumerate(entities):
            for right in entities[i + 1:]:
                if left.startswith("dataset:") and right.startswith("dataset:"):
                    continue
                key = (left, right)
                edge_counts[key] += 1
                edge_sources.setdefault(key, set()).add(dataset)

    labels: dict[str, tuple[str, str]] = {}
    for sign in ZODIAC_SIGNS:
        labels[f"sign:{sign}"] = (sign, "sign")
    for planet in PLANETS:
        labels[f"planet:{planet}"] = (planet, "planet")
    for house in range(1, 13):
        labels[f"house:{house}"] = (f"House {house}", "house")
    for aspect in ASPECTS:
        labels[f"aspect:{aspect.title()}"] = (aspect.title(), "aspect")
    for key in node_counts:
        kind, _, name = key.partition(":")
        if key not in labels:
            labels[key] = (name, kind)
    nodes = [
        {"id": key, "label": labels[key][0], "kind": labels[key][1], "count": count}
        for key, count in node_counts.most_common()
        if key in labels
    ]
    edges = [
        {"source": left, "target": right, "count": count, "datasets": sorted(edge_sources[(left, right)])}
        for (left, right), count in edge_counts.most_common(420)
    ]
    return {"version": 1, "record_count": len(records), "source_rows": source_rows, "nodes": nodes, "edges": edges}


def tarot_cards(rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    best: dict[str, tuple[int, dict[str, Any], int]] = {}
    parsed_count = 0
    aliases = {"judgment": "Judgement", "high priestess": "The High Priestess"}
    known = {name.lower(): name for name in CANONICAL_CARDS}
    for row_number, row in enumerate(rows, start=1):
        completions = decode_completion(row.get("enhanced_completion"))
        for completion in completions:
            parsed_count += 1
            raw_name = str(completion.get("card_name") or "").strip()
            lookup_name = aliases.get(raw_name.lower(), raw_name)
            candidate = known.get(lookup_name.lower())
            cards_involved = completion.get("cards_involved")
            if not candidate and isinstance(cards_involved, list) and len(cards_involved) == 1:
                first = aliases.get(str(cards_involved[0]).strip().lower(), str(cards_involved[0]).strip())
                candidate = known.get(first.lower())
            if not candidate:
                continue
            score = 0
            if lookup_name.lower() == candidate.lower(): score += 8
            if isinstance(cards_involved, list) and len(cards_involved) == 1: score += 5
            if "single card" in str(completion.get("spread_name") or "").lower(): score += 3
            if completion.get("upright_interpretation"): score += 2
            if completion.get("reversed_interpretation"): score += 2
            if candidate not in best or score > best[candidate][0]:
                best[candidate] = (score, completion, row_number)

    cards = []
    for name in CANONICAL_CARDS:
        selected = best.get(name)
        record = selected[1] if selected else {}
        row = selected[2] if selected else 0
        suit = next((suit for suit in SUITS if name.endswith(f" of {suit}")), None)
        cards.append({
            "id": re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-"),
            "name": name,
            "arcana": "Major Arcana" if name in MAJOR_ARCANA else "Minor Arcana",
            "suit": suit or "",
            "traditionalSymbolism": record.get("traditional_symbolism", ""),
            "upright": record.get("upright_interpretation") or record.get("general_interpretation") or "Use this card as a gentle prompt to notice what feels important to you today; it is a reflection, not a prediction.",
            "reversed": record.get("reversed_interpretation") or record.get("alternative_interpretations") or "A reversed card can be used as an invitation to consider a different angle; it does not predict an outcome.",
            "reflection": record.get("reflection_questions", ""),
            "action": record.get("suggested_actions", ""),
            "source": "tarot_reading_interpretations",
            "source_row": row,
        })
    return cards, parsed_count


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_ROOT)
    args = parser.parse_args()
    source = args.source_dir.resolve()
    output = args.output_dir.resolve()
    transit_rows = rows_from_json(source / "astro_transits_and_growth.json")
    natal_rows = rows_from_json(source / "natal_chart_reflections.json")
    reframing_rows = rows_from_json(source / "positive_astro_reframing.json")
    lunar_rows = rows_from_zip(source / "lunar_solar_self_reflection.zip", "lunar_solar_self_reflection.json")
    tarot_rows = rows_from_zip(source / "tarot_reading_interpretations.zip", "tarot_reading_interpretations.json")
    vedic_rows = rows_from_json(source / "vedic_astrology_karmic_lore.json")

    astrology_records: list[dict[str, Any]] = []
    parsed_by_source: dict[str, int] = {}
    source_rows = {
        "astro_transits_and_growth": len(transit_rows),
        "natal_chart_reflections": len(natal_rows),
        "positive_astro_reframing": len(reframing_rows),
        "lunar_solar_self_reflection": len(lunar_rows),
    }
    for dataset, rows in (
        ("astro_transits_and_growth", transit_rows),
        ("natal_chart_reflections", natal_rows),
        ("positive_astro_reframing", reframing_rows),
        ("lunar_solar_self_reflection", lunar_rows),
    ):
        parsed_count = 0
        for row_number, row in enumerate(rows, start=1):
            for completion in decode_completion(row.get("enhanced_completion")):
                astrology_records.append(compact_record(completion, ASTRO_FIELDS, dataset, row_number))
                parsed_count += 1
        parsed_by_source[dataset] = parsed_count

    graph_records = astrology_records + [
        {
            "source": "vedic_astrology_karmic_lore",
            "source_row": row_number,
            "graph_text": f"{row.get('enhanced_prompt', '')}\n{row.get('enhanced_completion', '')}",
        }
        for row_number, row in enumerate(vedic_rows, start=1)
    ]
    tarot, tarot_parsed_count = tarot_cards(tarot_rows)
    source_rows["tarot_reading_interpretations"] = len(tarot_rows)
    graph_source_rows = {**source_rows, "vedic_astrology_karmic_lore": len(vedic_rows)}
    graph = graph_from(graph_records, graph_source_rows)
    output.mkdir(parents=True, exist_ok=True)
    (output / "astrology-reference.json").write_text(
        json.dumps({"version": 1, "record_count": len(astrology_records), "source_rows": source_rows, "records": astrology_records}, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    (output / "tarot-deck.json").write_text(
        json.dumps({"version": 1, "source_count": len(tarot_rows), "parsed_count": tarot_parsed_count, "card_count": len(tarot), "cards": tarot}, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    (output / "knowledge-graph.json").write_text(json.dumps(graph, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({
        "source_dir": str(source),
        "output_dir": str(output),
        "source_rows": source_rows,
        "parsed_astrology_records": parsed_by_source,
        "tarot_records_parsed": tarot_parsed_count,
        "vedic_graph_records": len(vedic_rows),
        "canonical_tarot_cards": len(tarot),
        "graph_nodes": len(graph["nodes"]),
        "graph_edges": len(graph["edges"]),
        "output_bytes": {path.name: path.stat().st_size for path in output.glob("*.json")},
    }, indent=2))


if __name__ == "__main__":
    main()
