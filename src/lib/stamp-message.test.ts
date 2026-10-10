import { describe, expect, it } from "vitest";

import { stampMessage } from "./stamp-message";

describe("stampMessage", () => {
  it("counts down normally at the start of a card", () => {
    expect(stampMessage(1, 10)).toEqual({ tone: "normal", text: "Encore 9 passages avant votre récompense." });
  });

  it("celebrates the halfway point", () => {
    expect(stampMessage(5, 10)).toMatchObject({ tone: "halfway" });
    expect(stampMessage(5, 10).text).toContain("mi-chemin");
    expect(stampMessage(3, 6)).toMatchObject({ tone: "halfway" });
  });

  it("nudges when one or two stamps remain, in correct French plural", () => {
    expect(stampMessage(8, 10)).toEqual({ tone: "almost", text: "Plus que 2 passages : votre récompense est presque là !" });
    expect(stampMessage(9, 10)).toEqual({ tone: "almost", text: "Plus que 1 passage : votre récompense est presque là !" });
  });

  it("prefers the nudge over the halfway message on short cards", () => {
    expect(stampMessage(2, 4)).toMatchObject({ tone: "almost" });
    expect(stampMessage(1, 3)).toMatchObject({ tone: "almost" });
    expect(stampMessage(3, 5)).toMatchObject({ tone: "almost" });
  });

  it("announces a full card, even when the count overshoots the goal", () => {
    expect(stampMessage(10, 10).tone).toBe("complete");
    expect(stampMessage(12, 10).tone).toBe("complete");
  });
});
