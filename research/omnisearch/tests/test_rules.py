import importlib.util
from pathlib import Path
import unittest
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('rules_parser', ROOT/'parse_rules.py')
parser = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parser)

class RulesTests(unittest.TestCase):
    def test_official_source_roundtrip_and_structure(self):
        corpus,audit=parser.parse((ROOT/'source/comprehensive-rules.txt').read_bytes(),'https://media.wizards.com/test.txt','test','2026-09-20')
        docs={d['id']:d for d in corpus['documents']}
        self.assertEqual(audit['counts'], {'section':156,'rule':3165,'glossary':741})
        self.assertEqual(audit['accountedNonblankLines'],audit['expectedNonblankLines'])
        self.assertEqual(audit['roundTripBodiesVerified'],len(docs))
        self.assertEqual(corpus['source']['effectiveStatus'],'future')
        self.assertEqual(docs['cr:702.19b']['parentId'],'cr:702.19')
        self.assertIn('Example:',docs['cr:101.2']['text'])
        self.assertIn('cr:702.2',docs['glossary:deathtouch']['references'])
        self.assertTrue(all(d['sourceLines'][0]<=d['sourceLines'][1] for d in docs.values()))

    def test_references_allow_trailing_commas_and_periods(self):
        self.assertEqual(parser.REFERENCE.findall('See rules 117.3b, 704.5j, and rule 605.'),['117.3b','704.5j','605'])
        self.assertNotIn('202',parser.REFERENCE.findall('published 2026'))

    def test_refuses_missing_boundaries(self):
        raw=b'These rules are effective as of September 25, 2026.\n1. Game Concepts\nGlossary\nCredits'
        with self.assertRaises(ValueError):parser.parse(raw,'url','test','2026-09-20')

if __name__=='__main__':unittest.main()
