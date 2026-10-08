#!/usr/bin/env python3
"""Extract factual, per-entry SRD 5.1 item records from the checked-in CC PDF.

This intentionally records only boundaries demonstrated by SRD layout: magic-item
headings are followed by an item kind/rarity line. It does not promote a match to
Grimoire or infer missing table fields.
"""
from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / 'third_party' / 'wotc' / 'srd' / '5.1' / 'SRD_CC_v5.1.pdf'
OUT = PDF.parent / 'extracted'
AUDIT = ROOT / 'artifacts' / 'content-audit'
EXCEPTIONS = PDF.parent / 'extractionExceptions.json'

SECTIONS = (
    (62, 74, 'Equipment', 'mundane-equipment', 'tables and named gear prose', 'row/table extraction'),
    (206, 207, 'Magic Items', 'magic-item-rules', 'general rules prose', 'not item records'),
    (208, 251, 'Magic Items A-Z', 'magic-items-az', 'headed prose entries', 'metadata-line boundary'),
    (251, 252, 'Sentient Magic Items', 'sentient-item-rules', 'general rules prose', 'not item records'),
    (252, 253, 'Artifacts', 'artifacts', 'named artifact prose plus general rules', 'named-entry boundary'),
)
MAGIC_META = re.compile(r'^(?:Armor\s*(?:\(|,)|Weapon\s*(?:\(|,)|Wondrous item,|Potion,|Ring,|Rod,|Staff,|Wand,|Scroll,|Ammunition,)', re.I)
STOP_HEADINGS = {'Sentient Magic Items', 'Artifacts', 'Monsters'}


def clean(value: str) -> str:
    value = value.replace('\u00a0', ' ').replace('\u00ad', '').replace('\r', ' ').replace('\n', ' ')
    value = value.replace('\u2010', '-').replace('\u2011', '-').replace('\u2013', '-').replace('\u2014', '-')
    return re.sub(r'\s+', ' ', value).strip()


def canonical_id(name: str) -> str:
    return f"srd51:{re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')}"


def page_columns(page: Any) -> list[list[str]]:
    """Return visual left/right column order from actual PDF coordinates."""
    chunks: list[tuple[float, float, str]] = []

    def visitor(text: str, _cm: Any, tm: Any, _font: Any, _size: float) -> None:
        value = clean(text)
        if value:
            chunks.append((float(tm[4]), float(tm[5]), value))

    page.extract_text(visitor_text=visitor)
    columns: list[list[str]] = []
    for low, high in ((0, 300), (300, 620)):
        rows: list[list[Any]] = []
        for x, y, text in chunks:
            if not (low <= x < high) or y <= 40 or text.startswith('System Reference Document'):
                continue
            row = next((candidate for candidate in rows if abs(candidate[0] - y) < 1), None)
            if row is None:
                rows.append([y, [(x, text)]])
            else:
                row[1].append((x, text))
        columns.append([' '.join(text for _x, text in sorted(parts)) for _y, parts in sorted(rows, reverse=True)])
    return columns


def page_rows(page: Any) -> list[list[tuple[float, str]]]:
    """Return source rows with their printed x positions intact.

    Equipment tables intentionally span visual columns; `page_columns` is
    correct for prose but loses the cells needed to bind an armor/weapon row.
    This helper keeps the PDF's explicit table-cell placement instead.
    """
    chunks: list[tuple[float, float, str]] = []

    def visitor(text: str, _cm: Any, tm: Any, _font: Any, _size: float) -> None:
        value = clean(text)
        if value:
            chunks.append((float(tm[4]), float(tm[5]), value))

    page.extract_text(visitor_text=visitor)
    rows: list[list[Any]] = []
    for x, y, text in chunks:
        if y <= 40 or text.startswith('System Reference Document'):
            continue
        row = next((candidate for candidate in rows if abs(candidate[0] - y) < 1), None)
        if row is None:
            rows.append([y, [(x, text)]])
        else:
            row[1].append((x, text))
    return [sorted(parts) for _y, parts in sorted(rows, reverse=True)]


