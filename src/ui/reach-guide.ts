import { icon } from "./shell";

// Nested SVG viewports require explicit dimensions in SVG coordinates.
const hand = icon.hand.replace("<svg ", '<svg width="38" height="42" ');

/** A mirrored camera diagram: screen-left is the player's left. */
export function reachGuide(direction: "left" | "right"): string {
  const left = direction === "left";
  return `<figure class="reach-guide" data-direction="${direction}">
    <svg viewBox="0 0 360 132" role="img" aria-label="Move your hand toward the ${direction} side of the mirrored camera view, then hold still." focusable="false">
      <rect x="3" y="3" width="354" height="126" rx="14" fill="#071723" stroke="#426375" stroke-width="2"/>
      <circle cx="180" cy="16" r="3" fill="#7896a7"/>
      <path d="M180 30v83" stroke="#7896a7" stroke-opacity=".3" stroke-dasharray="4 5"/>
      <rect x="${left ? 24 : 228}" y="28" width="108" height="90" rx="10" fill="currentColor" fill-opacity=".1" stroke="currentColor" stroke-opacity=".65"/>
      <g transform="translate(156 35) scale(1.25)" color="#7896a7" opacity=".4">${hand}</g>
      <path d="${left ? "M149 63H127m9-9-9 9 9 9" : "M211 63h22m-9-9 9 9-9 9"}" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <g transform="translate(${left ? 54 : 258} 35) scale(1.25)">${hand}</g>
      <text x="78" y="109" text-anchor="middle" fill="${left ? "currentColor" : "#7896a7"}">LEFT</text>
      <text x="282" y="109" text-anchor="middle" fill="${left ? "#7896a7" : "currentColor"}">RIGHT</text>
    </svg>
    <figcaption>Your camera view works like a mirror.</figcaption>
  </figure>`;
}
