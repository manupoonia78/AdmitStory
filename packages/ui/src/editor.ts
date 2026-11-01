// `@admitstory/ui/editor`: the Workspace's TipTap document canvas (spec §5.8, screen G) and its
// draft ⇄ document model. A separate entry so TipTap is only ever loaded through next/dynamic.

export { DocCanvas, type DocCanvasProps, type DocEdit } from "./workspace/doc-canvas/doc-canvas";
export {
  DIFF_MORPH_MARK,
  NEED_CHIP_NODE,
  PARAGRAPH_NODE,
  YOUR_WORDS_MARK,
  changedParagraphIds,
  docToDraft,
  draftToDoc,
  newParagraphId,
  reviewToDoc,
  sameDraft,
  type DocJson,
  type DraftContent,
  type ParagraphReview,
  type ReviewChange,
} from "./workspace/doc-model";