def is_heading(line: str) -> bool:
    prose_starters = ('If ', 'While ', 'When ', 'The ', 'A ', 'An ', 'Each ', 'You ', 'On ', 'After ', 'Before ', 'For ', 'To ', 'At ', 'It ', 'This ', 'That ', 'These ', 'Those ', 'Once ', 'Whenever ', 'As ', 'In ', 'All ', 'Any ', 'One ')
    return bool(line) and len(line) <= 100 and not line.endswith('.') and line[0].isupper() and not line.startswith(prose_starters)


def rarity_from(metadata: str) -> str | None:
    match = re.search(r'\b(common|uncommon|rare|very rare|legendary|varies)\b', metadata, re.I)
    return match.group(1).lower() if match else None


def attunement_from(metadata: str) -> str | None:
    match = re.search(r'(requires\s+attunement[^)]*)', metadata, re.I)
    return match.group(1) if match else None


def extract_magic(reader: PdfReader, source_hash: str) -> list[dict[str, Any]]:
    stream: list[tuple[int, str]] = []
    # Magic Items A-Z starts in the right column of printed p.207, after the
    # general activation rules in that page's left column.
    for printed_page in range(207, 252):
        for column in page_columns(reader.pages[printed_page - 1]):
            stream.extend((printed_page, line) for line in column)
    # A printed item name can wrap across two visual text rows (for example,
    # "Amulet of Proof against Detection and" / "Location").  The reliable
    # structural marker is still the following item-kind/rarity line, so find
    # that marker first and then collect only contiguous heading-shaped rows
    # immediately above it.  This avoids treating wrapped headings as body
    # prose while deliberately not scanning arbitrary prose for names.
    starts: list[tuple[int, int, str]] = []
    for metadata_index in range(1, len(stream)):
        if not MAGIC_META.match(stream[metadata_index][1]):
            continue
        name_lines: list[str] = []
        name_start = metadata_index
        cursor = metadata_index - 1
        if cursor >= 0 and is_heading(stream[cursor][1]):
            # Tables immediately before an item can also contain title-shaped
            # cells.  Treat the immediate row as the full name by default;
            # only prepend one preceding row when that immediate row is an
            # obvious short wrap continuation (e.g. "Location").  A longer
            # unhandled wrap is safer as an unverified extraction than a
            # corrupted record boundary.
            name_lines = [stream[cursor][1]]
            name_start = cursor
            if len(stream[cursor][1].split()) <= 2 and cursor > 0 and is_heading(stream[cursor - 1][1]):
                name_lines.insert(0, stream[cursor - 1][1])
                name_start = cursor - 1
        if name_lines:
            starts.append((name_start, metadata_index, clean(' '.join(name_lines))))
    corrections = json.loads(EXCEPTIONS.read_text(encoding='utf-8')) if EXCEPTIONS.exists() else {}
    records: list[dict[str, Any]] = []
    for start_index, (start, metadata_index, name) in enumerate(starts):
        end = starts[start_index + 1][0] if start_index + 1 < len(starts) else len(stream)
        start_page = stream[start][0]
        if name in STOP_HEADINGS:
            continue
        correction = next((value for value in corrections.values()
                           if value['sourcePage'] == start_page and value['extracted'] == name), None)
        canonical_name = correction['canonical'] if correction else name
        metadata = stream[metadata_index][1]
        body: list[str] = []
        end_page = start_page
        for page, line in stream[metadata_index + 1:end]:
            if line in STOP_HEADINGS:
                break
            body.append(line)
            end_page = page
        prose = clean(' '.join(body))
        records.append({
            'canonicalId': canonical_id(canonical_name), 'name': canonical_name, 'category': 'magic-item', 'description': prose or None,
            'structured': {'itemTypeLine': metadata, 'rarity': rarity_from(metadata), 'attunement': attunement_from(metadata)},
            'source': {'document': 'SRD-5.1-CC', 'printedPage': start_page, 'printedEndPage': end_page,
                       'pdfPage': start_page - 1, 'pdfEndPage': end_page - 1, 'section': 'Magic Items A-Z',
                       'recordStructure': 'headed-prose-entry', 'rowEvidence': f'{name} | {metadata}', 'sourceHash': source_hash},
            'extractionCorrection': correction,
            'normalizedText': clean(f'{canonical_name} {metadata} {prose}'),
        })
    return records


