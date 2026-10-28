from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from elftools.elf.elffile import ELFFile
from elftools.common.exceptions import ELFError


class InvalidELF(ValueError):
    """Raised when a file is not a readable ELF binary."""


def _flags(section) -> list[str]:
    flags = int(section["sh_flags"])
    names = []
    for bit, name in ((1, "WRITE"), (2, "ALLOC"), (4, "EXECINSTR")):
        if flags & bit:
            names.append(name)
    return names


def analyze_elf(path: Path, filename: str) -> dict[str, Any]:
    try:
        with path.open("rb") as stream:
            elf = ELFFile(stream)
            sections = []
            for section in elf.iter_sections():
                sections.append({
                    "name": section.name or "<unnamed>",
                    "type": str(section["sh_type"]),
                    "flags": _flags(section),
                    "size": int(section["sh_size"]),
                    "address": int(section["sh_addr"]),
                })
            symbols = []
            symbol_table_present = False
            for section in elf.iter_sections():
                if section["sh_type"] in ("SHT_SYMTAB", "SHT_DYNSYM"):
                    symbol_table_present = True
                    for symbol in section.iter_symbols():
                        info = symbol["st_info"]
                        index = symbol["st_shndx"]
                        symbols.append({
                            "name": symbol.name or "<unnamed>",
                            "size": int(symbol["st_size"]),
                            "type": str(info["type"]),
                            "binding": str(info["bind"]),
                            "section": str(index),
                        })
            segments = []
            for segment in elf.iter_segments():
                if segment["p_type"] == "PT_LOAD":
                    segments.append({
                        "file_size": int(segment["p_filesz"]),
                        "memory_size": int(segment["p_memsz"]),
                        "flags": str(segment["p_flags"]),
                    })
            header = elf.header
            return {
                "filename": filename,
                "file_size": path.stat().st_size,
                "elf_class": f"{elf.elfclass}-bit",
                "endianness": "little" if elf.little_endian else "big",
                "machine": str(header["e_machine"]),
                "type": str(header["e_type"]),
                "sections": sections,
                "symbols": symbols,
                "symbol_table_present": symbol_table_present,
                "segments": segments,
            }
    except (ELFError, OSError, ValueError, KeyError, TypeError, IndexError) as exc:
        raise InvalidELF("The uploaded file is not a valid, supported ELF binary.") from exc
