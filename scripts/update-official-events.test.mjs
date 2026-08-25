import assert from "node:assert/strict";
import test from "node:test";

import {
  htmlToText,
  parseMaintenanceList,
  parseMaintenanceRange,
  parseTopicList,
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

test("PvP終了告知とパッチノートだけを残す", () => {
  const html = [
    '<p class="news__list--title"><a href="/lodestone/topics/detail/a">PvPシリーズ11まもなく終了！</a></p><script>ldst_strftime(1787641200, \'YMD\')</script>',
    '<p class="news__list--title"><a href="/lodestone/topics/detail/b">7.56パッチノート公開！</a></p><script>ldst_strftime(1787641200, \'YMD\')</script>',
    '<p class="news__list--title"><a href="/lodestone/topics/detail/c">新生祭のお知らせ</a></p><script>ldst_strftime(1787641200, \'YMD\')</script>',
  ].join("");
  assert.deepEqual(parseTopicList(html).map(({ path }) => path), [
    "/lodestone/topics/detail/a",
    "/lodestone/topics/detail/b",
  ]);
});