def extract_named_artifacts(reader: PdfReader, source_hash: str) -> list[dict[str, Any]]:
    # The SRD has one individually named artifact here. Generic sentient/artifact
    # rules and random-property tables remain rules prose, not item records.
    page_252 = clean(reader.pages[251].extract_text(extraction_mode='layout') or '')
    page_253 = clean(reader.pages[252].extract_text(extraction_mode='layout') or '')
    marker = 'Orb of Dragonkind'
    if marker not in page_252:
        return []
    prose = clean(page_252.split(marker, 1)[1] + ' ' + page_253)
    return [{
        'canonicalId': canonical_id(marker), 'name': marker, 'category': 'artifact', 'description': prose,
        'structured': {'itemTypeLine': 'Wondrous item, artifact', 'rarity': 'artifact', 'attunement': None},
        'source': {'document': 'SRD-5.1-CC', 'printedPage': 252, 'printedEndPage': 253, 'pdfPage': 251,
                   'pdfEndPage': 252, 'section': 'Artifacts', 'recordStructure': 'named-prose-entry',
                   'rowEvidence': marker, 'sourceHash': source_hash},
        'normalizedText': clean(f'{marker} {prose}'),
    }]


def extract_mundane_table_rows(reader: PdfReader, source_hash: str) -> list[dict[str, Any]]:
    """Extract visible table cells without borrowing any private-catalog data."""
    records: list[dict[str, Any]] = []
    seen: set[tuple[str, int]] = set()
    currency = re.compile(r'\b(?:\d[\d,]*(?:½)?\s*(?:cp|sp|ep|gp|pp)|×\d)\b', re.I)
    weight = re.compile(r'(?:\d+(?:/\d+)?|—|×\d)\s*lb\.?', re.I)
    damage = re.compile(r'\b(\d*d\d+|\d+)\s+(bludgeoning|piercing|slashing)\b', re.I)
    speed = re.compile(r'\b(\d+)\s*ft\.?', re.I)
    for printed_page in (64, 66, 69, 70, 72):
        for column in page_columns(reader.pages[printed_page - 1]):
            for line in column:
                first_cost = currency.search(line)
                if not (first_cost and weight.search(line)):
                    continue
                name = clean(line[:first_cost.start()]).strip(' -')
                if not name or len(name) > 80 or name.lower() in {'item', 'cost'}:
                    continue
                key = (name.lower(), printed_page)
                if key in seen:
                    continue
                seen.add(key)
                cost = clean(first_cost.group(0))
                weight_match = weight.search(line)
                damage_match = damage.search(line)
                speed_match = speed.search(line)
                # Explicitly represent only cells present in the source row.
                # `None` means the source table uses a dash/no stated value;
                # it is never a guessed zero or a value copied from Grimoire.
                structured: dict[str, Any] = {
                    'rawRow': line,
                    'cost': cost,
                    'weightPounds': None,
                }
                if weight_match:
                    raw_weight = weight_match.group(0).lower().replace('lb.', '').replace('lb', '').strip()
                    if raw_weight not in {'—', '-'}:
                        numerator, *denominator = raw_weight.split('/')
                        structured['weightPounds'] = int(numerator) / int(denominator[0]) if denominator else int(numerator)
                if damage_match:
                    structured['damageDice'] = damage_match.group(1)
                    structured['damageType'] = damage_match.group(2).lower()
                if speed_match:
                    structured['speedFeet'] = int(speed_match.group(1))
                records.append({
                    'canonicalId': canonical_id(name), 'name': name, 'category': 'mundane-equipment', 'description': None,
                    'structured': structured,
                    'source': {'document': 'SRD-5.1-CC', 'printedPage': printed_page, 'printedEndPage': printed_page,
                               'pdfPage': printed_page - 1, 'pdfEndPage': printed_page - 1, 'section': 'Equipment',
                               'table': 'SRD equipment table', 'recordStructure': 'table-row', 'rowEvidence': line,
                               'sourceHash': source_hash}, 'normalizedText': clean(line),
                })
    return records


