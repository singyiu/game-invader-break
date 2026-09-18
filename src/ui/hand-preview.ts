import type { TrackedHand } from "../shared/contracts";
const edges = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
];
export class HandPreview {
  private context: CanvasRenderingContext2D | null;
  constructor(private canvas: HTMLCanvasElement) {
    this.context = canvas.getContext("2d");
  }
  draw(hands: TrackedHand[], fresh: boolean): void {
    const c = this.context;
    if (!c) return;
    const w = this.canvas.width,
      h = this.canvas.height;
    c.clearRect(0, 0, w, h);
    c.globalAlpha = fresh ? 1 : 0.22;
    for (const hand of hands) {
      const points = hand.landmarks;
      c.strokeStyle = "#65e6f0";
      c.lineWidth = 1.6;
      for (const [a, b] of edges) {
        if (!points[a] || !points[b]) continue;
        c.beginPath();
        c.moveTo((1 - points[a].x) * w, points[a].y * h);
        c.lineTo((1 - points[b].x) * w, points[b].y * h);
        c.stroke();
      }
      for (const p of points) {
        c.beginPath();
        c.arc((1 - p.x) * w, p.y * h, 2, 0, Math.PI * 2);
        c.fillStyle = "#c6faff";
        c.fill();
      }
      c.beginPath();
      c.arc((1 - hand.rawX) * w, hand.y * h, 6, 0, Math.PI * 2);
      c.setLineDash(hand.id % 2 === 0 ? [3, 2] : []);
      c.stroke();
      c.setLineDash([]);
    }
    c.globalAlpha = 1;
  }
}
