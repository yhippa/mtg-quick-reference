export interface RuleDocument {
  id: string; kind: 'section' | 'rule' | 'glossary'; key: string; title: string; text: string;
  parentId: string | null; sectionId: string | null; order: number; sourceLines: [number, number];
  references: string[]; unresolvedReferences: string[];
}
export interface RulesSource {
  publisher: string; language: string; landingPage: string; url: string; retrievedAt: string;
  effectiveDate: string; asOfDate: string; effectiveStatus: 'future' | 'effective';
  sha256: string; originalBytes: number; parserVersion: string;
}
export interface RulesCorpus { schemaVersion: number; source: RulesSource; documents: RuleDocument[] }
export interface BM25Index { version: number; n: number; avgLength: number; lengths: number[]; postings: Record<string, number[]> }
export type RuleHit = Pick<RuleDocument, 'id' | 'kind' | 'key' | 'title'>;
export interface RulesHits { direct: RuleHit[]; exact: RuleHit[]; ranked: RuleHit[] }
export interface RulesRelease {
  schemaVersion: number; mode: 'preview' | 'effective'; source: RulesSource;
  corpus: { url: string; sha256: string }; index: { url: string; sha256: string };
  cards: { sha256: string; updated: string }; documents: number;
}
export interface RuleDetail { document: RuleDocument; parent: RuleHit | null; children: RuleHit[]; references: RuleHit[] }
