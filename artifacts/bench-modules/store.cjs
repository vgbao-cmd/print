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

// electron/store.ts
var store_exports = {};
__export(store_exports, {
  Store: () => Store
});
module.exports = __toCommonJS(store_exports);
var import_node_sqlite = require("node:sqlite");
var import_node_crypto = require("node:crypto");

// src/shared.ts
var TIERS = ["classic", "glow", "bloom", "love", "royal", "rainbow", "legendary", "fame"];
var DEFAULTS = { likes: 100, thresholds: [10, 30, 80], durations: [3e3, 2e3, 1e3, 1500], volume: 0.35, sound: true, tts: false, voice: "", mappings: {} };
function validSettings(raw) {
  const n = (v, min, max) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
  if (!raw || !n(raw.likes, 1, 1e5) || !Number.isInteger(raw.likes) || raw.thresholds?.length !== 3 || raw.durations?.length !== 4 || !raw.thresholds.every((v, i) => n(v, 1, 1e5) && (i === 0 || v > raw.thresholds[i - 1])) || !raw.durations.every((v) => n(v, 500, 3e4)) || !n(raw.volume, 0, 1)) throw Error("Invalid settings");
  const mappings = {};
  const used = /* @__PURE__ */ new Set();
  for (const tier of TIERS.slice(1)) {
    const g = raw.mappings?.[tier];
    if (!g) continue;
    if (typeof g.id !== "string" || !g.id || used.has(g.id) || !n(g.coins, 1, 1e6) || !Number.isInteger(g.coins) || typeof g.name !== "string" || typeof g.image !== "string") throw Error("Invalid gift mapping");
    used.add(g.id);
    mappings[tier] = { id: g.id.slice(0, 100), name: g.name.slice(0, 200), image: g.image.slice(0, 4096), coins: g.coins, displayName: String(g.displayName || "").slice(0, 160) };
  }
  return { likes: raw.likes, thresholds: [...raw.thresholds], durations: [...raw.durations], volume: raw.volume, sound: !!raw.sound, tts: !!raw.tts, voice: String(raw.voice || "").slice(0, 200), mappings };
}

