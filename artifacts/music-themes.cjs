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

// src/music-themes.ts
var music_themes_exports = {};
__export(music_themes_exports, {
  THEMES: () => THEMES
});
module.exports = __toCommonJS(music_themes_exports);
var THEMES = {
  classic: { notes: [0], tempo: 0.3, wave: "sine" },
  glow: { notes: [12, 16, 19, 24], tempo: 0.19, wave: "sine" },
  bloom: { notes: [0, 7, 12, 16, 12, 7], tempo: 0.38, wave: "sine" },
  love: { notes: [0, 4, 7, 12, 7, 4, 9, 7], tempo: 0.19, wave: "sine" },
  royal: { notes: [0, 0, 7, 12, 16, 19, 12, 7], tempo: 0.28, wave: "triangle" },
  rainbow: { notes: [0, 7, 12, 19, 16, 12, 7, 14], tempo: 0.19, wave: "sine" },
  legendary: { notes: [-12, -5, 0, 3, 7, 10, 7, 3], tempo: 0.32, wave: "triangle" },
  fame: { notes: [0, 4, 7, 12, 16, 19, 24, 19, 16, 12, 7, 12], tempo: 0.19, wave: "sine" }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  THEMES
});
