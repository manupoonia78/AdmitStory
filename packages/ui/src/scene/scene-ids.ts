// Which studio object each area of the app shows (studio-scene.ts). Kept tiny and free of WebGL
// so the scene host can import it into every route's first load.

export const SCENES = {
  orb: 0,
  voice: 1,
  stack: 2,
  cards: 3,
  twist: 4,
  trio: 5,
  pill: 6,
  portal: 7,
  cog: 8,
} as const;

export type SceneId = keyof typeof SCENES;

const ROUTES: readonly [prefix: string, scene: SceneId][] = [
  ["/studio", "voice"],
  ["/schools", "stack"],
  ["/kits", "twist"],
  ["/workspace", "twist"],
  ["/dossier", "cards"],
  ["/profile-read", "cards"],
  ["/resume", "cards"],
  ["/recommenders", "trio"],
  ["/connect", "trio"],
  ["/interview", "pill"],
  ["/tracker", "pill"],
  ["/settings", "cog"],
  ["/admin", "cog"],
  ["/sign-in", "portal"],
  ["/welcome", "portal"],
  ["/first-run", "voice"],
  ["/goodbye", "portal"],
  ["/r/", "trio"],
];

export function sceneForPath(pathname: string): SceneId {
  for (const [prefix, scene] of ROUTES) if (pathname.startsWith(prefix)) return scene;
  return "orb";
}
