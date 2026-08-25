import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const LODESTONE_BASE_URL = "https://jp.finalfantasyxiv.com";
const MAINTENANCE_URL = `${LODESTONE_BASE_URL}/lodestone/news/category/2`;
const TOPICS_URL = `${LODESTONE_BASE_URL}/lodestone/topics/`;
const OUTPUT_PATH = fileURLToPath(new URL("../public/data/official-events.json", import.meta.url));
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

export function htmlToText(html) {
  return decodeHtml(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[\t\r ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function dateKeyFromEpoch(epochSeconds) {
  const date = new Date(Number(epochSeconds) * 1000 + JST_OFFSET_MS);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function toDateKey(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function toJstDateTime(year, month, day, hour, minute) {
  return `${toDateKey(year, month, day)}T${pad(hour)}:${pad(minute)}:00+09:00`;
}

function addDays(dateKey, amount) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function parseMaintenanceRange(text) {
  const startMatch = text.match(
    /日\s*時[：:]\s*(\d{4})年(\d{1,2})月(\d{1,2})日[^\d\n]{0,16}(\d{1,2}):(\d{2})より/,
  );
  if (!startMatch) return null;

  const [, startYearText, startMonthText, startDayText, startHourText, startMinuteText] = startMatch;
  const startYear = Number(startYearText);
  const startMonth = Number(startMonthText);
  const startDay = Number(startDayText);
  const tail = text.slice((startMatch.index ?? 0) + startMatch[0].length);
  const endMatch = tail.match(
    /(?:(\d{4})年)?(?:(\d{1,2})月)?(?:(\d{1,2})日[^\d\n]{0,16})?(\d{1,2}):(\d{2})頃?まで/,
  );
  if (!endMatch) return null;

  const endYear = Number(endMatch[1] || startYear);
  const endMonth = Number(endMatch[2] || startMonth);
  const endDay = Number(endMatch[3] || startDay);
  return {
    start: toJstDateTime(startYear, startMonth, startDay, Number(startHourText), Number(startMinuteText)),
    end: toJstDateTime(endYear, endMonth, endDay, Number(endMatch[4]), Number(endMatch[5])),
  };
}

function extractEntries(html, expression) {
  const entries = [];
  for (const match of html.matchAll(expression)) {
    entries.push({
      index: match.index ?? 0,
      path: match[1],
      title: htmlToText(match[2]),
      publishedDate: dateKeyFromEpoch(match[3]),
    });
  }
  return entries.map((entry, index) => ({
    ...entry,
    segment: html.slice(entry.index, entries[index + 1]?.index ?? html.length),
  }));
}

export function parseMaintenanceList(html) {
  const entries = extractEntries(
    html,
    /<a href="(\/lodestone\/news\/detail\/[^"]+)"[^>]*class="news__list--link[^"]*"[\s\S]*?<p class="news__list--title">([\s\S]*?)<\/p>[\s\S]*?ldst_strftime\((\d+)/g,
  );
  return entries.filter(({ title }) =>
    /(?:全ワールド|日本データセンター|Elemental|Gaia|Mana|Meteor).*(?:メンテナンス)/.test(title),
  );
}

export function parseTopicList(html) {
  const entries = extractEntries(
    html,
    /<p class="news__list--title"><a href="(\/lodestone\/topics\/detail\/[^"]+)">([\s\S]*?)<\/a><\/p>[\s\S]*?ldst_strftime\((\d+)/g,
  );
  return entries.filter(({ title }) =>
    /(?:PvPシリーズ\d+.*終了|クリスタルコンフリクト.*(?:閉幕|終了)|シーズン\d+.*(?:閉幕|終了)|\d+\.\d+.*パッチノート.*公開)/.test(title),
  );
}

function dateFromMonthDay(text, publishedDate) {
  const explicit = text.match(/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日/);
  if (!explicit) return publishedDate;
  const publishedYear = Number(publishedDate.slice(0, 4));
  const publishedMonth = Number(publishedDate.slice(5, 7));
  const month = Number(explicit[2]);
  const year = explicit[1] ? Number(explicit[1]) : publishedYear + (month < publishedMonth - 6 ? 1 : 0);
  return toDateKey(year, month, Number(explicit[3]));
}

function createTopicEvent(entry) {
  const text = htmlToText(entry.segment);
  const url = `${LODESTONE_BASE_URL}${entry.path}`;
  if (/パッチノート/.test(entry.title)) {
    const version = entry.title.match(/(\d+\.\d+)/)?.[1] ?? "最新";
    return {
      id: `patch-${version}-${entry.publishedDate}`,
      type: "patch",
      title: `パッチ${version} パッチノート公開`,
      start: entry.publishedDate,
      end: addDays(entry.publishedDate, 1),
      allDay: true,
      description: "FF14公式パッチノートの公開日です。内容は公式ページをご確認ください。",
      url,
    };
  }

  const date = dateFromMonthDay(text, entry.publishedDate);
  const series = entry.title.match(/PvPシリーズ(\d+)/)?.[1];
  const season = entry.title.match(/シーズン(\d+)/)?.[1];
  const title = series
    ? `PvPシリーズ${series} 終了予定`
    : `クリコン シーズン${season ?? ""} 終了予定`.replace("シーズン 終了", "シーズン終了");
  return {
    id: `pvp-${series ? `series-${series}` : `season-${season ?? date}`}`,
    type: series ? "pvp" : "season",
    title,
    start: date,
    end: addDays(date, 1),
    allDay: true,
    description: `${entry.title}。正確な終了時刻は公式メンテナンス情報をご確認ください。`,
    url,
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "ff14-calendar/1.0 (+https://naikasann.github.io/ff14_calendar/)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

async function collectMaintenanceEvents() {
  const list = parseMaintenanceList(await fetchText(MAINTENANCE_URL));
  const events = [];
  for (const entry of list.slice(0, 12)) {
    try {
      const url = `${LODESTONE_BASE_URL}${entry.path}`;
      const text = htmlToText(await fetchText(url));
      const range = parseMaintenanceRange(text);
      if (!range) continue;
      events.push({
        id: `maintenance-${range.start.slice(0, 16)}`,
        type: "maintenance",
        title: entry.title.replace(/^\[[^\]]+\]/, "").trim(),
        start: range.start,
        end: range.end,
        allDay: false,
        description: `${entry.title}。日時は変更される場合があります。最新情報は公式ページをご確認ください。`,
        url,
      });
    } catch (error) {
      console.warn(`[WARN] メンテナンス詳細の取得をスキップ: ${entry.title}`, error.message);
    }
  }
  return events;
}

async function collectTopicEvents() {
  return parseTopicList(await fetchText(TOPICS_URL)).map(createTopicEvent);
}

function deduplicateAndSort(events) {
  const unique = new Map();
  for (const event of events) {
    if (!unique.has(event.id)) unique.set(event.id, event);
  }
  return [...unique.values()].sort((left, right) => left.start.localeCompare(right.start));
}

async function readExistingData() {
  try {
    return JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
  } catch {
    return { generatedAt: null, events: [] };
  }
}

async function main() {
  console.log("[INFO] FF14公式スケジュールの取得を開始します");
  const existing = await readExistingData();
  const results = await Promise.allSettled([collectMaintenanceEvents(), collectTopicEvents()]);
  const fetchedEvents = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  for (const result of results) {
    if (result.status === "rejected") console.warn("[WARN] 公式情報の取得に失敗しました", result.reason);
  }
  if (fetchedEvents.length === 0) {
    console.warn("[WARN] 新しいデータを取得できなかったため、既存データを保持します");
    return;
  }

  const events = deduplicateAndSort(fetchedEvents);
  if (JSON.stringify(events) === JSON.stringify(existing.events ?? [])) {
    console.log(`[INFO] 変更なし（${events.length}件）`);
    return;
  }

  const data = { generatedAt: new Date().toISOString(), events };
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`[INFO] ${events.length}件を ${OUTPUT_PATH} に保存しました`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("[ERROR] 公式スケジュール更新に失敗しました", error);
    process.exitCode = 1;
  });
}
