import { describe, expect, it } from "vitest";
import { BUDGET_CAPS, checkBudget } from "../src/budget";
import { BudgetExceededError } from "../src/errors";
import { createMemoryLedger, type LedgerSink } from "../src/ledger";
import { ROUTES } from "../src/routing";

const ledger = (byUser: number, byKit: number): LedgerSink => ({
  write: async () => {},
  spentByUser: async () => byUser,
  spentByKit: async () => byKit,
});

describe("checkBudget (spec §12.4)", () => {
  it("uses the spec's caps", () => {
    expect(BUDGET_CAPS).toEqual({ kitSoftUsd: 15, kitHardUsd: 25, freeUserUsd: 5 });
  });

  it("is ok under every cap", async () => {
    await expect(
      checkBudget({ ledger: ledger(1, 1), userId: "u", kitId: "k", route: ROUTES["kit.draft"] }),
    ).resolves.toBe("ok");
  });

  it("downgrades non-critical kit tasks past the soft cap and leaves the rest alone", async () => {
    const l = ledger(0, 15);
    await expect(checkBudget({ ledger: l, kitId: "k", route: ROUTES["kit.draft"] })).resolves.toBe(
      "downgrade",
    );
    await expect(
      checkBudget({ ledger: l, kitId: "k", route: ROUTES["interview.report"] }),
    ).resolves.toBe("downgrade");
    await expect(checkBudget({ ledger: l, kitId: "k", route: ROUTES["kit.critic"] })).resolves.toBe(
      "ok",
    );
  });

  it("blocks at the kit hard cap", async () => {
    await expect(
      checkBudget({ ledger: ledger(0, 25), kitId: "k", route: ROUTES["kit.draft"] }),
    ).rejects.toBeInstanceOf(BudgetExceededError);
  });

  it("past the free-user cap, keeps Studio on Haiku and blocks other tasks", async () => {
    const l = ledger(5, 0);
    await expect(
      checkBudget({ ledger: l, userId: "u", route: ROUTES["studio.interviewer"] }),
    ).resolves.toBe("downgrade");
    await expect(
      checkBudget({ ledger: l, userId: "u", route: ROUTES["util.title"] }),
    ).rejects.toMatchObject({ scope: "user", capUsd: 5 });
  });
});

describe("paid users (Phase 4, §12.4)", () => {
  it("exempts a paying user from the free cap but keeps the kit caps", async () => {
    const ledger = {
      ...createMemoryLedger([{ userId: "u1", kitId: null, costUsd: 9 } as never]),
      isPaidUser: async () => true,
    };
    await expect(checkBudget({ ledger, userId: "u1", route: {} })).resolves.toBe("ok");
    const free = { ...ledger, isPaidUser: async () => false };
    await expect(checkBudget({ ledger: free, userId: "u1", route: {} })).rejects.toThrow();
  });
});
