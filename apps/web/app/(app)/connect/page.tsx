import {
  getDb,
  listApplicantThreads,
  listConnectSchools,
  listGuideThreads,
  searchConnectPeople,
} from "@admitstory/db";
import type { Metadata } from "next";
import { requireOnboardedUser } from "@/lib/app-user";
import { connectAccess, personDto, threadDto } from "@/lib/connect/server";
import { ConnectHost } from "./connect-host";
import { ConnectLocked } from "./connect-locked";

export const metadata: Metadata = { title: "Connect" };

// Connect (Manu, 2026-11-04). With a school pack: search alumni, current students and admissions
// readers from any school, and message them; the ones who work with us answer in the app, and
// for everyone else the first message is an intro our team arranges. Without a pack the
// directory stays hidden and the page says what a pack brings. Guides (people who answer for
// someone in the directory) see their conversations here too.
export default async function Page() {
  const { session } = await requireOnboardedUser();
  const userId = session.user.id;
  const access = await connectAccess(userId);
  if (!access.unlocked && !access.guide) return <ConnectLocked />;

  const db = getDb();
  const [mine, answering, people, schools] = await Promise.all([
    access.unlocked ? listApplicantThreads(db, userId) : [],
    access.guide ? listGuideThreads(db, userId) : [],
    access.unlocked ? searchConnectPeople(db, { preferSchoolIds: access.unlockedSchoolIds }) : [],
    access.unlocked ? listConnectSchools(db) : [],
  ]);
  const threads = [
    ...mine.map((thread) => threadDto(thread, "applicant")),
    ...answering.map((thread) => threadDto(thread, "person")),
  ].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));

  return (
    <ConnectHost
      canSearch={access.unlocked}
      initialThreads={threads}
      initialPeople={people.map(personDto)}
      schools={schools.map((school) => ({
        id: school.id,
        name: school.shortName || school.name,
        people: school.people,
        yours: access.unlockedSchoolIds.includes(school.id),
      }))}
    />
  );
}
