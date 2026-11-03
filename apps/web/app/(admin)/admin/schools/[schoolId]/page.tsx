import { listSchoolsForAdmin } from "@admitstory/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin/guard";
import { AdminForm } from "../../_components/admin-form";
import { Field, Input, Section, Select } from "../../_components/fields";
import { RoundsEditor } from "../../_components/rounds-editor";

export const metadata: Metadata = { title: "School" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SchoolPage({ params }: { params: Promise<{ schoolId: string }> }) {
  const admin = await requireAdminPage();
  const { schoolId } = await params;
  if (!UUID.test(schoolId)) notFound();
  const school = (await listSchoolsForAdmin(admin)).find((s) => s.id === schoolId);
  if (!school) notFound();

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href="/admin/schools" className="text-sm text-text-soft hover:underline">
          Schools and cycles
        </Link>
        <h1 className="text-display-sm text-text">{school.name}</h1>
        <p className="text-sm text-text-soft">
          {school.slug} · {school.region}
        </p>
      </div>

      <Section title="Identity" id="identity">
        <p className="max-w-3xl text-sm text-text-soft">
          A pack needs the school&apos;s country, city and website. The website&apos;s host is also
          the allowlist for adding sources by URL.
        </p>
        <AdminForm
          action={`/api/admin/schools/${school.id}`}
          method="PATCH"
          submitLabel="Save identity"
          done="Identity saved"
          className="flex flex-col gap-3"
        >
          <div className="grid max-w-3xl gap-3 sm:grid-cols-[6rem_1fr_2fr]">
            <Field label="Country" hint="ISO code, e.g. US">
              <Input name="country" defaultValue={school.country ?? ""} maxLength={2} />
            </Field>
            <Field label="City">
              <Input name="city" defaultValue={school.city ?? ""} />
            </Field>
            <Field label="Website">
              <Input
                name="website"
                type="url"
                defaultValue={school.website ?? ""}
                placeholder="https://"
              />
            </Field>
          </div>
        </AdminForm>
      </Section>

      <Section title="Cycles" id="cycles">
        <AdminForm
          action={`/api/admin/schools/${school.id}/cycles`}
          submitLabel="Create cycle"
          done="Cycle created"
          className="flex flex-wrap items-end gap-3"
        >
          <Field label="New cycle" hint='Like "2027-28"'>
            <Input name="cycle" required pattern="\d{4}-\d{2}" className="w-32" />
          </Field>
        </AdminForm>

        {school.cycles.length === 0 ? (
          <p className="text-sm text-text-soft">No cycles yet for {school.shortName}.</p>
        ) : null}
        {school.cycles.map((cycle) => {
          const label = `${school.shortName} ${cycle.cycle}`;
          return (
            <div key={cycle.id} className="flex flex-col gap-3 border-t border-edge pt-3">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h3 className="text-base font-semibold text-text">{cycle.cycle}</h3>
                <span className="text-sm text-text-soft">
                  {cycle.publishedVersion
                    ? `Published version ${cycle.publishedVersion}`
                    : "Nothing published: applicants see Pack coming soon"}
                </span>
                <Link
                  href={`/admin/review/${cycle.id}`}
                  className="text-sm text-signal hover:underline"
                >
                  Review {label}
                </Link>
                <Link
                  href={`/admin/sources?school=${school.id}&cycle=${cycle.cycle}`}
                  className="text-sm text-signal hover:underline"
                >
                  Sources for {label}
                </Link>
              </div>
              <AdminForm
                action={`/api/admin/cycles/${cycle.id}`}
                method="PATCH"
                submitLabel="Save status"
                done="Status saved"
                variant="secondary"
                className="flex flex-wrap items-end gap-3"
              >
                <Field label="Status" hint="Publishing a pack makes a draft cycle live">
                  <Select name="status" defaultValue={cycle.status} className="w-40">
                    <option value="draft">Draft</option>
                    <option value="live">Live</option>
                    <option value="archived">Archived</option>
                  </Select>
                </Field>
              </AdminForm>
              <RoundsEditor cycleId={cycle.id} label={label} rounds={cycle.rounds} />
            </div>
          );
        })}
      </Section>
    </>
  );
}
