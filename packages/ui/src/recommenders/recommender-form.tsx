"use client";

// Add or edit a recommender (§5.11): who they are to you, how long and how often they have seen
// your work, and which schools they write for. Suggestions come from the Dossier, so the people
// already in your stories are one tap away.
//
// The email address is where the private link goes, and it is the only place it ever goes. The
// applicant's own address is refused by the route (plan decision 7).

import type { Relationship } from "@admitstory/shared/kit";
import { RELATIONSHIPS, RELATIONSHIP_LABELS } from "@admitstory/shared/kit";
import { useId, useState } from "react";
import { Button } from "../components/button";
import { TextField } from "../components/text-field";
import { cx } from "../lib/cx";

export interface RecommenderFormValues {
  name: string;
  email: string;
  title: string;
  organisation: string;
  relationship: Relationship;
  durationText: string;
  frequencyText: string;
  userSchoolIds: string[];
}

export interface RecommenderFormProps {
  schools: readonly { userSchoolId: string; name: string; needed: number | null; paid: boolean }[];
  suggestions?: readonly { name: string; role: string }[];
  initial?: Partial<RecommenderFormValues>;
  submitLabel: string;
  onSubmit: (values: RecommenderFormValues) => void;
  working?: boolean;
  error?: string | null;
  className?: string;
}

const EMPTY: RecommenderFormValues = {
  name: "",
  email: "",
  title: "",
  organisation: "",
  relationship: "manager",
  durationText: "",
  frequencyText: "",
  userSchoolIds: [],
};

export function RecommenderForm({
  schools,
  suggestions = [],
  initial,
  submitLabel,
  onSubmit,
  working = false,
  error = null,
  className,
}: RecommenderFormProps) {
  const [values, setValues] = useState<RecommenderFormValues>({ ...EMPTY, ...initial });
  const relationshipId = useId();
  const set = <K extends keyof RecommenderFormValues>(key: K, value: RecommenderFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const toggleSchool = (id: string) =>
    setValues((current) => ({
      ...current,
      userSchoolIds: current.userSchoolIds.includes(id)
        ? current.userSchoolIds.filter((other) => other !== id)
        : [...current.userSchoolIds, id],
    }));

  return (
    <form
      className={cx("flex flex-col gap-5", className)}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
    >
      {suggestions.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-text-soft">People in your stories</p>
          <ul className="flex flex-wrap gap-2">
            {suggestions.map((person) => (
              <li key={`${person.name}-${person.role}`}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    set("name", person.name);
                    if (!values.title) set("title", person.role);
                  }}
                >
                  {person.name}, {person.role}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <TextField
        label="Their name"
        value={values.name}
        required
        autoComplete="off"
        onChange={(event) => set("name", event.target.value)}
      />
      <TextField
        label="Their email"
        type="email"
        value={values.email}
        required
        autoComplete="off"
        hint="Their private page is sent here, and only here."
        onChange={(event) => set("email", event.target.value)}
      />
      <TextField
        label="Their job title"
        value={values.title}
        autoComplete="off"
        onChange={(event) => set("title", event.target.value)}
      />
      <TextField
        label="Where they work"
        value={values.organisation}
        autoComplete="off"
        onChange={(event) => set("organisation", event.target.value)}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor={relationshipId} className="text-base font-medium text-text">
          What they are to you
        </label>
        <select
          id={relationshipId}
          value={values.relationship}
          onChange={(event) => set("relationship", event.target.value as Relationship)}
          className="min-h-11 w-full rounded-control border border-control bg-depth px-3 text-lg text-text sm:text-base"
        >
          {RELATIONSHIPS.map((relationship) => (
            <option key={relationship} value={relationship}>
              {RELATIONSHIP_LABELS[relationship]}
            </option>
          ))}
        </select>
      </div>

      <TextField
        label="How long they have known your work"
        value={values.durationText}
        autoComplete="off"
        hint="In your own words: “three years”, “since 2023”."
        onChange={(event) => set("durationText", event.target.value)}
      />
      <TextField
        label="How often you work together"
        value={values.frequencyText}
        autoComplete="off"
        hint="“Daily”, “a few times a month”."
        onChange={(event) => set("frequencyText", event.target.value)}
      />

      {schools.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-base font-medium text-text">Which schools they write for</legend>
          <ul className="flex flex-wrap gap-2">
            {schools.map((school) => {
              const on = values.userSchoolIds.includes(school.userSchoolId);
              return (
                <li key={school.userSchoolId}>
                  <label
                    className={cx(
                      "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border px-3",
                      on ? "border-signal bg-veil text-text" : "border-control text-text",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleSchool(school.userSchoolId)}
                      className="size-4 accent-[var(--signal)]"
                    />
                    <span>{school.name}</span>
                    {school.needed !== null ? (
                      <span className="text-sm tabular-nums text-text-soft">
                        needs {school.needed}
                      </span>
                    ) : null}
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm font-medium text-risk">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={working} className="self-start">
        {working ? "Saving" : submitLabel}
      </Button>
    </form>
  );
}
