import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { generateWordFromBank } from "../src/services/api";

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(["docx"]), headers: new Headers() }));
});
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); });

it("uses the staff bank route and credential without an unrelated stale login token", async () => {
  localStorage.setItem("auth.token", "stale-login-test");
  const controller = new AbortController();
  await generateWordFromBank({ questionIds: ["draft-id", "archived-id"], apiKey: "staff-test-key", subject: "english", templateId: "junior_exam_paper", examRange: "第三冊", sectionMode: "selected", mode: "teaching_brief", signal: controller.signal });
  const [url, options] = fetch.mock.lastCall;
  expect(url).toMatch(/\/word\/generate-from-bank\/$/);
  expect(options.headers).toEqual({ "Content-Type": "application/json", "X-API-KEY": "staff-test-key" });
  expect(options.signal).toBe(controller.signal);
  expect(JSON.parse(options.body)).toMatchObject({ question_ids: ["draft-id", "archived-id"], subject: "english", template_id: "junior_exam_paper", mode: "teaching_brief", section_mode: "selected", exam_range: "第三冊" });
  expect(JSON.parse(options.body)).not.toHaveProperty("mixed_version");
});

it.each([["teacher", "試卷_教用.docx"], ["student", "試卷_學用.docx"], ["both", "試卷_教用學用.zip"]])("mixed %s retains the right download format even without exposed filename headers", async (mixedVersion, filename) => {
  const result = await generateWordFromBank({ filename: "試卷.docx", mode: "mixed", mixedVersion, apiKey: "staff-test-key" });
  expect(result.filename).toBe(filename);
  expect(JSON.parse(fetch.mock.lastCall[1].body)).toMatchObject({ mode: "mixed", mixed_version: mixedVersion });
});

it("prefers the actual backend filename and preserves JWT requests without a staff key", async () => {
  sessionStorage.setItem("auth.token", "owner-login-test");
  fetch.mockResolvedValueOnce({ ok: true, blob: async () => new Blob(["zip"]), headers: new Headers({ "content-disposition": "attachment; filename*=UTF-8''server-name.zip" }) });
  const result = await generateWordFromBank({ mode: "mixed", mixedVersion: "both" });
  expect(result.filename).toBe("server-name.zip");
  expect(fetch.mock.lastCall[1].headers.Authorization).toBe("Bearer owner-login-test");
});

it("translates unavailable-question failures into an actionable Chinese message", async () => {
  fetch.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: "Some selected questions were not found or are not available." }) });
  const result = await generateWordFromBank({});
  expect(result.error).toContain("部分選取題目已刪除"); expect(result.error).toContain("重新整理"); expect(result.error).not.toContain("Some selected");
});

it("returns cancellation without a network error after leaving the picker", async () => {
  fetch.mockRejectedValueOnce(new DOMException("cancelled", "AbortError"));
  expect(await generateWordFromBank({})).toMatchObject({ success: false, cancelled: true });
});
