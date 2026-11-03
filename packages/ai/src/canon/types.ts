export interface CanonRule {
  id: string;
  slug: string;
  text: string;
}

export interface CanonDoc {
  slug: string;
  title: string;
  version: number;
  body: string;
  rules: CanonRule[];
}

export type CanonSelector = { files?: readonly string[]; rules?: readonly string[] };

export interface CompiledCanon {
  text: string;
  hash: string;
  ruleIds: string[];
}

export interface CanonLibrary {
  docs: readonly CanonDoc[];
  getDoc(slug: string): CanonDoc;
  getRule(id: string): CanonRule;
  compile(selector: CanonSelector): CompiledCanon;
}
