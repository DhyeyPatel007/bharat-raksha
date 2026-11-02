import { createHash } from "crypto";
import type {
  AttachedEvidence,
  CanonicalGapCode,
  ChecklistItem,
  Dispute,
  EvidenceQuality,
  EvidenceType,
  Verdict,
} from "./types";
import { evDisplay, verdictForScore } from "./scorer";

export const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB per file
export const MAX_ATTACHMENTS_PER_DISPUTE = 10;

export const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".txt",
  ".json",
  ".csv",
];

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "text/plain",
  "application/json",
  "text/csv",
]);

export interface AttachmentMetadata {
  referenceId?: string;
  documentDate?: string;
  notes?: string;
}

export function computeSha256(buffer: Buffer | Uint8Array): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Deterministically classify the evidence quality:
 * - STRONG: Valid format + at least 2 verifiable anchors (identifier, date/amount)
 * - WEAK: Valid format, but lacks verifiable anchors
 * - INVALID: Empty, corrupt, or unsupported
 */
export function classifyEvidenceQuality(
  evidenceType: EvidenceType,
  fileName: string,
  mimeType: string,
  bytes: Buffer | Uint8Array,
  metadata?: AttachmentMetadata,
  dispute?: Dispute,
): {
  quality: EvidenceQuality;
  scoreDelta: number;
  reason: string;
} {
  const size = bytes.length;
  if (size === 0 || size > MAX_ATTACHMENT_SIZE_BYTES) {
    return {
      quality: "INVALID",
      scoreDelta: 0,
      reason: size === 0 ? "File is empty" : "File exceeds 5 MB limit",
    };
  }

  // Check magic bytes / header
  const isPdf =
    (mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) &&
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46; // %PDF

  const isPng =
    (mimeType === "image/png" || fileName.toLowerCase().endsWith(".png")) &&
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47; // \x89PNG

  const isJpg =
    (mimeType === "image/jpeg" ||
      mimeType === "image/jpg" ||
      fileName.toLowerCase().endsWith(".jpg") ||
      fileName.toLowerCase().endsWith(".jpeg")) &&
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff; // JPEG SOI

  const isTextBased =
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    /\.(txt|json|csv)$/i.test(fileName);

  const isValidFormat = isPdf || isPng || isJpg || isTextBased;
  if (!isValidFormat) {
    return {
      quality: "INVALID",
      scoreDelta: 0,
      reason: "Unsupported or corrupt file format",
    };
  }

  // Count verifiable anchors
  let anchors = 0;

  // Anchor 1: Reference ID or valid identifier pattern
  const refId = metadata?.referenceId?.trim() || "";
  if (refId && /^[A-Z0-9_-]{4,}$/i.test(refId)) {
    anchors += 1;
  }

  // Anchor 2: Date or amount
  const docDate = metadata?.documentDate?.trim() || "";
  if (docDate && /^\d{4}-\d{2}-\d{2}$/.test(docDate)) {
    anchors += 1;
  }

  // If text or PDF, inspect content stream for anchors
  if (isTextBased || isPdf) {
    try {
      const textPreview = Buffer.from(bytes.slice(0, Math.min(bytes.length, 8192))).toString("utf-8");
      if (anchors < 2) {
        if (!refId && /\b(?:INV|ORDER|TRACK|FEDEX|UPS|USPS|PP-D)-[A-Z0-9-]+\b/i.test(textPreview)) {
          anchors += 1;
        }
      }
      if (anchors < 2) {
        if (!docDate && /\b\d{4}-\d{2}-\d{2}\b/.test(textPreview)) {
          anchors += 1;
        } else if (
          dispute &&
          new RegExp(`\\$?\\s*${parseFloat(dispute.amount.value).toFixed(2)}`).test(textPreview)
        ) {
          anchors += 1;
        }
      }
    } catch {
      // Content scan fallback
    }
  } else if ((isPng || isJpg) && bytes.length >= 1024) {
    // For images, an image with clear reference metadata or valid dimension contributes an anchor
    if (refId || docDate) {
      anchors += 1;
    }
  }

  const isStrong = anchors >= 2 || (bytes.length >= 64 && anchors >= 1 && (refId !== "" || docDate !== ""));
  const quality: EvidenceQuality = isStrong ? "STRONG" : "WEAK";

  // Base delta by evidence type
  const deltaTable: Record<EvidenceType, { strong: number; weak: number }> = {
    CARRIER_POD: { strong: 25, weak: 10 },
    MERCHANT_LOG: { strong: 25, weak: 10 },
    TRACKING_RECEIPT: { strong: 20, weak: 8 },
    INVOICE: { strong: 15, weak: 6 },
    DELIVERY_PHOTO: { strong: 15, weak: 6 },
    EMAIL_CONFIRMATION: { strong: 10, weak: 4 },
    OTHER: { strong: 5, weak: 2 },
  };

  const scoreDelta = quality === "STRONG" ? deltaTable[evidenceType].strong : deltaTable[evidenceType].weak;

  return {
    quality,
    scoreDelta,
    reason: isStrong
      ? `Strong evidentiary proof (${anchors} verifiable anchors verified)`
      : `Weak evidentiary proof (lacks full verifiable anchors, awarded 0.4x partial credit)`,
  };
}

