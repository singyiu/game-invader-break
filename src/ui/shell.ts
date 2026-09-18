import { HUD_POWERS, POWER_LABELS } from "./power-labels";
import { powerIconSvg } from "../shared/power-art";
export const icon = {
  shield:
    '<svg viewBox="0 0 24 28" fill="none" aria-hidden="true"><path d="M12 2 22 6v8c0 5-10 12-10 12S2 19 2 14V6Z" fill="currentColor" fill-opacity=".1" stroke="currentColor" stroke-width="1.5"/><path d="m7 13 3 3 7-7" stroke="currentColor" stroke-width="1.5"/></svg>',
  camera:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="3" stroke="currentColor" stroke-width="1.5"/><path d="m16 10 5-3v10l-5-3" stroke="currentColor" stroke-width="1.5"/></svg>',
  arrow:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.5"/></svg>',
  hand: '<svg viewBox="0 0 38 42" fill="none" aria-hidden="true"><path d="M12 21V9c0-3 4-3 4 0v11-15c0-3 4-3 4 0v15-12c0-3 4-3 4 0v13-8c0-3 4-3 4 0v15c0 7-4 11-10 11-4 0-7-3-9-6L4 24c-2-4 1-6 4-3l4 4" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 25v6m4-10v10m4-10v10m4-9v9" stroke="currentColor" stroke-opacity=".35"/></svg>',
};
export function mountShell(root: HTMLElement): void {
  root.innerHTML = `
 <header class="site-header">
   <a class="brand" href="/" aria-label="Invader Break home"><svg viewBox="0 0 36 36" aria-hidden="true"><path d="M4 9h7V5h14v4h7v17h-7v-6H11v6H4zm8 2v5h4v-5zm8 0v5h4v-5z" fill="currentColor"/><path d="M8 31h20" stroke="currentColor" stroke-width="2"/></svg><span>INVADER<span class="brand-thin">BREAK</span></span></a>
   <div class="header-middle"><span class="tiny-cross">+</span> THE ARCADE, REIMAGINED <span class="tiny-cross">+</span></div>
   <div class="header-status"><span class="status-dot"></span><span id="header-status">SYSTEM ONLINE</span><span class="version">VOL. 01</span></div>
 </header>
 <main class="main-layout">
  <section class="hero" id="hero">
   <div class="eyebrow"><span class="line"></span> MOTION CONTROLLED ARCADE</div>
   <h1 aria-label="Invader Break">INVADER<br/><span>BREAK<span class="title-period">.</span></span></h1>
   <p class="hero-tagline">Your hands. Earth's last defense.</p>
   <p class="hero-copy">Break their formation. Catch a superpower.<br/>An endless arcade invasion, controlled by you.</p>
   <button class="primary-button" id="enable-camera">${icon.camera}<span>Enable camera & play</span>${icon.arrow}</button>
   <p class="bootstrap-note">No controller. No download. Just your hands.</p>
   <details class="privacy-details"><summary><span class="lock-dot"></span> Your camera stays yours <span>+</span></summary><p>Video is processed on your device. We never record or upload camera images or hand landmarks. No microphone is requested. The hand-tracking SDK's <a href="https://developers.google.com/edge/mediapipe/solutions/tasks#mediapipe_tasks_privacy_notice" target="_blank" rel="noreferrer">privacy notice</a> describes usage metrics; this build restricts network access to this site's own origin.</p></details>
   <div class="hero-foot"><span>BUILT FOR YOUR BROWSER</span><span>ONE OR TWO HANDS <b>↗</b></span></div>
  </section>
  <section class="game-column" aria-label="Game arena">
   <div class="arena-topline"><span><i class="status-dot"></i><span id="arena-label">LIVE ARENA PREVIEW</span></span><span id="sector-label">01 / BROKEN ORBIT</span><span class="arena-coords">DEFENSE GRID · 07</span></div>
   <div class="arena-wrap" id="arena-wrap">
    <canvas id="arena" aria-label="Invader Break 3D arena"></canvas>
    <div class="arena-vignette"></div>
    <div class="hud" id="hud">
      <div class="shield-hud"><span class="micro-label">ENERGY SHIELDS</span><div class="shields" id="shields">${icon.shield.repeat(3)}</div></div>
      <div class="wave-hud"><span class="micro-label" id="wave-label">LEVEL 01</span><span id="phase-name">BROKEN ORBIT</span></div>
      <div class="score-hud"><span class="micro-label">SCORE <span id="combo">1.00×</span></span><strong id="score">000000</strong><span class="hand-bonus" id="hand-bonus" hidden>2 HANDS · 1.5× POINTS</span></div>
    </div>
    <div class="overdrive-meter"><span id="charge-label">OVERDRIVE</span><div id="charge-segments">${"<i></i>".repeat(5)}</div></div>
    <div class="power-hud" id="power-status" aria-label="Active superpowers" hidden>${HUD_POWERS.map((kind) => `<div class="power-chip" data-power="${kind}" hidden>${powerIconSvg(kind)}<span>${POWER_LABELS[kind].short}</span><strong class="power-time">30s</strong></div>`).join("")}</div>
    <div class="arena-watermark" id="preview-label"><span class="preview-ring"></span> ATTRACT SEQUENCE <b>CAMERA OFF</b></div>
    <div class="rally-notice" id="rally-notice" aria-live="polite"></div>
    <div class="overlay" id="overlay" hidden></div>
    <div class="arena-corners"><i></i><i></i><i></i><i></i></div>
   </div>
   <div class="arena-bottomline"><span><span class="tracking-light" id="tracking-light"></span><span id="tracking-label">HAND TRACKING STANDBY</span></span><span id="mode-label">01 HAND → 01 PADDLE</span><span class="arena-coords">LOCAL INFERENCE</span></div>
  </section>
 </main>
 <section class="instruction-strip" id="instructions" aria-label="How to play">
  <div class="instruction"><span class="instruction-number">01</span><span class="instruction-icon">${icon.hand}</span><div><h2>Move your hand. Hold the line.</h2><p>Your palm steers the paddle. Catch the ball.<br/>Find the angle. Break the formation.</p></div></div>
  <div class="instruction"><span class="instruction-number">02</span><span class="split-icon"><i></i><i></i></span><div><h2>Two hands. 1.5× the points.</h2><p>Raise a second hand for two wide paddles.<br/>Earn a 1.5× bonus while both are active.</p></div></div>
  <div class="instruction"><span class="instruction-number">03</span><span class="instruction-icon shield-icon">${icon.shield}</span><div><h2>Catch a power. Go further.</h2><p>Prizes grant 30-second superpowers.<br/>The green shield + restores one energy shield.</p></div></div>
 </section>
 <section class="tracking-dock" id="tracking-dock" hidden>
  <div class="camera-preview"><video id="camera-video" playsinline muted></video><canvas id="skeleton" width="240" height="180"></canvas><span>LOCAL CAMERA</span></div>
  <div class="tracking-copy"><span class="eyebrow">YOUR HANDS ARE THE CONTROLLER</span><p id="tracking-hint">Keep a relaxed hand in view. Sit comfortably.</p><small>Remove your hands to pause. No special pose needed.</small></div>
  <div class="dock-session"><span class="micro-label">CONTROL LINK</span><strong id="hands-count">—</strong><span id="quality-label">ACQUIRING SIGNAL</span></div>
  <button type="button" class="disconnect-button" id="disconnect-camera">Disconnect camera</button>
 </section>
 <footer class="site-footer">
  <span>INVADER BREAK <b>© 2026</b></span>
  <span class="footer-mid">HOLD THE LINE. BREAK THE INVASION.</span>
  <span>CAMERA + HAND POSITION <span class="tiny-cross">+</span></span>
  <a class="footer-link" href="https://github.com/singyiu/game-invader-break" target="_blank" rel="noopener noreferrer" aria-label="View Invader Break on GitHub (opens in a new tab)">GITHUB <span aria-hidden="true">↗</span></a>
 </footer>
 <div class="mobile-notice">Best experienced on a laptop or desktop with a camera.</div>
 `;
}
