from app.analyzer.compare import compare_elf


def meta(size, section_size, symbols=True):
    return {
        "filename": "test.elf", "file_size": size, "elf_class": "32-bit",
        "endianness": "little", "machine": "EM_ARM", "type": "ET_EXEC",
        "sections": [{"name": ".text", "type": "SHT_PROGBITS", "flags": ["ALLOC", "EXECINSTR"], "size": section_size}],
        "symbols": [{"name": "main", "size": section_size, "type": "STT_FUNC", "binding": "STB_GLOBAL", "section": "1"}] if symbols else [],
        "symbol_table_present": symbols,
        "segments": [{"file_size": size // 2, "memory_size": size}],
    }


def test_deltas_and_zero_baseline_percentage():
    result = compare_elf(meta(100, 20), meta(120, 30))
    assert result["summary"]["file_size"]["delta"] == 20
    assert result["summary"]["file_size"]["percent_change"] == 20
    assert result["sections"][0]["delta"] == 10


def test_no_symbol_table_warns():
    result = compare_elf(meta(100, 20, False), meta(100, 20))
    assert any("symbol table" in warning for warning in result["warnings"])
