"use client";

import { useEffect, useMemo, useState } from "react";

import {
  CC_SEASON,
  addDays,
  formatDateKey,
  formatJapaneseDate,
  getCalendarDays,
  getFrontlineForDate,
  getHousingCycle,
  getJstToday,
  getMonthTitle,
  isSameDate,
  type CalendarDate,
} from "./schedule";

type CalendarFilter = "all" | "frontline" | "housing";
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

type CalendarEvent = {
  fileName: string;
  title: string;
  description: string;
  start: CalendarDate;
  endExclusive: CalendarDate;
};

function toIcsDate(date: CalendarDate): string {
  return formatDateKey(date).replaceAll("-", "");
}

function escapeIcsText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replaceAll("\n", "\\n");
}

function downloadCalendarEvent(event: CalendarEvent) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Eorzea Schedule//FF14 Calendar//JA",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${toIcsDate(event.start)}-${event.fileName}@ff14-calendar`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${toIcsDate(event.start)}`,
    `DTEND;VALUE=DATE:${toIcsDate(event.endExclusive)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(event.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${event.fileName}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

function getGoogleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toIcsDate(event.start)}/${toIcsDate(event.endExclusive)}`,
    details: event.description,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function Icon({ name }: { name: "left" | "right" | "external" | "calendar" | "home" | "sword" }) {
  const paths = {
    left: <path d="m15 18-6-6 6-6" />,
    right: <path d="m9 18 6-6-6-6" />,
    external: <><path d="M15 4h5v5M14 10l6-6M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" /></>,
    calendar: <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" />,
    home: <path d="m3 11 9-8 9 8M5 10v10h14V10M9 20v-6h6v6" />,
    sword: <path d="m14 5 5-2-2 5-9 9-3 1 1-3 8-10ZM13 9l5 5M16 12l-7 7M7 17l-2 2" />,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[name]}</svg>;
}

function Header() {
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="ページ上部へ">
        <span className="brand-mark">XIV</span>
        <span><strong>EORZEA SCHEDULE</strong><small>PvP &amp; Housing Calendar</small></span>
      </a>
      <nav aria-label="ページ内ナビゲーション">
        <a href="#today">今日</a><a href="#calendar">カレンダー</a><a href="#sources">公式情報</a>
      </nav>
      <span className="timezone-badge">JST</span>
    </header>
  );
}

function TodayPanel({ today }: { today: CalendarDate }) {
  const frontline = getFrontlineForDate(today);
  const nextFrontline = getFrontlineForDate(addDays(today, 1));
  const housing = getHousingCycle(today);

  return (
    <section className="today-section" id="today">
      <div className="section-heading">
        <div><p className="eyebrow">TODAY&apos;S OVERVIEW</p><h1>{formatJapaneseDate(today)}</h1></div>
        <div className="live-pill"><span />日本時間で自動更新</div>
      </div>

      <div className="overview-grid">
        <article className={`feature-card frontline-card map-${frontline.id}`}>
          <div className="card-glow" />
          <div className="card-topline">
            <span className="icon-box"><Icon name="sword" /></span><span>FRONTLINE</span><span className="status-chip">本日のルール</span>
          </div>
          <div className="feature-content">
            <p className="map-number">{String(frontline.cyclePosition).padStart(2, "0")}</p>
            <div><p className="map-label">{frontline.shortName}</p><h2>{frontline.name}</h2><p className="map-subtitle">{frontline.subtitle}</p></div>
          </div>
          <div className="card-footer-row"><span>毎日 0:00 切り替え</span><span>次回：{nextFrontline.shortName}</span></div>
        </article>

        <article className={`feature-card housing-card ${housing.phase}`}>
          <div className="card-topline">
            <span className="icon-box"><Icon name="home" /></span><span>HOUSING LOTTERY</span>
            <span className="status-chip">{housing.phase === "entry" ? "応募受付中" : "結果発表中"}</span>
          </div>
          <div className="housing-status">
            <span className="housing-symbol">{housing.phase === "entry" ? "ENTRY" : "RESULT"}</span>
            <div><p className="map-label">現在の期間</p><h2>{housing.phaseLabel}</h2><p>{housing.rangeLabel}</p></div>
          </div>
          <div className="progress-track" aria-label={`${housing.phaseDay}日目、全${housing.phaseLength}日`}>
            <span style={{ width: `${(housing.phaseDay / housing.phaseLength) * 100}%` }} />
          </div>
          <div className="card-footer-row">
            <span>{housing.phaseDay}日目 / {housing.phaseLength}日間</span><span>次回：{housing.nextPhaseLabel} {housing.nextPhaseDateLabel}</span>
          </div>
        </article>
      </div>

      <article className="season-card">
        <div className="season-emblem"><span>CC</span><small>21</small></div>
        <div className="season-copy"><p className="eyebrow">CRYSTALLINE CONFLICT</p><h2>シーズン {CC_SEASON.number} 開催中</h2><p>{CC_SEASON.startedLabel} 開幕・終了日は公式発表待ち</p></div>
        <div className="season-dc"><span>日本ランクマッチ</span><strong>{CC_SEASON.jpDataCenter}</strong></div>
        <a className="official-link" href={CC_SEASON.officialUrl} target="_blank" rel="noreferrer">公式発表 <Icon name="external" /></a>
      </article>
    </section>
  );
}

