import assert from "node:assert/strict";
import test from "node:test";

import {
  htmlToText,
  parseMaintenanceList,
  parseMaintenanceRange,
  parseTopicList,
  parseTopicSchedule,
} from "./update-official-events.mjs";

test("HTMLを表示用テキストへ変換する", () => {
  assert.equal(htmlToText("全ワールド<br>メンテ&amp;更新"), "全ワールド\nメンテ&更新");
});

test("同日内のメンテナンス時間を抽出する", () => {
  const actual = parseMaintenanceRange("日　時：2026年9月8日(火) 15:00より19:00頃まで");
  assert.deepEqual(actual, {
    start: "2026-09-08T15:00:00+09:00",
    end: "2026-09-08T19:00:00+09:00",
  });
});

test("日をまたぐメンテナンス時間を抽出する", () => {
  const actual = parseMaintenanceRange("日　時：2026年9月8日(火) 23:00より9月9日(水) 3:00頃まで");
  assert.deepEqual(actual, {
    start: "2026-09-08T23:00:00+09:00",
    end: "2026-09-09T03:00:00+09:00",
  });
});

test("ゲーム関連メンテナンスだけを残す", () => {
  const html = [
    '<a href="/lodestone/news/detail/a" class="news__list--link"><p class="news__list--title">[メンテナンス]全ワールド メンテナンス作業</p><script>ldst_strftime(1787641200, \'YMD\')</script></a>',
    '<a href="/lodestone/news/detail/b" class="news__list--link"><p class="news__list--title">[メンテナンス]モグステーション メンテナンス作業</p><script>ldst_strftime(1787641200, \'YMD\')</script></a>',
  ].join("");
  assert.deepEqual(parseMaintenanceList(html).map(({ path }) => path), ["/lodestone/news/detail/a"]);
});

test("PvP終了告知・パッチノート・シーズナルイベントを残す", () => {
  const html = [
    '<p class="news__list--title"><a href="/lodestone/topics/detail/a">PvPシリーズ11まもなく終了！</a></p><script>ldst_strftime(1787641200, \'YMD\')</script>',
    '<p class="news__list--title"><a href="/lodestone/topics/detail/b">7.56パッチノート公開！</a></p><script>ldst_strftime(1787641200, \'YMD\')</script>',
    '<p class="news__list--title"><a href="/lodestone/topics/detail/c">新生祭のお知らせ</a></p><script>ldst_strftime(1787641200, \'YMD\')</script>',
  ].join("");
  assert.deepEqual(parseTopicList(html).map(({ path }) => path), [
    "/lodestone/topics/detail/a",
    "/lodestone/topics/detail/b",
    "/lodestone/topics/detail/c",
  ]);
});

test("追加するFF14イベント記事を抽出する", () => {
  const html = [
    '<p class="news__list--title"><a href="/lodestone/topics/detail/a">モグモグ★コレクション 9月9日スタート！</a></p><script>ldst_strftime(1787641200, \'YMD\')</script>',
    '<p class="news__list--title"><a href="/lodestone/topics/detail/b">第93回 FFXIV PLL 放送決定！</a></p><script>ldst_strftime(1787641200, \'YMD\')</script>',
    '<p class="news__list--title"><a href="/lodestone/topics/detail/c">コラボキャンペーン開催！</a></p><script>ldst_strftime(1787641200, \'YMD\')</script>',
  ].join("");
  assert.deepEqual(parseTopicList(html).map(({ path }) => path), [
    "/lodestone/topics/detail/a",
    "/lodestone/topics/detail/b",
    "/lodestone/topics/detail/c",
  ]);
});

test("開催期間を開始・終了日時へ変換する", () => {
  const actual = parseTopicSchedule(
    "配信応援キャンペーン",
    "開催期間\n2026年7月28日（火）18:00 ～ 8月25日（火）17:59\n※日時は変更される場合があります。",
    "2026-07-28",
  );
  assert.deepEqual(actual, {
    start: "2026-07-28T18:00:00+09:00",
    end: "2026-08-25T17:59:00+09:00",
    allDay: false,
  });
});

test("終了日のない開始日は1日予定にする", () => {
  const actual = parseTopicSchedule(
    "モグモグ★コレクション 9月9日（水）スタート！",
    "2026年9月9日（水）より開催します。",
    "2026-09-02",
  );
  assert.deepEqual(actual, { start: "2026-09-09", end: "2026-09-10", allDay: true });
});

test("複数日に個別時刻がある催事は全日予定にまとめる", () => {
  const actual = parseTopicSchedule(
    "東京ゲームショウ2026",
    "開催期間\n9月17日（木）10:00 ～ 17:00\n9月18日（金）10:00 ～ 17:00\n9月19日（土）9:30 ～ 17:00\n9月20日（日）9:30 ～ 17:00\n9月21日（月）9:30 ～ 16:00",
    "2026-09-04",
  );
  assert.deepEqual(actual, { start: "2026-09-17", end: "2026-09-22", allDay: true });
});