// electron/store.ts
var Store = class {
  db;
  settings;
  session;
  constructor(file) {
    this.db = new import_node_sqlite.DatabaseSync(file);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS receipts(key TEXT PRIMARY KEY) WITHOUT ROWID;
      CREATE TABLE IF NOT EXISTS combos(key TEXT PRIMARY KEY) WITHOUT ROWID;
      CREATE TABLE IF NOT EXISTS people(session TEXT,scope TEXT,id TEXT,name TEXT,avatar TEXT,likes INTEGER DEFAULT 0,coins INTEGER DEFAULT 0,PRIMARY KEY(session,scope,id));
      CREATE TABLE IF NOT EXISTS jobs(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE,payload TEXT,kind TEXT,remaining INTEGER,state TEXT DEFAULT 'pending',token TEXT);
      CREATE INDEX IF NOT EXISTS pending_jobs ON jobs(state,kind,seq);`);
    this.settings = this.get("settings", DEFAULTS);
    this.session = this.get("session", (0, import_node_crypto.randomUUID)());
    this.set("session", this.session);
    this.recover();
  }
  get(key, fallback) {
    const r = this.db.prepare("SELECT value FROM meta WHERE key=?").get(key);
    return r ? JSON.parse(String(r.value)) : fallback;
  }
  set(key, value) {
    this.db.prepare("INSERT INTO meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, JSON.stringify(value));
  }
  transaction(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  save(s) {
    this.settings = validSettings(s);
    this.set("settings", this.settings);
    return this.settings;
  }
  recover() {
    this.db.prepare("UPDATE jobs SET state='pending',token=NULL WHERE state='active'").run();
  }
  ingest(events) {
    return this.transaction(() => events.map((e) => this.event(e)));
  }
  event(e) {
    if (!e.id || !e.userId || !Number.isSafeInteger(e.count) || e.count < 0 || e.count > 1e7) throw Error("Invalid event");
    const receipt = `${e.scope}:${e.type}:${e.id}`;
    const fresh = Number(this.db.prepare("INSERT OR IGNORE INTO receipts VALUES(?)").run(receipt).changes) > 0;
    if (!fresh) {
      this.set("duplicates", this.get("duplicates", 0) + 1);
      return { fresh: false, prints: 0 };
    }
    this.set("received", this.get("received", 0) + 1);
    this.db.prepare(`INSERT INTO people(session,scope,id,name,avatar) VALUES(?,?,?,?,?) ON CONFLICT(session,scope,id) DO UPDATE SET name=excluded.name,avatar=CASE WHEN excluded.avatar<>'' THEN excluded.avatar ELSE people.avatar END`).run(this.session, e.scope, e.userId, e.name, e.avatar);
    const p = this.db.prepare("SELECT * FROM people WHERE session=? AND scope=? AND id=?").get(this.session, e.scope, e.userId);
    let tier = "classic", quantity = 1, draws = 0;
    if (e.type === "like") {
      const total = Number(p.likes) + e.count;
      draws = Math.floor(total / this.settings.likes);
      this.db.prepare("UPDATE people SET likes=? WHERE session=? AND scope=? AND id=?").run(total % this.settings.likes, this.session, e.scope, e.userId);
    } else {
      if (e.streakable && !e.end) return { fresh: true, prints: 0 };
      if (e.streak) {
        const key = `${e.scope}:${e.userId}:${e.giftId}:${e.streak}`;
        if (!Number(this.db.prepare("INSERT OR IGNORE INTO combos VALUES(?)").run(key).changes)) return { fresh: true, prints: 0 };
      }
      const configured = TIERS.find((t) => this.settings.mappings[t]?.id === e.giftId);
      const mapped = configured ? this.settings.mappings[configured] : void 0;
      const unit = e.coins ?? mapped?.coins ?? 0;
      if (!Number.isSafeInteger(unit) || unit < 0 || unit > 1e6) throw Error("Invalid coin amount");
      this.db.prepare("UPDATE people SET coins=coins+? WHERE session=? AND scope=? AND id=?").run(unit * e.count, this.session, e.scope, e.userId);
      if (e.scope.startsWith("demo:") && e.demoTier) tier = e.demoTier;
      else if (configured) tier = configured;
      else return { fresh: true, prints: 0 };
      quantity = e.count;
      draws = quantity > 0 ? 1 : 0;
    }
    if (draws) {
      const item = { id: receipt, userId: e.userId, name: e.name, avatar: e.avatar || String(p.avatar), tier, quantity, source: e.scope };
      this.db.prepare("INSERT INTO jobs(id,payload,kind,remaining) VALUES(?,?,?,?)").run(receipt, JSON.stringify(item), e.type, draws);
    }
    return { fresh: true, prints: draws, remainder: e.type === "like" ? (Number(p.likes) + e.count) % this.settings.likes : void 0 };
  }
  count() {
    return Number(this.db.prepare("SELECT coalesce(sum(remaining),0) AS n FROM jobs WHERE state='pending'").get().n);
  }
  claim(size, token) {
    return this.transaction(() => {
      const out = [];
      let streak = this.get("giftRun", 0);
      for (let i = 0; i < size; i++) {
        const preferred = streak >= 3 ? "like" : "gift";
        const row = this.db.prepare("SELECT * FROM jobs WHERE state='pending' AND kind=? ORDER BY seq LIMIT 1").get(preferred) ?? this.db.prepare("SELECT * FROM jobs WHERE state='pending' ORDER BY seq LIMIT 1").get();
        if (!row) break;
        const item = JSON.parse(String(row.payload));
        const remaining = Number(row.remaining);
        const id = `${item.id}:draw:${remaining}`;
        item.id = id;
        if (remaining > 1) {
          this.db.prepare("UPDATE jobs SET remaining=remaining-1 WHERE seq=?").run(row.seq);
          this.db.prepare("INSERT INTO jobs(id,payload,kind,remaining,state,token) VALUES(?,?,?,1,'active',?)").run(id, JSON.stringify(item), String(row.kind), token);
        } else this.db.prepare("UPDATE jobs SET state='active',token=? WHERE seq=?").run(token, row.seq);
        out.push(item);
        streak = row.kind === "gift" ? streak + 1 : 0;
      }
      this.set("giftRun", Math.min(3, streak));
      return out;
    });
  }
  complete(token) {
    return this.transaction(() => {
      const n = Number(this.db.prepare("SELECT count(*) AS n FROM jobs WHERE state='active' AND token=?").get(token).n);
      this.db.prepare("DELETE FROM jobs WHERE state='active' AND token=?").run(token);
      this.set("completed", this.get("completed", 0) + n);
      return n;
    });
  }
  clear() {
    return this.transaction(() => {
      const n = this.count();
      this.db.prepare("DELETE FROM jobs WHERE state='pending'").run();
      return n;
    });
  }
  newSession() {
    if (this.count() || Number(this.db.prepare("SELECT count(*) n FROM jobs WHERE state='active'").get().n)) throw Error("Queue not empty");
    this.session = (0, import_node_crypto.randomUUID)();
    this.transaction(() => {
      this.set("session", this.session);
      this.set("completed", 0);
      this.set("received", 0);
      this.set("duplicates", 0);
      this.db.prepare("DELETE FROM people").run();
    });
    return this.session;
  }
  snapshot(scope) {
    return {
      queue: this.count(),
      completed: this.get("completed", 0),
      received: this.get("received", 0),
      duplicates: this.get("duplicates", 0),
      session: this.session,
      top: this.db.prepare("SELECT name,coins FROM people WHERE session=? AND scope=? AND coins>0 ORDER BY coins DESC,id LIMIT 3").all(this.session, scope),
      likesRemainder: Number(this.db.prepare("SELECT coalesce(sum(likes),0) n FROM people WHERE session=? AND scope=?").get(this.session, scope).n),
      preview: this.db.prepare("SELECT payload,remaining FROM jobs WHERE state='pending' ORDER BY seq LIMIT 8").all().map((r) => ({ ...JSON.parse(String(r.payload)), waiting: Number(r.remaining) }))
    };
  }
  close() {
    this.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    this.db.close();
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Store
});
