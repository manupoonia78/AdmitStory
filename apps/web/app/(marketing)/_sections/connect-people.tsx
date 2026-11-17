// Scene 7 (SPEC §4): Connect. Every school pack comes with people from that school. The claim and
// the three kinds of people on the left; on the right a still grid of six illustrative portraits,
// each with a role and nothing else: never a name, never a school. They are stock portraits and
// the line under the grid says so. Server markup, no script.

import type { CSSProperties } from "react";
import { ILLUSTRATIVE_NOTE, ILLUSTRATIVE_PEOPLE } from "@/lib/connect/illustrative";
import { CONNECT_COPY } from "../_copy/landing";
import { TEXT_LINK } from "../_ui/cta-link";
import { SceneHead } from "../_ui/scene-head";
import { Section } from "../_ui/section";
import Link from "next/link";

const FACES = ILLUSTRATIVE_PEOPLE.slice(0, 6);

export function ConnectPeopleSection() {
  return (
    <Section id="connect" labelledBy="connect-title">
      <div className="reveal col-span-4 sm:col-span-8 lg:col-span-5">
        <SceneHead
          id="connect-title"
          eyebrow={CONNECT_COPY.eyebrow}
          lines={CONNECT_COPY.headingLines}
        />
        <p className="mt-6 max-w-[440px] text-lg text-text-soft">{CONNECT_COPY.paragraph}</p>
        <ul
          role="list"
          aria-label={CONNECT_COPY.pointsLabel}
          className="mt-10 max-w-[480px] divide-y divide-edge border-y border-edge"
        >
          {CONNECT_COPY.points.map((point) => (
            <li key={point.figure} className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-4 py-4">
              <span className="label pt-1">{point.figure}</span>
              <span className="text-base text-text-80">{point.line}</span>
            </li>
          ))}
        </ul>
        <Link href="/pricing" className={`${TEXT_LINK} mt-4`}>
          {CONNECT_COPY.link}
        </Link>
      </div>
      <div className="col-span-4 mt-14 sm:col-span-8 lg:col-span-6 lg:col-start-7 lg:mt-0">
        <ul role="list" className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {FACES.map((person, index) => (
            <li key={person.src} className="reveal" style={{ "--i": index } as CSSProperties}>
              {/* Already 400×500 WebP and lazy; next/image would only add a hop. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={person.src}
                alt=""
                width={400}
                height={500}
                loading="lazy"
                decoding="async"
                className="aspect-[4/5] w-full rounded-card bg-depth object-cover brightness-90 grayscale"
              />
              <p className="label mt-3">{person.role}</p>
            </li>
          ))}
        </ul>
        <p className="label mt-8 border-t border-edge pt-5">{CONNECT_COPY.illustrative}</p>
        <p className="mt-2 text-sm text-text-soft">{ILLUSTRATIVE_NOTE}</p>
      </div>
    </Section>
  );
}
