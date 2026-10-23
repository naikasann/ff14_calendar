import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCuratedData,
  htmlToText,
  isRelevantScheduledTopic,
  parseMaintenanceList,
  parseMaintenanceRange,
  parseTopicList,
  parseTopicSchedule,
} from "./update-official-events.mjs";

test("HTMLを表示用テキストへ変換する", () => {
  assert.equal(htmlToText("全ワールド<br>メンテ&amp;更新"), "全ワールド\nメンテ&更新");
});

const { readFileSync } = await import("node:fs");
const curatedFixture = JSON.parse(readFileSync(
  new URL("../public/data/curated-official-events.json", import.meta.url), "utf8",
));
const officialFixture = JSON.parse(readFileSync(
  new URL("../public/data/official-events.json", import.meta.url), "utf8",
));

test("追跡済みの除外判断は自動再取得と保存済み期間指定より優先する", () => {
  const refetched = curatedFixture.excludedIds.map((id) => ({
    id, title: "再取得された除外予定", start: "2026-01-01", end: "2026-01-02",
  }));
  const selected = applyCuratedData(refetched, curatedFixture);
  assert.equal(selected.some(({ id }) => curatedFixture.excludedIds.includes(id)), false);
  assert.deepEqual(applyCuratedData(selected, curatedFixture), selected);
});

test("一覧から消えた採用予定も確定期間と要約を維持する", () => {
  const selected = applyCuratedData([], curatedFixture);
  for (const [id, override] of Object.entries(curatedFixture.eventOverrides)) {
    if (curatedFixture.excludedIds.includes(id)) continue;
    const actual = selected.find((event) => event.id === id);
    assert.ok(actual, id);
    assert.equal(actual.start, override.start);
    assert.equal(actual.end, override.end);
    assert.equal(actual.description, curatedFixture.summaryOverrides[id]);
  }
});

test("公開用データに除外済み予定や要約の上書きがない", () => {
  const ids = officialFixture.events.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);
  for (const event of officialFixture.events) {
    assert.equal(curatedFixture.excludedIds.includes(event.id), false, event.id);
    assert.ok(new Date(event.end) > new Date(event.start), event.id);
    assert.match(event.url, /^https:\/\//);
    if (curatedFixture.summaryOverrides[event.id]) {
      assert.equal(event.description, curatedFixture.summaryOverrides[event.id]);
      assert.ok(event.description.length >= 80 && event.description.length <= 120, event.id);
    }
  }
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

test("終了側が同月の日付だけでも開始・終了日時へ変換する", () => {
  const actual = parseTopicSchedule(
    "X投稿キャンペーン",
    "キャンペーン開催期間\n2026年9月10日（木）11:00 ～ 30日（水）23:59頃まで",
    "2026-09-10",
  );
  assert.deepEqual(actual, {
    start: "2026-09-10T11:00:00+09:00",
    end: "2026-09-30T23:59:00+09:00",
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

test("プレイヤー向け予定を残し、物販や予告だけの記事を除外する", () => {
  assert.equal(isRelevantScheduledTopic("モグモグ★コレクション開催！", ""), true);
  assert.equal(isRelevantScheduledTopic("第94回 FFXIV PLL 放送決定！", "日時"), true);
  assert.equal(isRelevantScheduledTopic("ファンフェスティバル ライブビューイング開催決定！ チケット販売開始", "開催概要"), true);
  assert.equal(isRelevantScheduledTopic("ファンフェスティバル オフィシャルグッズ予約開始！", "販売期間"), false);
  assert.equal(isRelevantScheduledTopic("「ファンフェスティバル 2026 in 東京」最新情報公開 第2弾！", "販売期間 配信スケジュール 応募期間"), false);
  assert.equal(isRelevantScheduledTopic("オプションアイテム追加＆セール開始！", "販売期間"), false);
  assert.equal(isRelevantScheduledTopic("ブランドとのコラボレーションプロジェクトが始動！", "開催概要"), false);
  assert.equal(isRelevantScheduledTopic("スクリーンショットキャンペーン開催！", "応募期間\n投稿すると報酬をプレゼント"), true);
});

test("週次選別の要約・除外・追加予定を反映する", () => {
  const events = [
    { id: "keep", start: "2026-09-09", description: "取得時の説明" },
    { id: "remove", start: "2026-09-10", description: "除外する説明" },
  ];
  const actual = applyCuratedData(events, {
    eventOverrides: {
      keep: { end: "2026-09-30", allDay: true },
      retained: {
        type: "campaign",
        title: "取得一覧から外れても残す予定",
        start: "2026-09-11",
        end: "2026-09-30",
        allDay: true,
        url: "https://example.com/retained",
      },
    },
    summaryOverrides: {
      keep: "週次で要約した説明",
      retained: "週次判断で保存した説明",
    },
    excludedIds: ["remove"],
    extraEvents: [{ id: "extra", start: "2026-09-08", description: "追加予定" }],
  });
  assert.deepEqual(actual, [
    { id: "extra", start: "2026-09-08", description: "追加予定" },
    {
      id: "keep",
      start: "2026-09-09",
      end: "2026-09-30",
      allDay: true,
      description: "週次で要約した説明",
    },
    {
      id: "retained",
      type: "campaign",
      title: "取得一覧から外れても残す予定",
      start: "2026-09-11",
      end: "2026-09-30",
      allDay: true,
      description: "週次判断で保存した説明",
      url: "https://example.com/retained",
    },
  ]);
});