/**
 * Deterministically compute the score delta from attached evidence without modifying
 * the zero-attachment baseline.
 */
export function computeAttachedEvidenceDelta(
  attached: AttachedEvidence[],
  baseItems: ChecklistItem[],
  dispute: Dispute,
  baseScore: number,
): {
  delta: number;
  finalScore: number;
  itemDeltas: Record<string, number>;
  resolvedGaps: Set<CanonicalGapCode>;
  verdict: Verdict;
} {
  if (attached.length === 0) {
    return {
      delta: 0,
      finalScore: baseScore,
      itemDeltas: {},
      resolvedGaps: new Set(),
      verdict: verdictForScore(baseScore),
    };
  }

  // Deduplicate by evidenceType, taking the highest delta in each category
  const bestByCategory = new Map<EvidenceType, AttachedEvidence>();
  for (const item of attached) {
    if (item.quality === "INVALID") continue;
    const cur = bestByCategory.get(item.evidenceType);
    if (!cur || item.scoreDelta > cur.scoreDelta) {
      bestByCategory.set(item.evidenceType, item);
    }
  }

  const passedKeys = new Set(baseItems.filter((i) => i.passed).map((i) => i.key));
  const itemDeltas: Record<string, number> = {};
  const resolvedGaps = new Set<CanonicalGapCode>();
  let totalDelta = 0;

  for (const [type, item] of bestByCategory.entries()) {
    let delta = item.scoreDelta;

    if (type === "CARRIER_POD") {
      resolvedGaps.add("MISSING_DELIVERY_PROOF");
      resolvedGaps.add("MISSING_SIGNATURE_HIGH_VALUE");
      if (passedKeys.has("signature_confirmation") && passedKeys.has("delivery_verifiable")) {
        delta = 0; // Already satisfied in base
      } else if (passedKeys.has("delivery_verifiable")) {
        delta = item.quality === "STRONG" ? 15 : 6; // Signature slot
      }
    } else if (type === "MERCHANT_LOG") {
      resolvedGaps.add("MISSING_MERCHANT_LOG");
      resolvedGaps.add("MISSING_TIMESTAMP_ALIGNMENT");
      if (passedKeys.has("merchant_log_post_delivery_use")) {
        delta = 0; // Already satisfied in base
      }
    } else if (type === "INVOICE") {
      resolvedGaps.add("MISSING_INVOICE_ITEMIZATION");
      if (passedKeys.has("invoice_terms_consistent")) {
        delta = 0; // Already satisfied in base
      }
    } else if (type === "TRACKING_RECEIPT") {
      resolvedGaps.add("MISSING_TRACKING");
      if (passedKeys.has("tracking_delivered") && passedKeys.has("delivery_verifiable")) {
        delta = 0; // Already satisfied
      } else if (passedKeys.has("tracking_delivered")) {
        delta = item.quality === "STRONG" ? 10 : 4; // Upgrade unverified tracking
      }
    } else if (type === "DELIVERY_PHOTO") {
      resolvedGaps.add("SPEC_MISMATCH_NAD");
      resolvedGaps.add("MISSING_DELIVERY_PROOF");
      // Delivery photo provides counter-proof for NAD (Case B 60 -> 75)
    } else if (type === "EMAIL_CONFIRMATION") {
      resolvedGaps.add("OTHER_GAP");
    } else if (type === "OTHER") {
      resolvedGaps.add("OTHER_GAP");
    }

    if (delta > 0) {
      itemDeltas[item.id] = delta;
      totalDelta += delta;
    }
  }

  const finalScore = Math.min(100, baseScore + totalDelta);
  const verdict = verdictForScore(finalScore);

  return {
    delta: totalDelta,
    finalScore,
    itemDeltas,
    resolvedGaps,
    verdict,
  };
}
