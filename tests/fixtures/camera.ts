import type { GameState } from "../../src/shared/contracts";
import type { Page } from "@playwright/test";
/** Test-only camera module substitution. No synthetic controls are bundled with the game. */
export async function syntheticCamera(
  page: Page,
  resumeWhenPrompted = false,
): Promise<void> {
  await page.addInitScript((resume) => {
    (window as unknown as { testHandX: number[] }).testHandX = [0.5];
    (
      window as unknown as { testResumeWhenPrompted: boolean }
    ).testResumeWhenPrompted = resume;
  }, resumeWhenPrompted);
  await page.route("**/src/camera/camera-session.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `
 const pattern=[[0,.04],[-.025,.02],[-.04,0],[-.052,-.016],[-.06,-.028],[-.028,-.02],[-.032,-.06],[-.034,-.09],[-.035,-.115],[0,-.027],[0,-.073],[0,-.104],[0,-.13],[.026,-.02],[.03,-.064],[.033,-.09],[.035,-.11],[.044,0],[.053,-.035],[.06,-.06],[.065,-.08]];
 const palm=[0,5,9,13,17].reduce((sum,i)=>sum+pattern[i][0],0)/5;
 export class CameraSession {
 constructor(video,callbacks){this.callbacks=callbacks;this.running=false;this.timer=0;this.frameId=0;this.metrics={accepted:0,dropped:0,inferenceMs:4,ageMs:5,delegate:'synthetic'};}
 async start(){
   this.stop();this.running=true;this.resumeActive=false;
   this.timer=setInterval(()=>{
     const now=performance.now();
     const resume=Boolean(window.testResumeWhenPrompted&&document.querySelector('[data-dwell="resume"]'));
     let xs=window.testHandX;
     if(resume){
       const c=window.testRead?.().calibration??{min:.2,max:.8};
       const span=c.max-c.min,mid=(c.min+c.max)/2;
       if(!this.resumeActive){
         this.resumeLeaving=true;this.resumeOutsideAt=0;
         this.resumeHands=Math.max(1,Math.min(2,xs.length));
       }
       // A dwell selection requires leaving before another selection can arm.
       // Wait for the rendered, filtered cursor to actually leave the center;
       // a wall-clock delay alone can elapse while the display is stalled.
       const cursor=document.querySelector('#hand-cursor');
       const position=Number.parseFloat(cursor?.style.left??'');
       if(this.resumeLeaving&&cursor&&!cursor.hidden&&(position<34||position>66)){
         if(!this.resumeOutsideAt)this.resumeOutsideAt=now;
         if(now-this.resumeOutsideAt>=150)this.resumeLeaving=false;
       }
       xs=this.resumeLeaving
         ?[c.max-span*.1,c.min+span*.1].slice(0,this.resumeHands)
         :this.resumeHands===2?[mid+span*.08,mid-span*.08]:[mid];
     }
     this.resumeActive=resume;
     this.callbacks.onFrame({version:1,frameId:++this.frameId,capturedAt:now-5,arrivedAt:now,mediaTime:this.frameId*33.3,inferenceMs:4,hands:xs.map((x,i)=>({handedness:i?'Right':'Left',handednessScore:.9,landmarks:pattern.map(([dx,dy])=>({x:x+dx-palm,y:.55+dy,z:0}))}))});
     this.metrics.accepted++;
   },33);
 }
 stop(){clearInterval(this.timer);this.running=false;}
 }
 `,
    }),
  );
}
export async function moveHand(page: Page, sourceXs: number[]): Promise<void> {
  await page.evaluate((xs) => {
    (window as unknown as { testHandX: number[] }).testHandX = xs;
  }, sourceXs);
}

export interface TestHarness {
  testHandX: number[];
  testRead: () => {
    phase: string;
    game: GameState;
    calibration: { min: number; max: number };
  };
  testFollowTimer?: ReturnType<typeof setInterval>;
}
export async function observeApplication(page: Page): Promise<void> {
  await page.route("**/src/main.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `import '/src/style.css';import { InvaderBreakApp } from '/src/app/application.ts';const application=new InvaderBreakApp(document.querySelector('#app'));window.testRead=()=>({phase:application.session.phase,game:structuredClone(application.game),calibration:application.profile.calibration});`,
    }),
  );
}
export async function followBall(page: Page, enabled: boolean): Promise<void> {
  await page.evaluate((enabled) => {
    const harness = window as unknown as TestHarness;
    clearInterval(harness.testFollowTimer);
    if (enabled)
      harness.testFollowTimer = setInterval(() => {
        const state = harness.testRead(),
          c = state.calibration;
        harness.testHandX = [
          c.max - ((c.max - c.min) * state.game.ball.x) / 100,
        ];
      }, 20);
  }, enabled);
}
