"""Offline, loss-audited parser for Wizards' Comprehensive Rules TXT (including glossary)."""
import argparse
from collections import Counter
from datetime import date, datetime, timezone
import gzip
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import unicodedata
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent
PAGE = 'https://magic.wizards.com/en/rules'
PARSER_VERSION = '1.0.1'
RULE = re.compile(r'^(\d{3}(?:\.\d+)?[a-z]?)(?:\.)?\s+(.+)$')
CHAPTER = re.compile(r'^([1-9])\.\s+(.+)$')
REFERENCE = re.compile(r'(?<![\w.])[1-9]\d{2}(?:\.\d+)?[a-z]?(?!\w)')


def slug(value):
    value = unicodedata.normalize('NFKD', value).lower()
    return re.sub(r'[^a-z0-9]+', '-', ''.join(c for c in value if not unicodedata.combining(c))).strip('-')


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
    def handle_starttag(self, tag, attrs):
        href = dict(attrs).get('href', '')
        if tag == 'a' and href.startswith('https://media.wizards.com/') and href.endswith('.txt'):
            self.links.append(quote(href, safe=':/%'))


def parse(raw, url, retrieved, as_of):
    text = raw.decode('utf-8-sig')
    lines = text.splitlines()
    effective = re.search(r'effective as of ([A-Za-z]+ \d+, \d{4})', text).group(1)
    effective = datetime.strptime(effective, '%B %d, %Y').date().isoformat()
    # The first chapter/glossary markers are the table of contents, not the body.
    starts = [i for i, line in enumerate(lines) if line.strip() == '1. Game Concepts']
    glossaries = [i for i, line in enumerate(lines) if line.strip() == 'Glossary']
    credits = [i for i, line in enumerate(lines) if line.strip() == 'Credits']
    if len(starts) != 2 or len(glossaries) != 2 or len(credits) != 2:
        raise ValueError('Unexpected document boundaries: inspect source before publishing')
    start, glossary, end = starts[-1], glossaries[-1], credits[-1]
    docs, used = [], set()
    current = None
    section = chapter = None
    def new_doc(key, kind, body, i, parent):
        return {'id': f'cr:{key}', 'kind': kind, 'key': key, 'title': body if kind == 'section' else key,
                'text': body, 'parentId': parent, 'sectionId': section, 'order': len(docs),
                'sourceLines': [i + 1, i + 1], 'references': [], 'unresolvedReferences': []}
    for i in range(start, glossary):
        line = lines[i].strip()
        if not line:
            continue
        used.add(i)
        match = RULE.match(line)
        ch = CHAPTER.match(line)
        if match or ch:
            key, body = (match or ch).groups()
            if ch:
                chapter = f'cr:{key}'
                section = chapter
                parent = None
                kind = 'section'
            elif '.' not in key:
                parent = chapter
                section = f'cr:{key}'
                kind = 'section'
            else:
                parent = f'cr:{key[:-1]}' if key[-1].isalpha() else section
                kind = 'rule'
            current = new_doc(key, kind, body, i, parent)
            docs.append(current)
        elif current:
            current['text'] += '\n' + line
            current['sourceLines'][1] = i + 1
        else:
            raise ValueError(f'Orphan text at line {i+1}')
    # Glossary entries are blank-separated blocks: title, then all definition lines.
    i = glossary + 1
    while i < end:
        if not lines[i].strip():
            i += 1
            continue
        a = i
        block = []
        while i < end and lines[i].strip():
            used.add(i)
            block.append(lines[i].strip())
            i += 1
        if len(block) < 2:
            raise ValueError(f'Glossary block without definition at line {a+1}: {block}')
        title, *body = block
        docs.append({'id': f'glossary:{slug(title)}', 'kind': 'glossary', 'key': title, 'title': title,
                     'text': '\n'.join(body), 'parentId': None, 'sectionId': None, 'order': len(docs),
                     'sourceLines': [a+1, i], 'references': [], 'unresolvedReferences': []})
    by_id = {d['id']: d for d in docs}
    if len(by_id) != len(docs):
        duplicates = [key for key, n in Counter(d['id'] for d in docs).items() if n > 1]
        raise ValueError(f'Duplicate document identifiers: {duplicates}')
    for d in docs:
        if d['parentId'] and d['parentId'] not in by_id:
            raise ValueError(f'Missing parent {d["parentId"]}')
        if d['kind'] == 'rule':
            context = by_id[d['parentId']]
            # Keyword/action group labels are short, numbered parent rules, not generated definitions.
            if context['kind'] == 'rule' and (len(context['text']) > 90 or context['text'].endswith('.')):
                context = by_id[d['sectionId']]
            context_title = context['text'].split('\n')[0]
            d['title'] = f'{d["key"]} — {context_title}'
            if len(d['text']) < 90 and '\n' not in d['text'] and not d['text'].endswith('.'):
                d['title'] = f'{d["key"]} — {d["text"]}'
        refs = set()
        for match in REFERENCE.finditer(d['text']):
            ref = match.group()
            prefix = d['text'][:match.start()]
            if '.' in ref or re.search(r'(?:rules?|sections?)\s+$', prefix, re.I):
                refs.add(ref)
        refs.update(re.findall(r'\bsection ([1-9])\b', d['text'], re.I))
        refs = sorted(refs)
        for ref in refs:
            dest = f'cr:{ref}'
            (d['references'] if dest in by_id else d['unresolvedReferences']).append(dest)
        if d['kind'] == 'glossary':
            # Resolve only exact standalone "See <term>." pointers; don't invent semantic links.
            alias = re.fullmatch(r'See (.+)\.', d['text'])
            if alias:
                target = f'glossary:{slug(alias.group(1))}'
                if target in by_id:
                    d['references'].append(target)
    expected = {i for i in range(start,end) if lines[i].strip() and i != glossary}
    if expected != used:
        raise ValueError(f'Unaccounted source lines: {sorted(expected-used)}')
    # Round-trip every document's body against its exact source span: no examples/continuations dropped.
    for d in docs:
        a,b = d['sourceLines']
        source = [line.strip() for line in lines[a-1:b] if line.strip()]
        expected_body = '\n'.join(source[1:]) if d['kind']=='glossary' else '\n'.join([re.sub(r'^\d+(?:\.\d+)?[a-z]?\.?\s+', '', source[0]), *source[1:]])
        if d['text'] != expected_body:
            raise ValueError(f'Round-trip mismatch {d["id"]}')
    metadata = {'publisher':'Wizards of the Coast', 'language':'en', 'landingPage':PAGE, 'url':url,
                'retrievedAt':retrieved, 'effectiveDate':effective, 'asOfDate':as_of,
                'effectiveStatus':'future' if effective>as_of else 'effective',
                'sha256':hashlib.sha256(raw).hexdigest(), 'originalBytes':len(raw), 'parserVersion':PARSER_VERSION}
    audit = {'counts':dict(Counter(d['kind'] for d in docs)), 'documents':len(docs),
             'accountedNonblankLines':len(used), 'expectedNonblankLines':len(expected),
             'unresolvedReferences':[{ 'id':d['id'], 'refs':d['unresolvedReferences']} for d in docs if d['unresolvedReferences']],
             'roundTripBodiesVerified':len(docs), 'excludedRanges':{'preambleAndTOC':[1,start],'credits':[end+1,len(lines)]}}
    return {'schemaVersion':1,'source':metadata,'documents':docs},audit

