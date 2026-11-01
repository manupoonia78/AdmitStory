"use client";

import {
  CaretDownIcon,
  CheckCircleIcon,
  ClipboardTextIcon,
  ExportIcon,
  FileDocIcon,
  FilePdfIcon,
} from "@phosphor-icons/react";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { buttonStyles } from "../components/button-styles";
import { cx } from "../lib/cx";
import { countFor, portalText, type CountRule } from "./portal-text";

export type ExportFormat = "docx" | "pdf";

export interface ExportMenuProps {
  /** The draft as plain text, paragraphs separated by blank lines (`draftText`). */
  text: string;
  /** The prompt's limit and how the school counts it. */
  rule: CountRule;
  /** Start a DOCX or PDF export (the server renders it; exports are deleted after 24 h). */
  onExport: (format: ExportFormat) => void;
  /** "Mark final" (spec §5.8). Omit to hide it. */
  onMarkFinal?: () => void;
  final?: boolean;
  /** Called with what was copied, after "Copy for portal". */
  onCopied?: (copied: { text: string; count: number; over: number }) => void;
  className?: string;
}

/** What "Copy for portal" says afterwards, with the count checked on exactly what was copied. */
export function copiedMessage(count: number, rule: CountRule): string {
  const unit = rule.unit === "words" ? "words" : "characters";
  const over = count - rule.limit;
  if (over > 0) {
    return `Copied, but it's ${over} ${over === 1 ? unit.replace(/s$/u, "") : unit} over the limit. The portal may cut it.`;
  }
  return `Copied for the portal: ${count} / ${rule.limit} ${unit}, counted the way the school counts.`;
}

const ITEM =
  "flex min-h-11 cursor-default select-none items-center gap-2 rounded-control px-3 text-base text-text outline-none " +
  "data-[highlighted]:bg-veil data-[disabled]:opacity-60";

/**
 * Export (spec §5.8): Copy for portal (plain text, smart quotes straightened, count verified),
 * DOCX, PDF, and Mark final. A menu button; the result of a copy is announced.
 */
export function ExportMenu({
  text,
  rule,
  onExport,
  onMarkFinal,
  final = false,
  onCopied,
  className,
}: ExportMenuProps) {
  const [status, setStatus] = useState("");

  const copy = async () => {
    const plain = portalText(text);
    const count = countFor(plain, rule);
    try {
      await navigator.clipboard.writeText(plain);
      setStatus(copiedMessage(count, rule));
      onCopied?.({ text: plain, count, over: Math.max(0, count - rule.limit) });
    } catch {
      setStatus("Your browser blocked copying. Select the draft and copy it instead.");
    }
  };

  return (
    <div className={cx("flex flex-col items-end gap-1", className)}>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className={buttonStyles({ variant: "secondary" })}>
          <ExportIcon size={20} aria-hidden />
          Export
          <CaretDownIcon size={16} aria-hidden />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="plane z-50 flex min-w-56 flex-col p-1 font-ui shadow-overlay"
          >
            <DropdownMenu.Item className={ITEM} onSelect={() => void copy()}>
              <ClipboardTextIcon size={20} aria-hidden />
              Copy for portal
            </DropdownMenu.Item>
            <DropdownMenu.Item className={ITEM} onSelect={() => onExport("docx")}>
              <FileDocIcon size={20} aria-hidden />
              Download DOCX
            </DropdownMenu.Item>
            <DropdownMenu.Item className={ITEM} onSelect={() => onExport("pdf")}>
              <FilePdfIcon size={20} aria-hidden />
              Download PDF
            </DropdownMenu.Item>
            {onMarkFinal ? (
              <>
                <DropdownMenu.Separator className="my-1 h-px bg-edge" />
                <DropdownMenu.Item className={ITEM} disabled={final} onSelect={onMarkFinal}>
                  <CheckCircleIcon
                    size={20}
                    aria-hidden
                    className={final ? "text-verified" : undefined}
                  />
                  {final ? "Marked final" : "Mark final"}
                </DropdownMenu.Item>
              </>
            ) : null}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <p aria-live="polite" className="min-h-[1lh] max-w-[40ch] text-right text-sm text-text-soft">
        {status}
      </p>
    </div>
  );
}
