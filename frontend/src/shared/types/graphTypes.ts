interface RDFLink {
  source: string;
  target: string;
  predicate: string;
}
interface TripleSend {
  subject: string,
  predicate: string,
  object: string,
}

export type { RDFLink, TripleSend };