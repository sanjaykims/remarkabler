import { composeHandwritingNotes } from "./claude";
import { correctedPairsForNotes, handwritingNotesDue, saveHandwritingNotes } from "./ocrLearning";

let inFlight = false;

/**
 * Rewrite the handwriting-habits note once enough new corrections have piled
 * up. Fire-and-forget safe: never throws, one run at a time, and a failure just
 * leaves the previous note in place.
 */
export async function maybeRefreshHandwritingNotes(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    if (!handwritingNotesDue()) return;
    const notes = await composeHandwritingNotes(correctedPairsForNotes());
    if (notes) saveHandwritingNotes(notes);
  } catch (e) {
    console.warn("[handwritingNotes] refresh failed:", (e as Error).message);
  } finally {
    inFlight = false;
  }
}
