import { expect, test } from "@playwright/test";
test("cinematic landing is usable without opening a camera", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: () => {
          throw new Error("Camera opened before consent");
        },
      },
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Invader Break", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Enable camera/ }),
  ).toBeVisible();
  await expect(page.locator("canvas#arena")).toBeVisible();
  await expect(
    page.getByText("Catch a power. Go further.", { exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(800);
  expect(errors).toEqual([]);
});
test("camera denial offers a specific recovery action without fake gameplay", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: async () => {
          throw new DOMException("Permission denied", "NotAllowedError");
        },
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Enable camera/ }).click();
  await expect(
    page.getByRole("heading", { name: "Camera needs attention" }),
  ).toBeVisible({ timeout: 20000 });
  await expect(page.locator("#overlay")).toContainText(
    /permission|allow|denied/i,
  );
  await expect(
    page.getByRole("button", { name: /Try camera again/ }),
  ).toBeVisible();
  await expect(page.locator("#app")).toHaveAttribute("data-phase", "error");
});
test("reduced-motion preference is honored at first launch", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-reduced", "true");
});
