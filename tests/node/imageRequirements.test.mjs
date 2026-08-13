import test from "node:test";
import assert from "node:assert/strict";
import { buildImageRequirements } from "../../packages/shared/dist/index.js";

const baseConfig = {
  businessName: "PearlCare Dental Studio",
  businessDescription: "Family dental care in Jaipur.",
  industry: "Dental",
  pageCount: 2,
  homeImageCount: 3,
  selectedPages: ["home", "services"],
  serviceKeywordGroups: [
    { keywords: ["Dental implants", "Teeth whitening"] },
    { keywords: ["Root canal"] }
  ]
};

test("buildImageRequirements creates distinct home and service image slots", () => {
  const requirements = buildImageRequirements(baseConfig);
  assert.equal(requirements.filter((item) => item.kind === "home").length, 6);
  assert.equal(requirements.filter((item) => item.kind === "service").length, 3);
  assert.equal(requirements.find((item) => item.id === "home-2-3")?.pageIndex, 1);
  assert.equal(requirements.find((item) => item.serviceKeyword === "Teeth whitening")?.imageIndex, 0);
});

test("buildImageRequirements skips service images when services page is disabled", () => {
  const requirements = buildImageRequirements({ ...baseConfig, selectedPages: ["home"] });
  assert.equal(requirements.length, 6);
  assert.equal(requirements.some((item) => item.kind === "service"), false);
});
