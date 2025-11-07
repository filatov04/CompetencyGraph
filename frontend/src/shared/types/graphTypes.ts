interface RDFLink {
  source: string;
  target: string;
  predicate: string;
}

interface RDFNode {
    id: string;
    label: string;
    type: string;
}

export type { RDFLink, RDFNode };