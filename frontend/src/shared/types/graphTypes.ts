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

interface RDFNode {
    id: string;
    label: string;
    type: string;
}

export type { RDFLink, RDFNode, TripleSend };