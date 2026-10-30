import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { chooseMixedWordExport } from "../src/services/mixedWordExport";
import { generateWordDocument, generateWordFromBank, generatePublicExamFromBank } from "../src/services/api";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true, blob: async () => new Blob(["file"]), headers: new Headers(),
  }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.querySelectorAll("dialog").forEach((node) => node.remove()); });

it.each([["教用", "teacher"], ["學用", "student"], ["兩份", "both"]])("%s remains a front-end choice sent to the same export APIs", async (label, value) => {
  const choice = chooseMixedWordExport();
  const dialog = document.querySelector('dialog[aria-label="教用學用混合"]');
  [...dialog.querySelectorAll("[data-choices] button")].find((button) => button.getAttribute("aria-label") === label).click();
  expect(await choice).toBe(value);
  await generateWordDocument({ document: { metadata: { mode: "mixed" } }, mixedVersion: value });
  await generateWordFromBank({ mode: "mixed", mixedVersion: value });
  await generatePublicExamFromBank({ mode: "mixed", mixedVersion: value });
  expect(fetch.mock.calls.map(([url]) => url.split("/word/")[1])).toEqual([
    "generate/", "generate-from-bank/", "public-exams/generate-from-bank/",
  ]);
  for (const [, options] of fetch.mock.calls) expect(JSON.parse(options.body).mixed_version).toBe(value);
});

it("closing or aborting the three-way choice returns without an export", async () => {
  const controller = new AbortController();
  const choice = chooseMixedWordExport(controller.signal);
  controller.abort();
  expect(await choice).toBeNull();
  expect(document.querySelector("dialog")).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it("teaching brief keeps its existing request without a mixed option", async () => {
  await generateWordFromBank({ mode: "teaching_brief" });
  const body = JSON.parse(fetch.mock.calls[0][1].body);
  expect(body.mode).toBe("teaching_brief");
  expect(body).not.toHaveProperty("mixed_version");
});
