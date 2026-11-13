// Server-safe. The one inline script the redesign adds to every page (SPEC §2.10).
//
// Entrances start from a hidden state, and a hidden state must never be server-rendered: if the
// script that would reveal it fails, the page stays blank. So markup renders visible, and this
// script, inlined in <head> with the CSP nonce, sets <html data-motion="on"> before first paint
// unless the visitor prefers reduced motion. The `enter` and `draw-line` utilities (render.css)
// only have a start state under that attribute, and they are keyframe animations with
// fill-mode both, so once started they finish with no further JS. No JS: no attribute,
// everything simply visible.

export const MOTION_ATTRIBUTE_SCRIPT =
  '(function(){try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.setAttribute("data-motion","on")}catch(e){}})()';
