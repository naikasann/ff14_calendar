import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const LODESTONE_BASE_URL = "https://jp.finalfantasyxiv.com";
const MAINTENANCE_URL = `${LODESTONE_BASE_URL}/lodestone/news/category/2`;
const TOPICS_URL = `${LODESTONE_BASE_URL}/lodestone/topics/`;
const OUTPUT_PATH = fileURLToPath(new URL("../public/data/official-events.json", import.meta.url));
const CURATED_PATH = fileURLToPath(new URL("../public/data/curated-official-events.json", import.meta.url));
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
    /(?:PvPシリーズ\d+.*終了|クリスタルコンフリクト.*(?:閉幕|終了)|シーズン\d+.*(?:閉幕|終了)|\d+\.\d+.*パッチノート.*公開|モグモグ[★☆]コレクション|新生祭|紅蓮祭|降神祭|ヴァレンティオンデー|プリンセスデー|エッグハント|ゴールドソーサー・フェスティバル|守護天節|星芒祭|FFXIV\s*PLL|プロデューサーレターLIVE|ファンフェスティバル|14時間生放送|ライブビューイング|キャンペーン|コラボ|セール|東京ゲームショウ)/i.test(title),
  );
}

function inferYear(month, referenceDate, previousDate) {
  if (previousDate) {
    const [previousYear, previousMonth] = previousDate.split("-").map(Number);
    return previousYear + (month < previousMonth ? 1 : 0);
  }
  const referenceYear = Number(referenceDate.slice(0, 4));
  const referenceMonth = Number(referenceDate.slice(5, 7));
  if (month < referenceMonth - 6) return referenceYear + 1;
  if (month > referenceMonth + 6) return referenceYear - 1;
  return referenceYear;
}

function formatJstDateTime(date) {
  const shifted = new Date(date.getTime() + JST_OFFSET_MS);
  return `${toDateKey(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate())}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:00+09:00`;
}

function addHours(dateTime, hours) {
  return formatJstDateTime(new Date(new Date(dateTime).getTime() + hours * 60 * 60 * 1000));
}

export function parseTopicSchedule(title, articleText, publishedDate) {
  const markerMatch = articleText.match(/(?:開催期間|実施期間|キャンペーン期間|販売期間|放送日時|日時|開催概要)/);
  const source = markerMatch
    ? articleText.slice(markerMatch.index).split(/\n※/)[0].slice(0, 1600)
    : `${title}\n${articleText.slice(0, 1600)}`.split(/\n※/)[0];
  const expression = /(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日(?:（[^）]+）|\([^)]*\))?(?:\s*(\d{1,2}):([0-5]\d)(?:頃)?)?/g;
  const dates = [];
  for (const match of source.matchAll(expression)) {
    const month = Number(match[2]);
    const previousDate = dates.at(-1)?.dateKey;
    const year = match[1] ? Number(match[1]) : inferYear(month, publishedDate, previousDate);
    const dateKey = toDateKey(year, month, Number(match[3]));
    const time = match[4] ? { hour: Number(match[4]), minute: Number(match[5]) } : null;
    if (!dates.some((date) => date.dateKey === dateKey && JSON.stringify(date.time) === JSON.stringify(time))) {
      dates.push({ dateKey, time });
    }
  }
  if (dates.length === 0) return null;

  const start = dates[0];
  const chronological = dates.filter((date) => date.dateKey >= start.dateKey);
  const end = chronological.at(-1) ?? start;
  if (chronological.length > 2) {
    return { start: start.dateKey, end: addDays(end.dateKey, 1), allDay: true };
  }
  if (start.time) {
    const startDateTime = `${start.dateKey}T${pad(start.time.hour)}:${pad(start.time.minute)}:00+09:00`;
    const endDateTime = end !== start && end.time
      ? `${end.dateKey}T${pad(end.time.hour)}:${pad(end.time.minute)}:00+09:00`
      : addHours(startDateTime, 1);
    return { start: startDateTime, end: endDateTime, allDay: false };
  }
  return { start: start.dateKey, end: addDays(end.dateKey, 1), allDay: true };
}

function extractArticleText(html) {
  const wrapper = html.match(/<div class="news__detail__wrapper">([\s\S]*?)<div class="news__detail__social">/)?.[1] ?? html;
  return htmlToText(wrapper);
}

function createTopicDescription(articleText, fallback) {
  const firstParagraph = articleText.split(/\n{1,}/).find((line) => line.length >= 24) ?? fallback;
  return firstParagraph.length > 190 ? `${firstParagraph.slice(0, 187)}...` : firstParagraph;
}

function classifyTopic(title) {
  if (/パッチノート/.test(title)) return "patch";
  if (/PvPシリーズ/.test(title)) return "pvp";
  if (/クリスタルコンフリクト|シーズン\d+/.test(title)) return "season";
  if (/FFXIV\s*PLL|プロデューサーレターLIVE|ファンフェスティバル|14時間生放送|ライブビューイング/i.test(title)) return "broadcast";
  if (/キャンペーン|コラボ|セール/i.test(title)) return "campaign";
  return "event";
}

