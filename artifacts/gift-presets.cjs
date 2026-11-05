"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/gift-guide.ts
var gift_guide_exports = {};
__export(gift_guide_exports, {
  PRESETS: () => PRESETS,
  fallbackGiftImage: () => fallbackGiftImage,
  giftName: () => giftName,
  guideItems: () => guideItems,
  isTakoyaki: () => isTakoyaki,
  resolvePresets: () => resolvePresets,
  verifiedMapping: () => verifiedMapping
});
module.exports = __toCommonJS(gift_guide_exports);

// src/shared.ts
var TIERS = ["classic", "glow", "bloom", "love", "royal", "rainbow", "legendary", "fame"];
var SCALES = [1, 1.25, 1.5, 2, 2.5, 3, 3.5, 4];
var SPOT_DURATIONS = [0, 0, 2e3, 3e3, 5e3, 7e3, 9e3, 12e3];
var DEFAULT_TIERS = Object.fromEntries(TIERS.map((t, i) => [t, { scale: SCALES[i], spotlightEnabled: i >= 2, spotlightDuration: SPOT_DURATIONS[i], musicFile: "", musicName: "", musicVolume: 0.65, voiceEnabled: true }]));

// src/gift-guide.ts
var PRESETS = {
  glow: { id: "", name: "Rose", coins: 1, image: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.webp" },
  bloom: { id: "", name: "Finger Heart", coins: 5, image: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/a4c4dc437fd3a6632aba149769491f49.png~tplv-obj.webp" },
  love: { id: "", name: "Rosa", coins: 10, image: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eb77ead5c3abb6da6034d3cf6cfeb438~tplv-obj.webp" },
  royal: { id: "", name: "Perfume", coins: 20, image: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/20b8f61246c7b6032777bb81bf4ee055~tplv-obj.webp" },
  rainbow: { id: "", name: "Doughnut", coins: 30, image: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/4e7ad6bdf0a1d860c538f38026d4e812~tplv-obj.webp" },
  legendary: { id: "", name: "Takoyaki", coins: 88, image: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/b0d9f32b9d4c04afbb0267dcb5b576fa.png~tplv-obj.webp" },
  fame: { id: "", name: "Hand Heart", coins: 100, image: "https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/374dfe46d5b09ce1db19be06202d34f5.png~tplv-obj.webp" }
};
var giftName = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
var isTakoyaki = (g) => g.coins === 88 && giftName(g.name) === "takoyaki";
function verifiedMapping(g, catalog, tier) {
  const actual = g && catalog.find((a) => a.id === g.id && a.coins === g.coins && giftName(a.name) === giftName(g.name));
  return !!actual && (tier !== "legendary" || isTakoyaki(actual));
}
function resolvePresets(settings, catalog) {
  const next = structuredClone(settings);
  for (const tier of TIERS.slice(1)) {
    const old = next.mappings[tier], preset = PRESETS[tier];
    if (old) {
      if (verifiedMapping(old, catalog, tier)) {
        const actual = catalog.find((g) => g.id === old.id);
        next.mappings[tier] = { ...actual, displayName: old.displayName };
      }
      continue;
    }
    const matches = catalog.filter((g) => g.coins === preset.coins && giftName(g.name) === giftName(preset.name));
    if (matches.length === 1) next.mappings[tier] = { ...matches[0], displayName: preset.name };
  }
  return next;
}
function guideItems(settings, demo, catalog) {
  return TIERS.slice(1).flatMap((tier) => {
    const g = settings.mappings[tier];
    return demo ? [{ tier, gift: g ?? PRESETS[tier], preview: !g || !verifiedMapping(g, catalog, tier) }] : verifiedMapping(g, catalog, tier) ? [{ tier, gift: g, preview: false }] : [];
  });
}
function fallbackGiftImage(g, tier) {
  const preset = PRESETS[tier];
  return preset && giftName(g.name) === giftName(preset.name) && g.coins === preset.coins ? preset.image : "";
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PRESETS,
  fallbackGiftImage,
  giftName,
  guideItems,
  isTakoyaki,
  resolvePresets,
  verifiedMapping
});
