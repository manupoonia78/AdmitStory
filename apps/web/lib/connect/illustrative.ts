// The faces of Connect (Manu, 2026-11-04): stock portraits that show the kinds of people a
// school pack connects you with, so the promise reads as people rather than a feature list.
// They are NOT people in the directory, and nothing here may be presented as a real alum,
// student or reader: no names, no schools, and ILLUSTRATIVE_NOTE wherever they appear.
//
// Photos: Unsplash (free licence, no attribution required), cropped to 400×500 WebP and served
// from public/people. Source ids are kept so each can be traced back.

export interface IllustrativePerson {
  src: string;
  role: string;
  /** What someone like this helps with. */
  line: string;
  /** images.unsplash.com photo id. */
  unsplash: string;
}

export const ILLUSTRATIVE_NOTE =
  "Photos are illustrative. Once you unlock a school, you’re matched with real people from it.";

export const ILLUSTRATIVE_PEOPLE: readonly IllustrativePerson[] = [
  {
    src: "/people/p01.webp",
    role: "Alum · admissions reader",
    line: "Reads your why-school before you send it",
    unsplash: "1494790108377-be9c29b29330",
  },
  {
    src: "/people/p02.webp",
    role: "Second-year student",
    line: "What the first semester is really like",
    unsplash: "1579420593648-0deba81fd762",
  },
  {
    src: "/people/p03.webp",
    role: "Alum · career switcher",
    line: "Consulting to product, and the essay that explained it",
    unsplash: "1573496358961-3c82861ab8f4",
  },
  {
    src: "/people/p04.webp",
    role: "Admissions committee",
    line: "What a reader notices in the first minute",
    unsplash: "1629425733761-caae3b5f2e50",
  },
  {
    src: "/people/p05.webp",
    role: "Current student · club lead",
    line: "Which clubs help with recruiting",
    unsplash: "1758600587839-56ba05596c69",
  },
  {
    src: "/people/p06.webp",
    role: "Alum · reapplicant",
    line: "What changed between two applications",
    unsplash: "1500648767791-00dcc994a43e",
  },
  {
    src: "/people/p07.webp",
    role: "Alum · interviewer",
    line: "How the alumni interview actually goes",
    unsplash: "1573497019940-1c28c88b4f3e",
  },
  {
    src: "/people/p08.webp",
    role: "First-year student",
    line: "Scholarships, and how to ask for one",
    unsplash: "1595211877493-41a4e5f236b3",
  },
  {
    src: "/people/p09.webp",
    role: "Alum · international applicant",
    line: "Visas, moving, and writing in a second language",
    unsplash: "1609371497456-3a55a205d5eb",
  },
  {
    src: "/people/p10.webp",
    role: "Admissions committee",
    line: "How the committee reads a résumé",
    unsplash: "1780732997580-df3992363434",
  },
  {
    src: "/people/p11.webp",
    role: "Alum · finance",
    line: "Banking recruiting from week one",
    unsplash: "1685760259914-ee8d2c92d2e0",
  },
  {
    src: "/people/p12.webp",
    role: "Current student",
    line: "Why they chose this school over the others",
    unsplash: "1770510067230-1059f0776b3a",
  },
];
