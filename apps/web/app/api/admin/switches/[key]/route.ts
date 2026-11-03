import { setFeatureSwitch } from "@admitstory/db";
import { isFeatureKey } from "@admitstory/shared";
import { FeatureSwitchPatch } from "@admitstory/shared/schemas";
import { readJson } from "@/lib/api";
import { AdminActionError } from "@/lib/admin/errors";
import { adminRoute } from "@/lib/admin/guard";
import { forgetFeatureSwitches } from "@/lib/features";

// PUT /api/admin/switches/:key (spec §5.18 "kill switches"): pause or resume one feature, with a
// reason (audited) and optionally the line applicants read while it's paused. Other instances see
// the change within 15 seconds; this one at once.
export const PUT = adminRoute<{ key: string }>(async (admin, request, { key }) => {
  if (!isFeatureKey(key)) throw new AdminActionError("There's no switch with that name.", 404);
  const body = await readJson(request, FeatureSwitchPatch);
  const row = await setFeatureSwitch(admin, key, body);
  forgetFeatureSwitches();
  return Response.json({ key: row.key, enabled: row.enabled, message: row.message });
});
