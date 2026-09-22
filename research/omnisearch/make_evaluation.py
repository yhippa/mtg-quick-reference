"""Fixed, author-judged retrieval cases. Run before inspecting experiment rankings."""
import hashlib
import json
from pathlib import Path
from urllib.parse import quote
ROOT=Path(__file__).resolve().parent
rules={d['id']:d for d in json.loads((ROOT/'data/corpus.json').read_text())['documents']}
cards={d['title']:d['id'] for d in json.loads((ROOT/'data/cards.json').read_text())}
cases=[]
def add(category,query,primary,secondary=(),note=''):
    relevant={key:3 for key in primary}
    relevant.update({key:1 for key in secondary if key not in relevant})
    for key in relevant:
        assert key in rules or key in cards.values(),key
    cases.append({'id':f'q{len(cases)+1:02}', 'category':category,'query':query,
                  'split':'development' if len(cases)%3==0 else 'evaluation',
                  'relevance':relevant,'note':note or '3 = direct destination; 1 = useful context, not a complete answer.'})
for query,name in [('Sol Ring','Sol Ring'),('Lightning Bolt','Lightning Bolt'),('Sheoldred, the Apocalypse','Sheoldred, the Apocalypse'),('Necropotence','Necropotence'),('Fire // Ice','Fire // Ice'),('Bonecrusher Giant','Bonecrusher Giant // Stomp'),('Counterspell','Counterspell'),('Jace, the Mind Sculptor','Jace, the Mind Sculptor')]:
    add('card-exact',query,[cards[name]])
for query,name in [('sol','Sol Ring'),('bolt','Lightning Bolt'),('sheold','Sheoldred, the Apocalypse'),('necro','Necropotence'),('true scriptures','Sheoldred // The True Scriptures'),('urzas saga',"Urza's Saga")]:
    add('card-prefix',query,[cards[name]],note='Named target is a representative desired card, not the only valid card result.')
for query,key in [('117.3b','117.3b'),('704.5j','704.5j'),('rule 702.19b','702.19b'),('CR 903.8','903.8'),('605','605'),('rule 608.2b','608.2b'),('702.16','702.16'),('rule 302.6','302.6')]:
    add('rule-id',query,['cr:'+key])
for term in ['Deathtouch','Ward','First Strike','Menace','Affinity','Indestructible','Hexproof','Proliferate','Commander Tax','State-Based Actions','Summoning Sickness Rule','APNAP Order']:
    key='glossary:'+term.lower().replace(' ','-')
    add('glossary',term,[key],rules[key]['references'])
for query,name,gloss in [('fear','Fear','fear'),('flash','Flash','flash'),('shock','Shock',None),('counter',None,'counter'),('stack',None,'stack'),('copy',None,'copy'),('mill',None,'mill'),('protection',None,'protection')]:
    primary=([cards[name]] if name else [])+(['glossary:'+gloss] if gloss else [])
    add('ambiguous',query,primary,note='Either exact card or exact glossary is relevant; ambiguity coverage also measures whether both appear.')
prose=[
 ('who gets priority after a spell resolves',['cr:117.3b'],['cr:117','glossary:priority']),
 ('when can I cast a sorcery',['cr:307.1'],['cr:307','cr:117']),
 ('all targets illegal',['cr:608.2b'],['glossary:illegal-target']),
 ('commander costs two more',['cr:903.8'],['glossary:commander-tax']),
 ('two legendary permanents same name',['cr:704.5j'],['glossary:legend-rule']),
 ('creature zero toughness indestructible',['cr:704.5f'],['glossary:indestructible']),
 ('mana ability uses stack',['cr:605.3b'],['cr:605']),
 ('tokens leave battlefield',['cr:111.7','cr:111.8'],['cr:111']),
 ('copy enters battlefield',['cr:707.5'],['cr:707']),
 ('creature tap summoning sickness',['cr:302.6'],['glossary:summoning-sickness-rule']),
 ('discard maximum hand size cleanup',['cr:514.1'],['cr:514']),
 ('active nonactive player choices order',['cr:101.4'],['glossary:active-player-nonactive-player-order']),
 ('how to mulligan',['cr:103.5'],['glossary:mulligan','glossary:london-mulligan']),
 ('trample deathtouch',['cr:702.19b','cr:702.2c'],['glossary:trample','glossary:deathtouch']),
 ('sacrifice indestructible',['cr:701.21a'],['glossary:sacrifice','glossary:indestructible']),
 ('combat damage assignment order',['cr:510.1c','cr:510.1d'],['glossary:damage-assignment-order-obsolete']),
 ('continuous effects layers',['cr:613.1'],['cr:613']),
 ('dies creature graveyard',['cr:700.4'],['glossary:dies']),
 ('replacement effects choose order',['cr:616.1'],['cr:616']),
 ('protection target damage enchant block',['cr:702.16b','cr:702.16c','cr:702.16e','cr:702.16f'],['glossary:protection']),
]
for q,p,s in prose:add('rules-prose',q,p,s)
# Cases requiring semantic/colloquial expansion are intentionally not hidden by a synonyms table.
for q,key in [('fizzle','glossary:illegal-target'),('shroud vs hexproof','glossary:hexproof'),('when does damage wear off','cr:514.2'),('can I respond to paying costs','cr:601.2h')]:
    add('colloquial',q,[key],note='Known difficult language; retrieval only, not a generated ruling or complete multi-rule answer.')
result={'version':1,'judging':'Author-created relevance judgments, not judge-reviewed or user-log-derived. Fixed before rankings; no post-score tuning. Context graded separately from direct relevance.','cases':cases}
raw=json.dumps(result,ensure_ascii=False,indent=2)+'\n'
(ROOT/'evaluation.json').write_text(raw)
(ROOT/'results/evaluation-sha256.txt').write_text(hashlib.sha256(raw.encode()).hexdigest()+'\n')
print(len(cases),'queries')
