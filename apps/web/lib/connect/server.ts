import "server-only";

import {
  getDb,
  isConnectGuide,
  listUnlockedSchoolIds,
  type ConnectMessageRow,
  type ConnectPerson,
  type ConnectSide,
  type ConnectThreadSummary,
} from "@admitstory/db";
import { ApiError } from "@/lib/api-error";
import type { ConnectMessageDto, ConnectPersonDto, ConnectThreadDto } from "./types";

// Who may use Connect (Manu, 2026-11-04): anyone who has unlocked a school pack, and the guides
// who answer for people in the directory. Everyone else sees the locked page, which says what a
// pack brings and never shows the directory.

/** New conversations an applicant can start in 24 hours: each is an ask of a real person's time. */
export const CONNECT_NEW_THREADS_PER_DAY = 10;
export const CONNECT_MESSAGE_MAX = 4000;

export interface ConnectAccess {
  /** Holds at least one school pack. */
  unlocked: boolean;
  /** The schools they hold a pack for; those sort first in the directory. */
  unlockedSchoolIds: string[];
  /** Answers for someone in the directory. */
  guide: boolean;
}

export async function connectAccess(userId: string): Promise<ConnectAccess> {
  const db = getDb();
  const [unlockedSchoolIds, guide] = await Promise.all([
    listUnlockedSchoolIds(db, userId),
    isConnectGuide(db, userId),
  ]);
  return { unlocked: unlockedSchoolIds.length > 0, unlockedSchoolIds, guide };
}

/** The 402 for an account with no pack; the client branches on `code`. */
export async function requireConnect(userId: string): Promise<ConnectAccess> {
  const access = await connectAccess(userId);
  if (!access.unlocked && !access.guide)
    throw new ApiError(
      402,
      "Connect comes with a school pack. Unlock a school to meet people from it.",
      undefined,
      "connect_locked",
    );
  return access;
}

export function personDto(person: ConnectPerson): ConnectPersonDto {
  return {
    id: person.id,
    fullName: person.fullName,
    relation: person.relation,
    classYear: person.classYear,
    headline: person.headline,
    location: person.location,
    bio: person.bio,
    topics: person.topics,
    photoUrl: person.photoUrl,
    linkedinUrl: person.linkedinUrl,
    guide: person.guide,
    school: { id: person.school.id, name: person.school.name, shortName: person.school.shortName },
  };
}

export function threadDto(thread: ConnectThreadSummary, side: ConnectSide): ConnectThreadDto {
  return {
    id: thread.id,
    status: thread.status,
    side,
    person: personDto(thread.person),
    applicantName: thread.applicantName,
    lastMessage: thread.lastMessage
      ? { body: thread.lastMessage.body.slice(0, 160), mine: thread.lastMessage.author === side }
      : null,
    lastMessageAt: thread.lastMessageAt.toISOString(),
    unread: thread.unread,
  };
}

export function messageDto(message: ConnectMessageRow, side: ConnectSide): ConnectMessageDto {
  return {
    id: message.id,
    mine: message.author === side,
    author: message.author,
    body: message.body,
    at: message.createdAt.toISOString(),
  };
}
