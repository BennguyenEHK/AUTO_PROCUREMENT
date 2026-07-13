#!/usr/bin/env python3
"""Deterministic helpers for the rfq-analysis Codex skill."""

from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path
from typing import Any


RE_PREFIX = re.compile(r"^\s*((re|fw|fwd|aw)\s*:\s*)+", re.IGNORECASE)
UNSAFE_CHARS = re.compile(r"[^A-Za-z0-9._ -]+")
WHITESPACE = re.compile(r"\s+")


def normalize_subject(subject: str) -> str:
    """Return a search-friendly subject with common reply/forward prefixes removed."""
    cleaned = RE_PREFIX.sub("", subject or "").strip()
    return WHITESPACE.sub(" ", cleaned)


def safe_slug(value: str, fallback: str = "RFQ") -> str:
    """Return a filesystem-safe path segment."""
    cleaned = normalize_subject(value)
    cleaned = UNSAFE_CHARS.sub("-", cleaned)
    cleaned = re.sub(r"[- ]{2,}", "-", cleaned).strip(" .-_")
    return cleaned[:80] or fallback


def documents_dir() -> Path:
    """Resolve the current user's Documents directory without hardcoding a username."""
    user_profile = os.environ.get("USERPROFILE")
    if user_profile:
        candidate = Path(user_profile) / "Documents"
        if candidate.exists():
            return candidate
    home_candidate = Path.home() / "Documents"
    return home_candidate


def rfq_workspace(subject: str) -> Path:
    """Return the incoming attachment workspace for an RFQ subject."""
    return documents_dir() / "QuoteFlowAI" / "RFQ" / safe_slug(subject) / "incoming"


def safe_filename(filename: str, fallback: str = "attachment") -> str:
    """Return a filename safe for writing inside the RFQ workspace."""
    name = Path(filename or fallback).name
    stem = safe_slug(Path(name).stem, fallback=fallback)
    suffix = re.sub(r"[^A-Za-z0-9.]", "", Path(name).suffix)[:20]
    return f"{stem}{suffix}"


def unique_path(directory: Path, filename: str) -> Path:
    """Return a duplicate-safe path without overwriting a different file."""
    directory.mkdir(parents=True, exist_ok=True)
    candidate = directory / safe_filename(filename)
    if not candidate.exists():
        return candidate

    stem = candidate.stem
    suffix = candidate.suffix
    for index in range(2, 1000):
        next_candidate = directory / f"{stem}-{index}{suffix}"
        if not next_candidate.exists():
            return next_candidate
    raise RuntimeError(f"Could not allocate a unique filename for {filename!r}")


def sha256_file(path: Path) -> str:
    """Calculate SHA-256 for a file."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_email_body(body: str) -> str:
    """Remove obvious non-RFQ email noise while preserving technical content."""
    lines = (body or "").splitlines()
    kept: list[str] = []
    for line in lines:
        stripped = line.strip()
        lower = stripped.lower()
        if lower.startswith(("from:", "sent:", "to:", "cc:", "subject:")) and kept:
            break
        if lower.startswith(("confidentiality notice", "this email and any attachments")):
            break
        if lower in {"best regards,", "kind regards,", "regards,"}:
            kept.append(line)
            continue
        kept.append(line)
    text = "\n".join(kept).strip()
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text


def compact_context(email: dict[str, Any], parsed_attachments: list[dict[str, Any]]) -> dict[str, Any]:
    """Build a compact RFQ context package from normalized email and parsed attachments."""
    return {
        "subject": email.get("subject", ""),
        "from": email.get("from", ""),
        "date": email.get("date", ""),
        "normalized_email_body": email.get("normalized_email_body", ""),
        "thread_context": email.get("thread_context", ""),
        "attachments": parsed_attachments,
        "source_references": email.get("source_references", []),
    }


def load_json(value: str) -> Any:
    """Load JSON and raise ValueError with a short message on failure."""
    try:
        return json.loads(value)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON: {exc.msg}") from exc


def validate_rfq_analysis(payload: dict[str, Any]) -> None:
    """Validate the Abacus RFQ-level response contract."""
    if not isinstance(payload, dict):
        raise ValueError("RFQ analysis payload must be an object")
    rfq_analysis = payload.get("rfq_analysis")
    if not isinstance(rfq_analysis, dict):
        raise ValueError("Missing rfq_analysis object")
    if rfq_analysis.get("analysis_status") != "completed":
        raise ValueError("rfq_analysis.analysis_status must be completed")
    if not isinstance(payload.get("customer_partial"), dict):
        raise ValueError("Missing customer_partial object")


def validate_item_summary(input_item_ids: list[Any], payload: dict[str, Any]) -> None:
    """Validate item summary output against input item ids."""
    items = payload.get("items") if isinstance(payload, dict) else None
    if not isinstance(items, list):
        raise ValueError("Missing items array")
    output_ids = [item.get("item_id") for item in items if isinstance(item, dict)]
    if sorted(map(str, output_ids)) != sorted(map(str, input_item_ids)):
        raise ValueError("Item summary ids do not match input ids")
    for item in items:
        if not isinstance(item, dict):
            raise ValueError("Each item summary must be an object")
        for key in ("identification", "classification", "application", "purpose", "features"):
            if not isinstance(item.get(key), list):
                raise ValueError(f"Item summary field {key} must be an array")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="RFQ helper utilities")
    parser.add_argument("subject", help="RFQ email subject")
    args = parser.parse_args()
    print(rfq_workspace(args.subject))
