// The attribute that ties a transcript segment to the story found in it. LiveTranscript puts it on
// each segment; the story-capture flight starts from the element carrying the matching id.
export const CAPTURE_SOURCE_ATTRIBUTE = "data-capture-source";

export function findCaptureSource(id: string, root: ParentNode = document): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[${CAPTURE_SOURCE_ATTRIBUTE}="${CSS.escape(id)}"]`);
}
