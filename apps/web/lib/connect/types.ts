// Connect's wire shapes (lib/connect/server.ts makes them; the /connect screen reads them).
// Client-safe: types and two small pure helpers, no server code.

export type ConnectRelationDto = "alum" | "student" | "adcom";

export interface ConnectPersonDto {
  id: string;
  fullName: string;
  relation: ConnectRelationDto;
  classYear: number | null;
  headline: string;
  location: string | null;
  bio: string;
  topics: string[];
  photoUrl: string | null;
  linkedinUrl: string | null;
  /** Works with us: answers in the app. Everyone else is an intro our team arranges. */
  guide: boolean;
  school: { id: string; name: string; shortName: string };
}

export interface ConnectThreadDto {
  id: string;
  status: "requested" | "open" | "closed";
  /** Which side the viewer is on: the applicant, or the guide answering for the person. */
  side: "applicant" | "person";
  person: ConnectPersonDto;
  /** For the guide's side: who wrote in. */
  applicantName: string | null;
  lastMessage: { body: string; mine: boolean } | null;
  lastMessageAt: string;
  unread: boolean;
}

export interface ConnectMessageDto {
  id: string;
  /** Written by the viewer. */
  mine: boolean;
  author: "applicant" | "person" | "team";
  body: string;
  at: string;
}

export const RELATION_LABEL: Record<ConnectRelationDto, string> = {
  alum: "Alum",
  student: "Current student",
  adcom: "Admissions committee",
};

/** "Alum · Wharton ’19", "Current student · Kellogg ’27", "Admissions committee · HEC Paris". */
export function personLine(person: Pick<ConnectPersonDto, "relation" | "classYear" | "school">) {
  const year = person.classYear ? ` ’${String(person.classYear).slice(-2)}` : "";
  return `${RELATION_LABEL[person.relation]} · ${person.school.shortName}${year}`;
}
