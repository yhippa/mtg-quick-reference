import unittest
from scripts.build_data import transform

class DataTests(unittest.TestCase):
    def transform(self, records):
        return transform({'meta': {'date': '2026-01-01'}, 'data': records})['cards']

    def test_printings_and_rulings_deduplicated(self):
        record = {'type': 'Instant', 'text': 'Deal 3 damage.', 'manaCost': '{R}',
                  'rulings': [{'date': '2020-01-01', 'text': 'Later'}, {'date': '2010-01-01', 'text': 'Earlier'}]}
        cards = self.transform({'Lightning Bolt': [record, dict(record, printings=['A', 'B'])]})
        self.assertEqual(len(cards), 1)
        self.assertEqual(len(cards[0]['faces']), 1)
        self.assertEqual(cards[0]['rulings'], [('2010-01-01', 'Earlier'), ('2020-01-01', 'Later')])

    def test_multiface_layouts(self):
        for layout, name in [('transform', 'Delver // Aberration'), ('split', 'Fire // Ice'),
                             ('adventure', 'Giant // Stomp'), ('modal_dfc', 'Front // Back')]:
            front, back = name.split(' // ')
            card = self.transform({name: [
                {'side': 'b', 'faceName': back, 'type': 'Instant', 'text': 'Back', 'layout': layout},
                {'side': 'a', 'faceName': front, 'type': 'Creature', 'text': 'Front', 'power': '*', 'toughness': '3', 'layout': layout}]})[0]
            self.assertEqual([f['name'] for f in card['faces']], [front, back])
            self.assertEqual(card['faces'][0]['power'], '*')

    def test_loyalty_defense_missing_text(self):
        cards = self.transform({'Walker': [{'type': 'Planeswalker', 'loyalty': '4'}],
                                'Battle': [{'type': 'Battle', 'defense': '5'}]})
        self.assertEqual(cards[0]['faces'][0]['defense'], '5')
        self.assertEqual(cards[1]['faces'][0]['loyalty'], '4')
        self.assertEqual(cards[1]['faces'][0]['text'], '')

    def test_empty_rejected(self):
        with self.assertRaises(ValueError): self.transform({})
