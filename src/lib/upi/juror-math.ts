// BharatRaksha — Proportional Juror Points Allocation
// Single source of truth for distributing case checklist score across the 3 jurors
// using the largest-remainder method (Hare-Niemeyer method).

/**
 * Allocate the final case score across the 3 jurors proportionally to their raw scores,
 * using largest-remainder rounding so that the sum of the three displayed numbers
 * is GUARANTEED to equal finalScore exactly.
 *
 * Invariant: result[0] + result[1] + result[2] === finalScore
 */
export function allocateJurorPoints(
  finalScore: number,
  rawScores: [number, number, number]
): [number, number, number] {
  const sumRaw = rawScores[0] + rawScores[1] + rawScores[2];
  if (sumRaw === 0) {
    if (finalScore === 0) return [0, 0, 0];
    const base = Math.floor(finalScore / 3);
    const rem = finalScore % 3;
    return [
      base + (rem > 0 ? 1 : 0),
      base + (rem > 1 ? 1 : 0),
      base,
    ];
  }

  const exact = rawScores.map((r) => (r / sumRaw) * finalScore);
  const floors = exact.map((e) => Math.floor(e));
  const remainders = exact.map((e, i) => ({ index: i, rem: e - floors[i] }));

  let remaining = finalScore - (floors[0] + floors[1] + floors[2]);

  // Sort by remainder descending, tie-break by index ascending
  remainders.sort((a, b) => b.rem - a.rem || a.index - b.index);

  const result: [number, number, number] = [floors[0], floors[1], floors[2]];
  for (let i = 0; i < remaining; i++) {
    result[remainders[i].index] += 1;
  }

  return result;
}
