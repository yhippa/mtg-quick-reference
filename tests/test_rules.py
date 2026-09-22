import importlib.util
import json
from pathlib import Path
import sys
import unittest
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from rules_parser import parse
spec=importlib.util.spec_from_file_location('production_rules',ROOT/'scripts/parse-production-rules.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class RulesTests(unittest.TestCase):
    def test_provenance_structure_and_effective_policy(self):
        source=ROOT/'data-sources/rules';selection=json.loads((source/'selection.json').read_text())
        corpus,audit=module.selected_corpus(source,{**selection,'mode':'preview'},'2026-09-20')
        self.assertEqual(corpus['source']['effectiveStatus'],'future')
        self.assertEqual(audit['roundTripBodiesVerified'],4062)
        docs=corpus['documents'];ids={d['id'] for d in docs}
        self.assertEqual(len(ids),len(docs))
        self.assertEqual([d['order'] for d in docs],list(range(len(docs))))
        self.assertTrue(all(not d['parentId'] or d['parentId'] in ids for d in docs))
        self.assertTrue(all(set(d['references'])<=ids for d in docs))
        self.assertEqual(sum(d['kind']=='glossary' for d in docs),741)
        effective={**selection,'mode':'effective'}
        with self.assertRaisesRegex(ValueError,'Future-effective'):module.selected_corpus(source,effective,'2026-09-20')
        current,_=module.selected_corpus(source,effective,'2026-09-25')
        self.assertEqual(current['source']['effectiveStatus'],'effective')
        with self.assertRaisesRegex(ValueError,'identity'):module.selected_corpus(source,{**selection,'sourceSha256':'wrong'},'2026-09-20')
