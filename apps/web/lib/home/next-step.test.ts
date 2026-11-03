import { describe, expect, it } from "vitest";
import { nextStep, type HomeFacts } from "./next-step";

const school = (
  over: Partial<HomeFacts["schools"][number]> = {},
): HomeFacts["schools"][number] => ({
  userSchoolId: "us-1",
  name: "Kestrel Lake",
  published: true,
  status: "considering",
  preview: false,
  kit: null,
  ...over,
});

describe("Home's next step (screen A)", () => {
  it("starts in the Studio until there are stories", () => {
    expect(nextStep({ stories: 0, hasProfileRead: false, schools: [] }).href).toBe("/studio");
  });

  it("then the Profile Read, then schools, then a preview", () => {
    expect(nextStep({ stories: 3, hasProfileRead: false, schools: [] }).href).toBe("/profile-read");
    expect(nextStep({ stories: 3, hasProfileRead: true, schools: [] }).href).toBe("/schools");
    expect(nextStep({ stories: 3, hasProfileRead: true, schools: [school()] }).href).toBe(
      "/schools/us-1/preview",
    );
  });

  it("puts a kit's open questions first once the kit is ready", () => {
    const step = nextStep({
      stories: 3,
      hasProfileRead: false,
      schools: [
        school({
          kit: { id: "k1", status: "ready", openNeeds: 3, firstNeedDeliverable: "d1" },
        }),
      ],
    });
    expect(step.title).toBe("Answer 3 questions to finish your Kestrel Lake drafts");
    expect(step.href).toBe("/workspace/d1");
  });

  it("follows a kit while it builds", () => {
    const step = nextStep({
      stories: 3,
      hasProfileRead: true,
      schools: [
        school({ kit: { id: "k1", status: "running", openNeeds: 0, firstNeedDeliverable: null } }),
      ],
    });
    expect(step.href).toBe("/kits/k1");
  });

  it("never offers a preview for a school whose pack is coming soon", () => {
    const step = nextStep({
      stories: 3,
      hasProfileRead: true,
      schools: [school({ published: false })],
    });
    expect(step.href).toBe("/schools");
  });
});
