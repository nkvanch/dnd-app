import provenance from './srdProvenance.json';
import { GENERATED_SRD_ITEM_PROVENANCE } from './generatedSrdItems';

export type ItemProvenanceSourceType = 'exact' | 'structured-only' | 'structured-variant' | 'adapted' | 'original' | 'unknown';
export type ItemProvenance = {
  public: boolean;
  verified: boolean;
  license: 'CC-BY-4.0';
  sourceDocument: 'SRD-5.1-CC';
  sourceType: ItemProvenanceSourceType;
  sourceHash: string;
  publicTextHash: string;
  verificationMethod: string;
  auditStatus: string;
  reason: string;
  sourceEntry?: string;
  sourcePage?: number;
  sourceEndPage?: number;
  sourceSection?: string;
  canonicalId?: string;
  variantParameters?: { bonus: number };
  modified: boolean;
  generatorVersion?: number;
  publicRecordHash?: string;
  fields?: Record<string, string>;
};

const byItemId = provenance as Record<string, ItemProvenance>;
const generatedByItemId = GENERATED_SRD_ITEM_PROVENANCE as unknown as Record<string, ItemProvenance>;

/** Public-mode exposure is stricter than the older SRD classification flag. */
export function hasVerifiedPublicItemProvenance(itemId: string): boolean {
  const record = generatedByItemId[itemId] ?? byItemId[itemId];
  return record?.public === true && record.verified === true;
}

export function itemProvenance(itemId: string): ItemProvenance | undefined {
  return generatedByItemId[itemId] ?? byItemId[itemId];
}
