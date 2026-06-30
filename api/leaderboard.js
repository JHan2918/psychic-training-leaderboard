import { list, put } from "@vercel/blob";

const FILE_NAME = "leaderboard.json";
const MODES = ["easy", "normal", "hard", "hell"];
const EMPTY_BOARD = {
  easy: [],
  normal: [],
  hard: [],
  hell: []
};

async function readBoard() {
  try {
    const blobs = await list({ prefix: FILE_NAME });
    const file = blobs.blobs.find((blob) => blob.pathname === FILE_NAME);
    if (!file) return { ...EMPTY_BOARD };

    const response = await fetch(file.url, { cache: "no-store" });
    if (!response.ok) return { ...EMPTY_BOARD };

    return { ...EMPTY_BOARD, ...(await response.json()) };
  } catch {
    return { ...EMPTY_BOARD };
  }
}

async function writeBoard(board) {
  await put(FILE_NAME, JSON.stringify(board, null, 2), {
    access: "public",
    allowOverwrite: true,
    contentType: "application/json"
  });
}

function cleanEntry(payload) {
  return {
    mode: String(payload.mode || ""),
    userName: String(payload.userName || "Player").trim().slice(0, 20) || "Player",
    country: String(payload.country || "--").trim().slice(0, 4).toUpperCase() || "--",
    bestLevel: Math.max(1, Number(payload.bestLevel || 1)),
    bestScore: Math.max(0, Number(payload.bestScore || 0))
  };
}

function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  applyCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  if (req.method === "GET") {
    const mode = String(req.query.mode || "");
    if (!MODES.includes(mode)) {
      return res.status(400).json({ error: "Invalid mode" });
    }

    const board = await readBoard();
    return res.status(200).json({ entries: board[mode] || [] });
  }

  if (req.method === "POST") {
    const entry = cleanEntry(req.body || {});
    if (!MODES.includes(entry.mode)) {
      return res.status(400).json({ error: "Invalid mode" });
    }

    const board = await readBoard();
    const entries = Array.isArray(board[entry.mode]) ? board[entry.mode] : [];
    const existing = entries.find(
      (item) => item.userName.toLowerCase() === entry.userName.toLowerCase()
    );
    let changed = false;

    if (existing) {
      const isBetter =
        entry.bestScore > existing.bestScore ||
        (entry.bestScore === existing.bestScore && entry.bestLevel > existing.bestLevel);

      if (isBetter) {
        existing.bestScore = entry.bestScore;
        existing.bestLevel = entry.bestLevel;
        existing.country = entry.country;
        existing.mode = entry.mode;
        existing.updatedAt = Date.now();
        changed = true;
      }
    } else {
      const isTop10Candidate =
        entries.length < 10 ||
        entries.some(
          (item) =>
            entry.bestScore > item.bestScore ||
            (entry.bestScore === item.bestScore && entry.bestLevel > item.bestLevel)
        );

      if (isTop10Candidate) {
        entries.push({
          userName: entry.userName,
          mode: entry.mode,
          country: entry.country,
          bestScore: entry.bestScore,
          bestLevel: entry.bestLevel,
          updatedAt: Date.now()
        });
        changed = true;
      }
    }

    board[entry.mode] = entries
      .sort((a, b) => b.bestScore - a.bestScore || b.bestLevel - a.bestLevel)
      .slice(0, 10);

    if (changed) {
      await writeBoard(board);
    }

    return res.status(200).json({ ok: true, entries: board[entry.mode] });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
