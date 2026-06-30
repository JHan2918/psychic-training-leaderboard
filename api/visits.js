import crypto from "node:crypto";
import { get, put } from "@vercel/blob";

const FILE_NAME = "visit-stats.json";
const EMPTY_STATS = {
  totalVisits: 0,
  uniqueVisitors: 0,
  visitors: [],
  daily: {}
};

async function readStats() {
  try {
    const result = await get(FILE_NAME, { access: "private" });
    if (!result?.stream) return { ...EMPTY_STATS };

    const text = await new Response(result.stream).text();
    const stats = JSON.parse(text);
    return {
      ...EMPTY_STATS,
      ...stats,
      visitors: Array.isArray(stats.visitors) ? stats.visitors : [],
      daily: stats.daily && typeof stats.daily === "object" ? stats.daily : {}
    };
  } catch {
    return { ...EMPTY_STATS };
  }
}

async function writeStats(stats) {
  await put(FILE_NAME, JSON.stringify(stats, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json"
  });
}

function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function hashVisitorId(visitorId) {
  return crypto.createHash("sha256").update(String(visitorId)).digest("hex");
}

function publicStats(stats) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    totalVisits: Number(stats.totalVisits || 0),
    uniqueVisitors: Number(stats.uniqueVisitors || 0),
    todayVisits: Number(stats.daily?.[today] || 0),
    updatedAt: stats.updatedAt || null
  };
}

export default async function handler(req, res) {
  applyCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  if (req.method === "GET") {
    const stats = await readStats();
    return res.status(200).json(publicStats(stats));
  }

  if (req.method === "POST") {
    const visitorId = String(req.body?.visitorId || "").trim();
    if (visitorId.length < 12 || visitorId.length > 128) {
      return res.status(400).json({ error: "Invalid visitorId" });
    }

    const stats = await readStats();
    const visitorHash = hashVisitorId(visitorId);
    const visitors = new Set(stats.visitors);
    const today = new Date().toISOString().slice(0, 10);

    stats.totalVisits = Number(stats.totalVisits || 0) + 1;
    stats.daily[today] = Number(stats.daily[today] || 0) + 1;

    if (!visitors.has(visitorHash)) {
      visitors.add(visitorHash);
      stats.uniqueVisitors = visitors.size;
    }

    stats.visitors = Array.from(visitors);
    stats.updatedAt = Date.now();

    await writeStats(stats);
    return res.status(200).json({ ok: true, ...publicStats(stats) });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