export function isRelevantScheduledTopic(title, articleText) {
  if (/モグモグ[★☆]コレクション|新生祭|紅蓮祭|降神祭|ヴァレンティオンデー|プリンセスデー|エッグハント|ゴールドソーサー・フェスティバル|守護天節|星芒祭/.test(title)) {
    return true;
  }
  if (/FFXIV\s*PLL|プロデューサーレターLIVE|14時間生放送|東京ゲームショウ/i.test(title)) {
    return true;
  }
  if (/ファンフェスティバル/i.test(title)) {
    if (/ライブビューイング|タイムスケジュール|開催決定|放送/i.test(title)) return true;
    return !/チケット|リセール|グッズ|商品|予約|販売/i.test(title);
  }
  if (/オプションアイテム|グッズ|商品|チケット|リセール|予約|セール/i.test(title)) {
    return false;
  }
  if (/キャンペーン|コラボ/i.test(title)) {
    if (/始動|発表|続報/i.test(title) && !/キャンペーン/i.test(title)) return false;
    const hasPeriod = /開催期間|実施期間|応募期間|キャンペーン期間|販売期間/.test(articleText);
    const hasPlayerAction = /応募|参加|視聴|投稿|報酬|プレゼント|もらえ|インゲーム|ゲーム内/.test(articleText);
    return hasPeriod && hasPlayerAction;
  }
  return false;
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

function createScheduledTopicEvent(entry, articleHtml) {
  const articleText = extractArticleText(articleHtml);
  if (!isRelevantScheduledTopic(entry.title, articleText)) return null;
  const schedule = parseTopicSchedule(entry.title, articleText, entry.publishedDate);
  if (!schedule) return null;
  const type = classifyTopic(entry.title);
  const slug = entry.path.split("/").filter(Boolean).at(-1)?.slice(0, 12) ?? entry.publishedDate;
  return {
    id: `${type}-${slug}`,
    type,
    title: entry.title,
    ...schedule,
    description: createTopicDescription(articleText, `${entry.title}の公式情報です。`),
    url: `${LODESTONE_BASE_URL}${entry.path}`,
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
  const entries = parseTopicList(await fetchText(TOPICS_URL)).slice(0, 24);
  const events = [];
  for (const entry of entries) {
    if (/PvPシリーズ\d+.*終了|クリスタルコンフリクト.*(?:閉幕|終了)|シーズン\d+.*(?:閉幕|終了)|\d+\.\d+.*パッチノート.*公開/.test(entry.title)) {
      events.push(createTopicEvent(entry));
      continue;
    }
    try {
      const event = createScheduledTopicEvent(entry, await fetchText(`${LODESTONE_BASE_URL}${entry.path}`));
      if (event) events.push(event);
    } catch (error) {
      console.warn(`[WARN] 公式トピックス詳細の取得をスキップ: ${entry.title}`, error.message);
    }
  }
  return events;
}

function deduplicateAndSort(events) {
  const unique = new Map();
  for (const event of events) {
    if (!unique.has(event.id)) unique.set(event.id, event);
  }
  return [...unique.values()].sort((left, right) => left.start.localeCompare(right.start));
}

export function applyCuratedData(events, curated = {}) {
  const excludedIds = new Set(Array.isArray(curated.excludedIds) ? curated.excludedIds : []);
  const summaryOverrides = curated.summaryOverrides && typeof curated.summaryOverrides === "object"
    ? curated.summaryOverrides
    : {};
  const extraEvents = Array.isArray(curated.extraEvents) ? curated.extraEvents : [];
  const selected = events
    .filter((event) => !excludedIds.has(event.id))
    .map((event) => summaryOverrides[event.id]
      ? { ...event, description: summaryOverrides[event.id] }
      : event);
  return deduplicateAndSort([...selected, ...extraEvents.filter((event) => !excludedIds.has(event.id))]);
}

async function readExistingData() {
  try {
    return JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
  } catch {
    return { generatedAt: null, events: [] };
  }
}

async function readCuratedData() {
  try {
    return JSON.parse(await readFile(CURATED_PATH, "utf8"));
  } catch {
    return { reviewedAt: null, summaryOverrides: {}, excludedIds: [], extraEvents: [] };
  }
}

async function main() {
  console.log("[INFO] FF14公式スケジュールの取得を開始します");
  const existing = await readExistingData();
  const curated = await readCuratedData();
  const results = await Promise.allSettled([collectMaintenanceEvents(), collectTopicEvents()]);
  const fetchedEvents = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  for (const result of results) {
    if (result.status === "rejected") console.warn("[WARN] 公式情報の取得に失敗しました", result.reason);
  }
  const sourceEvents = fetchedEvents.length > 0 ? fetchedEvents : (existing.events ?? []);
  if (fetchedEvents.length === 0) {
    console.warn("[WARN] 新しいデータを取得できなかったため、既存データに週次選別を適用します");
  }
  const events = applyCuratedData(sourceEvents, curated);
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