function CalendarCell({ date, displayMonth, filter, today }: { date: CalendarDate; displayMonth: CalendarDate; filter: CalendarFilter; today: CalendarDate }) {
  const frontline = getFrontlineForDate(date);
  const housing = getHousingCycle(date);
  const outside = date.month !== displayMonth.month;
  const current = isSameDate(date, today);

  return (
    <div className={`calendar-cell${outside ? " outside" : ""}${current ? " current" : ""}`}>
      <div className="date-line"><span>{date.day}</span>{current && <small>TODAY</small>}</div>
      {(filter === "all" || filter === "frontline") && <div className={`event-pill frontline-event map-${frontline.id}`}><span className="event-dot" /><strong>{frontline.shortName}</strong></div>}
      {(filter === "all" || filter === "housing") && <div className={`event-pill housing-event ${housing.phase}`}><span>{housing.phase === "entry" ? "家" : "抽"}</span><strong>{housing.phase === "entry" ? "応募" : "結果"}</strong></div>}
    </div>
  );
}

function MonthCalendar({ today }: { today: CalendarDate }) {
  const [month, setMonth] = useState<CalendarDate>({ year: today.year, month: today.month, day: 1 });
  const [filter, setFilter] = useState<CalendarFilter>("all");
  const days = useMemo(() => getCalendarDays(month), [month]);
  const moveMonth = (amount: number) => {
    const next = new Date(Date.UTC(month.year, month.month - 1 + amount, 1));
    setMonth({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: 1 });
  };

  return (
    <section className="calendar-section" id="calendar">
      <div className="calendar-toolbar">
        <div><p className="eyebrow">MONTHLY SCHEDULE</p><h2><Icon name="calendar" /> {getMonthTitle(month)}</h2></div>
        <div className="calendar-controls">
          <button type="button" className="month-button" onClick={() => moveMonth(-1)} aria-label="前の月"><Icon name="left" /></button>
          <button type="button" className="today-button" onClick={() => setMonth({ year: today.year, month: today.month, day: 1 })}>今月</button>
          <button type="button" className="month-button" onClick={() => moveMonth(1)} aria-label="次の月"><Icon name="right" /></button>
        </div>
      </div>

      <div className="filter-row" role="group" aria-label="カレンダーの表示内容">
        {([["all", "すべて"], ["frontline", "フロントライン"], ["housing", "ハウジング"]] as const).map(([value, label]) => (
          <button key={value} type="button" className={filter === value ? "active" : ""} onClick={() => setFilter(value)} aria-pressed={filter === value}>{label}</button>
        ))}
        <div className="legend"><span><i className="legend-entry" />応募期間</span><span><i className="legend-result" />結果期間</span></div>
      </div>

      <div className="calendar-shell">
        <div className="weekday-row">{WEEKDAYS.map((day, index) => <div key={day} className={index === 0 ? "sunday" : index === 6 ? "saturday" : ""}>{day}</div>)}</div>
        <div className="calendar-grid">
          {days.map((date) => <CalendarCell key={formatDateKey(date)} date={date} displayMonth={month} filter={filter} today={today} />)}
        </div>
      </div>
      <p className="calendar-note">※ フロントラインはパッチ7.5以降の8日周期、ハウジングは5日＋4日の抽選周期をもとに算出しています。</p>
    </section>
  );
}