def number_or_none(value: str) -> float | None:
    value = value.strip().replace('lb.', '').replace('lb', '').strip()
    if value in {'—', '-'}:
        return None
    if '/' in value:
        numerator, denominator = value.split('/', 1)
        return int(numerator) / int(denominator)
    return float(value)


def extract_armor_rows(reader: PdfReader, source_hash: str) -> list[dict[str, Any]]:
    """Extract the explicitly positioned armor-table cells on SRD printed p.64."""
    rows = page_rows(reader.pages[63])
    category = 'light armor'  # The table begins with its light-armor rows at this page boundary.
    records: list[dict[str, Any]] = []
    for parts in rows:
        cells = [(x, text) for x, text in parts]
        text = clean(' '.join(value for _x, value in cells))
        first_x = cells[0][0] if cells else 0
        if first_x < 80 and text in {'Medium Armor', 'Heavy Armor', 'Shield'}:
            category = text.lower()
            continue
        if not (60 <= first_x < 80 and len(cells) >= 5 and re.search(r'\b(?:cp|sp|gp|pp)\b', text)):
            continue
        name, cost, ac_cell = cells[0][1], cells[1][1], clean(' '.join(value for x, value in cells[2:] if 180 <= x < 290))
        strength_cell = clean(' '.join(value for x, value in cells[2:] if 290 <= x < 335))
        stealth_cell = clean(' '.join(value for x, value in cells[2:] if 335 <= x < 395))
        weight_cell = clean(' '.join(value for x, value in cells[2:] if x >= 395))
        ac_match = re.match(r'([+]?\d+)', ac_cell)
        if not ac_match:
            continue
        dex = 'Dex modifier' in ac_cell
        cap = re.search(r'max\s*(\d+)', ac_cell)
        structured = {
            'rawRow': text, 'armorCategory': category, 'cost': cost,
            'baseAC': int(ac_match.group(1).lstrip('+')), 'dexterityApplies': dex,
            'dexterityCap': int(cap.group(1)) if cap else None,
            'strengthRequirement': int(re.search(r'\d+', strength_cell).group(0)) if re.search(r'\d+', strength_cell) else None,
            'stealthDisadvantage': stealth_cell.lower() == 'disadvantage',
            'weightPounds': number_or_none(weight_cell),
            'shieldBonus': int(ac_match.group(1).lstrip('+')) if category == 'shield' else None,
        }
        records.append({
            'canonicalId': canonical_id(name), 'name': name, 'category': 'mundane-equipment', 'description': None,
            'structured': structured,
            'source': {'document': 'SRD-5.1-CC', 'printedPage': 64, 'printedEndPage': 64,
                       'pdfPage': 63, 'pdfEndPage': 63, 'section': 'Equipment', 'table': 'SRD armor table',
                       'recordStructure': 'table-row', 'rowEvidence': text, 'sourceHash': source_hash},
            'normalizedText': clean(text),
        })
    return records


