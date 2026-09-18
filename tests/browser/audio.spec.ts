import { expect, test } from "@playwright/test";

test("the production score renders audible energy and music zero is silent", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const moduleUrl = "/src/audio/music-score.ts";
    const {
      STEP_SECONDS,
      musicGainForSetting,
      musicVoicesAtStep,
      scheduleMusicVoice,
    } = await import(moduleUrl);
    const sampleRate = 44_100;
    const seconds = 2.2;

    const render = async (musicGain: number) => {
      const context = new window.OfflineAudioContext(
        1,
        Math.ceil(sampleRate * seconds),
        sampleRate,
      );
      const master = context.createGain();
      const music = context.createGain();
      master.gain.value = 0.58;
      music.gain.value = musicGain;
      music.connect(master);
      master.connect(context.destination);
      let voiceCount = 0;
      for (let step = 0; step < 16; step++) {
        const at = 0.05 + step * STEP_SECONDS;
        const voices = musicVoicesAtStep(step, true, false);
        voiceCount += voices.length;
        for (const voice of voices)
          scheduleMusicVoice(context, music, voice, at);
      }
      const buffer = await context.startRendering();
      const samples = buffer.getChannelData(0);
      let squareSum = 0;
      let peak = 0;
      for (const sample of samples) {
        squareSum += sample * sample;
        peak = Math.max(peak, Math.abs(sample));
      }
      return {
        rms: Math.sqrt(squareSum / samples.length),
        peak,
        voiceCount,
      };
    };

    return {
      audible: await render(musicGainForSetting(0.3)),
      muted: await render(musicGainForSetting(0)),
    };
  });

  expect(result.audible.voiceCount).toBeGreaterThan(24);
  expect(result.audible.rms).toBeGreaterThan(0.008);
  expect(result.audible.peak).toBeGreaterThan(0.04);
  expect(result.audible.peak).toBeLessThan(0.9);
  expect(result.muted.rms).toBeLessThan(0.000001);
  expect(result.muted.peak).toBeLessThan(0.000001);
});
