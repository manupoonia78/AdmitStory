"use client";

import { Button, FieldErrorRegion, focusFirstInvalid } from "@admitstory/ui";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { AlertMessage } from "@/components/live-message";
import { confirmWelcome, type WelcomeState } from "./actions";

const INITIAL: WelcomeState = { errors: {}, values: { age: false, terms: false } };

function Checkbox({
  name,
  error,
  defaultChecked,
  children,
}: {
  name: string;
  error?: string | undefined;
  defaultChecked: boolean;
  children: ReactNode;
}) {
  const errorId = `${name}-error`;
  return (
    <div className="flex flex-col">
      <label className="flex min-h-11 cursor-pointer items-center gap-4 text-text">
        <input
          type="checkbox"
          name={name}
          value="yes"
          required
          // React resets an action form once the action returns; the defaults are the choices
          // from that submit, so a validation error never clears a box the person ticked.
          defaultChecked={defaultChecked}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="room-check"
        />
        <span>{children}</span>
      </label>
      <FieldErrorRegion id={errorId} error={error} className="pl-10" />
    </div>
  );
}

export function WelcomeForm() {
  const [state, action, pending] = useActionState(confirmWelcome, INITIAL);
  const { errors, values } = state;
  const formRef = useRef<HTMLFormElement>(null);

  // After a failed submit, move focus to the first unticked box: the screen reader reads its
  // label, "invalid" and the error with it (WCAG 3.3.1). Each submit returns a new state object.
  useEffect(() => {
    if (state.errors.age || state.errors.terms) focusFirstInvalid(formRef.current);
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="welcome-form card flex flex-col gap-7 p-6 sm:p-8"
      noValidate
    >
      <p className="label">Two things first</p>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-title text-text">Your age</legend>
        <Checkbox name="age" error={errors.age} defaultChecked={values.age}>
          I’m 18 or older.
        </Checkbox>
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-t border-edge pt-7">
        <legend className="float-left mb-2 w-full text-title text-text">
          How we work together
        </legend>
        <ul className="clear-left border-b border-edge text-text-80">
          <li className="border-t border-edge py-3">
            I’ll describe my own experiences, truthfully.
          </li>
          <li className="border-t border-edge py-3">
            I’m responsible for following each school’s rules, including its rules on AI.
          </li>
          <li className="border-t border-edge py-3">
            My recommenders will write their own letters.
          </li>
        </ul>
        <Checkbox name="terms" error={errors.terms} defaultChecked={values.terms}>
          I agree to these commitments.
        </Checkbox>
      </fieldset>

      <div className="flex flex-col">
        <Button type="submit" arrow loading={pending} className="welcome-submit self-start">
          {pending ? "Saving your answers" : "Agree and continue"}
        </Button>
        <AlertMessage message={errors.form} className="not-empty:mt-4" />
      </div>
    </form>
  );
}
