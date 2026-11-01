import { countInterestVotes, listSchoolsForAdmin } from "@admitstory/db";
import { StatusLabel } from "@admitstory/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/guard";
import { formatDate, table } from "../_components/fields";

export const metadata: Metadata = { title: "Schools and cycles" };

const STANCE: Record<string, string> = {
  permitted: "Permitted",
  permitted_with_disclosure: "With disclosure",
  limited: "Limited",
  prohibited: "Prohibited",
  unknown: "Unknown",
};

export default async function SchoolsPage() {
  const admin = await requireAdminPage();
  const [schools, votes] = await Promise.all([
    listSchoolsForAdmin(admin),
    countInterestVotes(admin),
  ]);
  const votesBySchool = new Map(votes.map((v) => [v.schoolId, v.votes] as const));

  return (
    <>
      <h1 className="text-display-sm text-text">Schools and cycles</h1>
      <p className="max-w-3xl text-sm text-text-soft">
        A school can be bought once a pack version is published for its cycle. Open a cycle to
        review proposals and publish; votes are applicants asking for a pack.
      </p>
      <div className={table.wrap}>
        <table className={table.table}>
          <caption className="sr-only">Schools, their cycles and pack versions</caption>
          <thead>
            <tr>
              <th scope="col" className={table.th}>
                School
              </th>
              <th scope="col" className={table.th}>
                Cycle
              </th>
              <th scope="col" className={table.th}>
                Status
              </th>
              <th scope="col" className={`${table.th} ${table.num}`}>
                Draft
              </th>
              <th scope="col" className={`${table.th} ${table.num}`}>
                Published
              </th>
              <th scope="col" className={table.th}>
                Published on
              </th>
              <th scope="col" className={table.th}>
                AI policy
              </th>
              <th scope="col" className={`${table.th} ${table.num}`}>
                Votes
              </th>
              <th scope="col" className={table.th}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {schools.flatMap((school) => {
              const cycles = school.cycles.length > 0 ? school.cycles : [null];
              return cycles.map((cycle, index) => (
                <tr key={`${school.id}-${cycle?.id ?? "none"}`}>
                  <th scope="row" className={`${table.td} font-medium`}>
                    {index === 0 ? (
                      <Link href={`/admin/schools/${school.id}`} className="hover:underline">
                        {school.name}
                      </Link>
                    ) : (
                      <span className="sr-only">{school.name}</span>
                    )}
                  </th>
                  <td className={table.td}>{cycle?.cycle ?? "No cycle"}</td>
                  <td className={table.td}>{cycle ? cycle.status : ""}</td>
                  <td className={`${table.td} ${table.num}`}>
                    {cycle?.draftVersion ? `v${cycle.draftVersion}` : ""}
                  </td>
                  <td className={`${table.td} ${table.num}`}>
                    {cycle?.publishedVersion ? `v${cycle.publishedVersion}` : "None"}
                  </td>
                  <td className={table.td}>
                    {cycle?.publishedAt ? formatDate(cycle.publishedAt) : ""}
                  </td>
                  <td className={table.td}>
                    {cycle?.aiStance ? (
                      <StatusLabel tone={cycle.aiPolicyVerifiedAt ? "verified" : "needs"}>
                        {STANCE[cycle.aiStance]}
                        {cycle.aiPolicyVerifiedAt ? ", verified" : ", unverified"}
                      </StatusLabel>
                    ) : (
                      ""
                    )}
                  </td>
                  <td className={`${table.td} ${table.num}`}>
                    {index === 0 ? (votesBySchool.get(school.id) ?? 0) : ""}
                  </td>
                  <td className={table.td}>
                    {cycle ? (
                      <Link
                        href={`/admin/review/${cycle.id}`}
                        className="whitespace-nowrap text-signal hover:underline"
                      >
                        Review {school.shortName} {cycle.cycle}
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