def enrich_weapon_rows(reader: PdfReader, records: list[dict[str, Any]]) -> None:
    """Attach the source table's explicit category/properties to weapon rows."""
    by_name = {record['name'].lower(): record for record in records}
    category = 'simple melee'
    for parts in page_rows(reader.pages[65]):
        cells = [(x, text) for x, text in parts]
        text = clean(' '.join(value for _x, value in cells))
        if cells and cells[0][0] < 80 and text in {'Simple Ranged Weapons', 'Martial Melee Weapons', 'Martial Ranged Weapons'}:
            category = text.lower().replace(' weapons', '')
            continue
        if not (cells and 60 <= cells[0][0] < 80 and len(cells) >= 4):
            continue
        name = cells[0][1]
        record = by_name.get(name.lower())
        if not record or 'damageDice' not in record['structured']:
            continue
        properties = clean(' '.join(value for x, value in cells if x >= 300))
        properties = properties.replace(' -- ', '-').replace(' - handed', '-handed').replace('two - handed', 'two-handed')
        property_values = [] if properties in {'', '—', '-'} else [part.strip().lower() for part in properties.split(',')]
        ranges = re.search(r'range\s+(\d+)\s*/\s*(\d+)', properties, re.I)
        versatile = re.search(r'versatile\s*\((\d+d\d+)\)', properties, re.I)
        record['structured'].update({
            'weaponCategory': category, 'properties': property_values,
            'normalRange': int(ranges.group(1)) if ranges else None,
            'longRange': int(ranges.group(2)) if ranges else None,
            'versatileDamage': versatile.group(1) if versatile else None,
        })
        record['source']['rowEvidence'] = text


def main() -> None:
    if not PDF.is_file():
        raise SystemExit(f'Missing canonical PDF: {PDF}')
    source_hash = hashlib.sha256(PDF.read_bytes()).hexdigest()
    reader = PdfReader(str(PDF))
    mundane = extract_mundane_table_rows(reader, source_hash)
    enrich_weapon_rows(reader, mundane)
    mundane.extend(extract_armor_rows(reader, source_hash))
    magic = extract_magic(reader, source_hash)
    artifacts = extract_named_artifacts(reader, source_hash)
    records = mundane + magic + artifacts
    payload = {
        'document': 'SRD-5.1-CC', 'sourceHash': source_hash, 'extractorVersion': 2, 'pageCount': len(reader.pages),
        'sections': [dict(printedStart=a, printedEnd=b, heading=c, category=d, structure=e, strategy=f) for a, b, c, d, e, f in SECTIONS],
        'records': records,
        'extractionExceptions': ['Mundane records require a visible cost-and-weight table row.', 'Sentient-item rules are not individual item records.', 'Artifact extraction includes only named entries.'],
        'duplicates': sorted(name for name, count in Counter(r['name'] for r in records).items() if count > 1),
    }
    OUT.mkdir(parents=True, exist_ok=True)
    for name in ('items.raw.json', 'items.json'):
        (OUT / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    AUDIT.mkdir(parents=True, exist_ok=True)
    section_lines = ['# SRD 5.1 item-bearing source sections', '']
    for a, b, heading, _category, structure, strategy in SECTIONS:
        section_lines.append(f'- **{heading}** - printed pp. {a}-{b}; PDF indices {a - 1}-{b - 1}; `{structure}`; extraction: `{strategy}`.')
    (AUDIT / 'srd-item-sections.md').write_text('\n'.join(section_lines) + '\n', encoding='utf-8')
    grouped = [('Mundane equipment', mundane), ('Magic Items A-Z', magic), ('Named artifacts/special items', artifacts)]
    report = ['# Canonical SRD 5.1 item extraction', '']
    for title, rows in grouped:
        report += [f'## {title} ({len(rows)})', ''] + [f'- {r["name"]} - SRD p.{r["source"]["printedPage"]}' for r in rows] + ['']
    report += ['## Extraction notes', ''] + [f'- {x}' for x in payload['extractionExceptions']] + ['']
    (AUDIT / 'canonical-srd-items.md').write_text('\n'.join(report), encoding='utf-8')


if __name__ == '__main__':
    main()
