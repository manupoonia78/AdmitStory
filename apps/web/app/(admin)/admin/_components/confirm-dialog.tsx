"use client";

import { Button, Dialog, DialogClose, DialogContent, DialogTrigger } from "@admitstory/ui";
import type { ReactNode } from "react";

// The confirm step of a destructive admin action (direction doc, M). Its own module, loaded with
// next/dynamic by ActionButton, so the dialog's code isn't in an admin page's first load (§6.11).

export function ConfirmDialog({
  open,
  onOpenChange,
  trigger,
  title,
  body,
  label,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  title: string;
  body: string;
  label: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={title} description={body}>
        <div className="mt-4 flex justify-end gap-2">
          <DialogClose asChild>
            <Button type="button" size="sm" variant="quiet">
              Keep it
            </Button>
          </DialogClose>
          <Button type="button" size="sm" variant="danger" onClick={onConfirm}>
            {label}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
