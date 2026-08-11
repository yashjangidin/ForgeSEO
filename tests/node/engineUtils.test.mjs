import test from "node:test";
import assert from "node:assert/strict";
import { slugify, countWords, pageId } from "../../apps/worker/dist/engines/engineUtils.js";

test("creates stable URL slugs", () => {
  assert.equal(slugify("Emergency Plumbing Services, New York!"), "emergency-plumbing-services-new-york");
});

test("counts words from real generated content", () => {
  assert.equal(countWords("ForgeSEO builds complete websites."), 4);
});

test("creates stable rendered page ids", () => {
  assert.equal(pageId("project-1", "job-1", "index"), pageId("project-1", "job-1", "index"));
  assert.notEqual(pageId("project-1", "job-1", "index"), pageId("project-1", "job-2", "index"));
});
