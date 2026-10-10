export type StampTone = "complete" | "almost" | "halfway" | "normal";

/**
 * The line shown under the stamp circles. Near the end of the card it turns
 * into a nudge ("goal gradient": people speed up as the goal gets close).
 */
export function stampMessage(current: number, goal: number): { tone: StampTone; text: string } {
  const filled = Math.min(current, goal);
  const remaining = Math.max(goal - filled, 0);
  const left = `${remaining} ${remaining > 1 ? "passages" : "passage"}`;

  if (remaining === 0) {
    return { tone: "complete", text: "Carte complète ! Présentez-la au comptoir pour obtenir votre récompense." };
  }
  if (remaining <= 2) {
    return { tone: "almost", text: `Plus que ${left} : votre récompense est presque là !` };
  }
  if (goal >= 4 && filled === Math.ceil(goal / 2)) {
    return { tone: "halfway", text: `Déjà à mi-chemin ! Encore ${left} avant votre récompense.` };
  }
  return { tone: "normal", text: `Encore ${left} avant votre récompense.` };
}