function Sources() {
  const sources = [
    ["フロントライン周期", "https://jp.finalfantasyxiv.com/lodestone/topics/detail/072b03a01b057707a9b9b6476c898c9ed3c7c4a4"],
    ["ハウジング抽選", "https://jp.finalfantasyxiv.com/lodestone/topics/detail/ffe05674f919dad5f4f13d443f2fd7067a3dc2b0"],
    ["クリコンSeason 21", CC_SEASON.officialUrl],
  ];
  return (
    <section className="sources-section" id="sources">
      <div><p className="eyebrow">OFFICIAL SOURCES</p><h2>正確な予定はゲーム内・公式情報もご確認ください</h2><p>メンテナンスやパッチにより、通常の周期が変更される場合があります。</p></div>
      <div className="source-links">{sources.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noreferrer">{label}<Icon name="external" /></a>)}</div>
    </section>
  );
}

function ScheduleGuides({ today }: { today: CalendarDate }) {
  const housing = getHousingCycle(today);
  const upcomingFrontlines = [1, 2, 3].map((daysLater) => {
    const date = addDays(today, daysLater);
    return { date, schedule: getFrontlineForDate(date) };
  });
  const firstHousingStart = housing.nextPhaseDate;
  const firstHousing = getHousingCycle(firstHousingStart);
  const secondHousingStart = addDays(firstHousingStart, firstHousing.phaseLength);
  const upcomingHousing = [
    { date: firstHousingStart, schedule: firstHousing },
    { date: secondHousingStart, schedule: getHousingCycle(secondHousingStart) },
  ];

  return (
    <section className="details-grid" aria-label="スケジュールガイド">
      <article className="detail-card">
        <div>
          <p className="eyebrow">FRONTLINE GUIDE</p>
          <h3>フロントラインについて</h3>
          <p className="detail-description">大規模PvP「フロントライン」の本日のルールです。対象コンテンツは日本時間の毎日0:00に切り替わります。</p>
        </div>
        <div className="next-schedule">
          <strong>次回予定</strong>
          <ul>{upcomingFrontlines.map(({ date, schedule }) => <li key={formatDateKey(date)}><span>{date.month}/{date.day}</span>{schedule.name}（{schedule.subtitle}）</li>)}</ul>
        </div>
      </article>

      <article className="detail-card housing-detail">
        <div>
          <p className="eyebrow">HOUSING GUIDE</p>
          <h3>ハウジング抽選について</h3>
          <p className="detail-description">土地抽選は「応募5日間」と「結果発表4日間」の周期です。応募後は結果発表期間中に土地のサインボードで結果を確認します。</p>
        </div>
        <div className="next-schedule">
          <strong>次回予定</strong>
          <ul>{upcomingHousing.map(({ date, schedule }) => <li key={formatDateKey(date)}><span>{date.month}/{date.day}</span>{schedule.phaseLabel} 開始</li>)}</ul>
        </div>
      </article>
    </section>
  );
}

function CalendarExport({ today }: { today: CalendarDate }) {
  const frontline = getFrontlineForDate(today);
  const housing = getHousingCycle(today);
  const frontlineEvent: CalendarEvent = {
    fileName: `frontline-${formatDateKey(today)}`,
    title: `FF14 フロントライン：${frontline.name}`,
    description: `${frontline.name}（${frontline.subtitle}）。日本時間0:00に切り替わります。`,
    start: today,
    endExclusive: addDays(today, 1),
  };
  const housingEvent: CalendarEvent = {
    fileName: `housing-${housing.phase}-${formatDateKey(housing.phaseStart)}`,
    title: `FF14 ハウジング：${housing.phaseLabel}`,
    description: `ハウジング土地抽選の${housing.phaseLabel}です。${housing.rangeLabel}`,
    start: housing.phaseStart,
    endExclusive: addDays(housing.phaseEnd, 1),
  };

  return (
    <section className="calendar-export-section" id="calendar-export">
      <div>
        <p className="eyebrow">ADD TO YOUR CALENDAR</p>
        <h2>予定をカレンダーに追加</h2>
        <p>今日のフロントライン、または現在のハウジング抽選期間を登録できます。</p>
      </div>
      <div className="export-actions">
        <div className="export-event-group">
          <strong>本日のフロントライン</strong>
          <span>{frontline.name}（{frontline.subtitle}）</span>
          <div className="export-event-buttons">
            <button className="calendar-add-button" type="button" onClick={() => downloadCalendarEvent(frontlineEvent)}><Icon name="calendar" />.icsで追加</button>
            <a className="calendar-add-button google-calendar-button" href={getGoogleCalendarUrl(frontlineEvent)} target="_blank" rel="noreferrer">Googleカレンダーに追加<Icon name="external" /></a>
          </div>
        </div>
        <div className="export-event-group housing-export-group">
          <strong>現在のハウジング期間</strong>
          <span>{housing.phaseLabel}・{housing.rangeLabel}</span>
          <div className="export-event-buttons">
            <button className="calendar-add-button housing-add-button" type="button" onClick={() => downloadCalendarEvent(housingEvent)}><Icon name="calendar" />.icsで追加</button>
            <a className="calendar-add-button google-calendar-button" href={getGoogleCalendarUrl(housingEvent)} target="_blank" rel="noreferrer">Googleカレンダーに追加<Icon name="external" /></a>
          </div>
        </div>
      </div>
      <p className="ics-note">※ Googleカレンダーは予定入力画面が開きます。内容を確認して「保存」を押してください。.icsはOutlookやAppleカレンダーでも利用できます。</p>
    </section>
  );
}

export default function Home() {
  const [today, setToday] = useState<CalendarDate>({ year: 2026, month: 8, day: 14 });
  useEffect(() => {
    const updateToday = () => setToday(getJstToday());
    updateToday();
    const timer = window.setInterval(updateToday, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main id="top">
      <div className="aurora aurora-one" /><div className="aurora aurora-two" />
      <div className="page-shell">
        <Header /><TodayPanel today={today} /><MonthCalendar today={today} /><CalendarExport today={today} /><Sources /><ScheduleGuides today={today} />
        <footer><span>EORZEA SCHEDULE</span><p>FINAL FANTASY XIV 非公式ファンサイト</p><small>© SQUARE ENIX / 記載されている会社名・製品名は各社の商標または登録商標です。</small></footer>
      </div>
    </main>
  );
}
