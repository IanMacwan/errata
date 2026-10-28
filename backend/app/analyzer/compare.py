from __future__ import annotations

from collections import defaultdict
from typing import Any


def _delta(baseline: int, candidate: int) -> dict[str, Any]:
    change = candidate - baseline
    return {
        "baseline": baseline,
        "candidate": candidate,
        "delta": change,
        "percent_change": (change / baseline * 100) if baseline > 0 else None,
    }


def _sum_sections(meta: dict, predicate) -> int:
    return sum(s["size"] for s in meta["sections"] if predicate(s))


def compare_elf(baseline: dict, candidate: dict) -> dict[str, Any]:
    warnings = []
    if baseline["machine"] != candidate["machine"]:
        warnings.append("The ELF machine/architecture differs between builds; comparisons may be misleading.")
    if baseline["elf_class"] != candidate["elf_class"]:
        warnings.append("The ELF class differs between builds; comparisons may be misleading.")
    if not baseline["symbol_table_present"] or not candidate["symbol_table_present"]:
        warnings.append("Symbol-level results may be incomplete because one or both files lack a symbol table.")

    b_sections = {s["name"]: s for s in baseline["sections"]}
    c_sections = {s["name"]: s for s in candidate["sections"]}
    sections = []
    for name in sorted(set(b_sections) | set(c_sections)):
        b = b_sections.get(name)
        c = c_sections.get(name)
        sections.append({
            "name": name,
            "baseline": b["size"] if b else None,
            "candidate": c["size"] if c else None,
            "delta": (c["size"] if c else 0) - (b["size"] if b else 0),
            "baseline_type": b["type"] if b else None,
            "candidate_type": c["type"] if c else None,
            "baseline_flags": b["flags"] if b else None,
            "candidate_flags": c["flags"] if c else None,
        })

    # Match symbols by name, type, binding and section association. Duplicate keys are
    # retained as ordered lists so repeated names do not silently overwrite each other.
    def keyed(meta):
        groups = defaultdict(list)
        for sym in meta["symbols"]:
            key = (sym["name"], sym["type"], sym["binding"], sym["section"])
            groups[key].append(sym["size"])
        return groups

    bg, cg = keyed(baseline), keyed(candidate)
    symbols = []
    for key in sorted(set(bg) | set(cg)):
        b_values, c_values = sorted(bg.get(key, [])), sorted(cg.get(key, []))
        for idx in range(max(len(b_values), len(c_values))):
            b = b_values[idx] if idx < len(b_values) else None
            c = c_values[idx] if idx < len(c_values) else None
            symbols.append({
                "name": key[0], "type": key[1], "binding": key[2], "section": key[3],
                "baseline": b, "candidate": c,
                "delta": (c or 0) - (b or 0),
            })

    ranked = [s for s in symbols if s["baseline"] is not None and s["candidate"] is not None
              and s["baseline"] > 0 and s["candidate"] > 0 and s["delta"] != 0]
    increases = sorted((s for s in ranked if s["delta"] > 0), key=lambda s: abs(s["delta"]), reverse=True)[:10]
    decreases = sorted((s for s in ranked if s["delta"] < 0), key=lambda s: abs(s["delta"]), reverse=True)[:10]

    def metrics(meta):
        return {
            "allocated_section_bytes": _sum_sections(meta, lambda s: "ALLOC" in s["flags"]),
            "load_segment_file_bytes": sum(s["file_size"] for s in meta["segments"]),
            "load_segment_memory_bytes": sum(s["memory_size"] for s in meta["segments"]),
        }

    bm, cm = metrics(baseline), metrics(candidate)
    return {
        "baseline": {k: baseline[k] for k in ("filename", "file_size", "elf_class", "endianness", "machine", "type", "symbol_table_present")},
        "candidate": {k: candidate[k] for k in ("filename", "file_size", "elf_class", "endianness", "machine", "type", "symbol_table_present")},
        "summary": {
            "file_size": _delta(baseline["file_size"], candidate["file_size"]),
            **{key: _delta(bm[key], cm[key]) for key in bm},
        },
        "sections": sections,
        "symbols": symbols,
        "largest_symbol_increases": increases,
        "largest_symbol_decreases": decreases,
        "warnings": warnings,
    }
