"use client";

// The things that open over the page: dialog, side sheet, tooltip, toast. They render in a
// portal on <body>, so they take the page's theme, not the panel's.

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  Sheet,
  SheetContent,
  SheetTrigger,
  TextField,
  ToastProvider,
  Tooltip,
  useToast,
} from "@admitstory/ui";

function ToastButton() {
  const { toast } = useToast();
  return (
    <Button
      variant="secondary"
      onClick={() =>
        toast({ title: "Draft saved", description: "Version 4, 412 words. Nothing was sent." })
      }
    >
      Show a toast
    </Button>
  );
}

export function Overlays() {
  return (
    <ToastProvider>
      <div className="flex flex-wrap items-center gap-3">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Open a dialog</Button>
          </DialogTrigger>
          <DialogContent
            title="Rename this version"
            description="The name is only for you. Schools never see it."
          >
            <TextField label="Version name" defaultValue="After the Nashik rewrite" />
            <div className="flex justify-end gap-3">
              <DialogClose asChild>
                <Button variant="quiet">Cancel</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button>Save name</Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary">Open a side sheet</Button>
          </SheetTrigger>
          <SheetContent
            title="Why this draft opens here"
            description="The reasoning behind the first paragraph."
          >
            <p className="note">
              Leads with the forty minutes, not the job title. Northfield asks for a decision made
              without cover; this is the clearest one in your story.
            </p>
          </SheetContent>
        </Sheet>

        <Tooltip content="Hover labels in the app are drawn in CSS; this one is the Radix tooltip.">
          <Button variant="secondary">Hover for a tooltip</Button>
        </Tooltip>

        <ToastButton />
      </div>
    </ToastProvider>
  );
}
