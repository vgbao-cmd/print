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

// electron/demo.ts
var demo_exports = {};
__export(demo_exports, {
  demoEvents: () => demoEvents
});
module.exports = __toCommonJS(demo_exports);
var import_node_crypto = require("node:crypto");

// src/shared.ts
var TIERS = ["classic", "glow", "bloom", "love", "royal", "rainbow", "legendary", "fame"];

// electron/demo.ts
function demoEvents(kind, scope) {
  const tag = (0, import_node_crypto.randomUUID)();
  let sequence = 0;
  const like = (id, count, name = "Alex Rivera") => ({ id: `${tag}:${++sequence}`, scope, type: "like", userId: id, name, avatar: "", count });
  const gift = (id, tier, count = 1) => ({ ...like(id, count), type: "gift", demoTier: tier, coins: 0, giftId: `synthetic-${tier}` });
  if (kind === "100") return [like("demo-alex", 100)];
  if (kind === "250") return [like("demo-jamie", 250, "Jamie Chen")];
  if (kind === "many") return Array.from({ length: 12 }, (_, i) => like(`viewer-${i}`, 100, `Viewer ${i + 1}`));
  if (kind === "duplicate") {
    const e = like("demo-duplicate", 100, "Taylor");
    return [e, { ...e }];
  }
  if (kind === "names") return ["Nguy\u1EC5n Minh Anh \u{1F338}", "\u5C0F\u6797\u3055\u304F\u3089", "\uAE40\uBBFC\uC900", "\u0644\u064A\u0644\u0649 \u0623\u062D\u0645\u062F", "Alexandria Isabella Montgomery-Wellington \u2728"].map((name, i) => ({ ...like(`unicode-${i}`, 100, name), avatar: "https://invalid.example/avatar.jpg" }));
  if (kind === "combo") return [1, 2, 3, 5, 5].map((count, i) => ({ ...gift("demo-combo", "royal", count), id: `${tag}:combo:${i}`, streak: "synthetic-" + tag, streakable: true, end: i >= 3 }));
  if (kind === "burst") return Array.from({ length: 1e3 }, (_, i) => i % 4 === 0 ? gift(`burst-${i % 37}`, TIERS[1 + i % 7]) : like(`burst-${i % 37}`, 30, `Guest ${i % 37 + 1}`));
  if (kind === "speed") return Array.from({ length: 90 }, (_, i) => like(`speed-${i}`, 100, `Guest ${i + 1}`));
  if (TIERS.includes(kind)) return [gift("demo-style", kind)];
  return [];
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  demoEvents
});
