// ==UserScript==
// @name         하이웍스 40시간 퇴근 계산기
// @name:ko      두들링 — 퇴근을 같이 기다리는 낙서 요정
// @namespace    https://github.com/OhJaeYoung95/hiworks-40h
// @version      2.0.34
// @description  종이에서 빠져나온 낙서 요정 두들링들이 주 40시간 기준 금요일 퇴근 시각을 알려 주고 함께 기다려 줘요.
// @match        *://*/*
// @run-at       document-idle
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @noframes
// @updateURL    https://ohjaeyoung95.github.io/doodling/hiworks-40h.user.js
// @downloadURL  https://ohjaeyoung95.github.io/doodling/hiworks-40h.user.js
// @homepageURL  https://github.com/OhJaeYoung95/doodling
// ==/UserScript==

(function (globalThis) {
// ---- version ----
globalThis.HW40_VERSION = "2.0.34";
globalThis.HW40_HOME = "https://ohjaeyoung95.github.io/doodling/";

// ---- platform ----
// 연결층: Tampermonkey 스크립트
// 기능 코드는 Tampermonkey·크롬 확장·데스크톱 앱 전용 기능을 직접 부르지 않고 HW40_PLATFORM을 거친다.
// 세 연결층(userscript / extension / desktop)은 같은 모양을 가진다:
//   kind            'userscript' | 'extension' | 'desktop'
//   get(key, def)   모든 사이트가 같이 보는 저장소에서 읽기 (바로 돌려준다)
//   set(key, value) 저장소에 쓰기. 성공하면 true
//   menu(label, fn) 사이트별 켜기/끄기 메뉴 (메뉴가 없는 곳에서는 아무것도 하지 않는다)
//   alwaysOn        true면 사이트 등록 없이 늘 켠다 (데스크톱 앱)
(function (root) {
  // 확인용 모의 페이지(?build=1)처럼 Tampermonkey 밖에서 돌리면 이 페이지의 localStorage를 쓴다.
  const gm = typeof GM_getValue === 'function' && typeof GM_setValue === 'function';
  root.HW40_PLATFORM = {
    kind: 'userscript',
    get: (key, def) => (gm ? GM_getValue(key, def) : JSON.parse(localStorage.getItem(key) || 'null') ?? def),
    set(key, value) {
      if (gm) GM_setValue(key, value);
      else localStorage.setItem(key, JSON.stringify(value));
      return true;
    },
    menu(label, fn) {
      if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand(label, fn);
    },
    alwaysOn: false,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

// ---- site.js ----
// 어느 사이트에서 켤지 정한다. 하이웍스 근무 페이지는 처음부터 켜져 있고,
// 다른 근무 페이지는 사용자가 "이 사이트에서 켜기"로 등록한다 (Tampermonkey 메뉴, 크롬 확장은 도구 모음 단추).
// 등록하지 않은 사이트에서는 메뉴만 만들고 아무것도 하지 않는다 (빌드된 스크립트는 여기서 바로 멈춘다).
// 사이트 목록과 사이트별 회사 설정은 연결층 저장소(HW40_PLATFORM, src/platform/)에 둔다. 모든 사이트에서 같이 보인다.
// 연결층이 없으면(확인용 모의 페이지) 이 페이지의 localStorage를 쓴다.
(function (root) {
  const BUILTIN = { 'hr-work.office.hiworks.com': '하이웍스' };
  const SITES_KEY = 'hw40-sites';
  const P = root.HW40_PLATFORM || {
    kind: 'page',
    get: (key, def) => JSON.parse(localStorage.getItem(key) || 'null') ?? def,
    set(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    },
    menu() {},
    alwaysOn: false,
  };
  const load = () => {
    try {
      const v = P.get(SITES_KEY, {});
      return v && typeof v === 'object' ? v : {};
    } catch {
      return {};
    }
  };
  const save = (sites) => {
    try {
      return P.set(SITES_KEY, sites);
    } catch {
      return false;
    }
  };

  const host = location.host;
  // 확인용 모의 페이지는 하이웍스 화면 흉내라 하이웍스로 본다.
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  // 확장은 페이지와 따로 돌아서 페이지의 window 값을 못 본다: 확인용 확장 빌드는 root에 같은 표시를 넣는다.
  const builtin = Boolean(BUILTIN[host]) || (local && (root.HW40_MOCK_HIWORKS === true || (typeof window !== 'undefined' && window.HW40_MOCK_HIWORKS === true)));
  const entry = () => load()[host] || null;
  const site = {
    host,
    builtin,
    builtinName: BUILTIN[host] || (builtin ? '하이웍스' : null),
    // 데스크톱 앱은 사이트 등록 없이 늘 켠다.
    enabled: builtin || P.alwaysOn === true || Boolean(entry()),
    platform: P.kind,
    // 이 사이트의 회사 설정 { name, rules, fields?, includesToday? } (없으면 null: 하이웍스 기본 규칙)
    company: () => (entry() && entry().company) || null,
    saveCompany(company) {
      const sites = load();
      sites[host] = { ...(sites[host] || {}), on: (sites[host] && sites[host].on) || Date.now(), company };
      return save(sites);
    },
    // 회사 설정을 지운다 (하이웍스는 기본 규칙으로 돌아간다).
    clearCompany() {
      const sites = load();
      if (!sites[host]) return;
      delete sites[host].company;
      save(sites);
    },
    enable() {
      const sites = load();
      sites[host] = { ...(sites[host] || {}), on: Date.now() };
      return save(sites);
    },
    disable() {
      const sites = load();
      delete sites[host];
      return save(sites);
    },
  };
  // 테마 만들기 화면 → 하이웍스 내 테마 목록. 만들기 화면(배포 주소)에서 보낸 테마 코드를
  // 연결층 저장소의 우편함에 넣어 두면, 하이웍스 화면이 꺼내 내 테마로 넣는다.
  const INBOX_KEY = 'hw40-theme-inbox';
  const INBOX_MAX = 5;
  const readInbox = () => {
    try {
      const v = P.get(INBOX_KEY, []);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };
  const writeInbox = (list) => {
    try {
      return P.set(INBOX_KEY, list);
    } catch {
      return false;
    }
  };
  site.inbox = {
    // 받은 테마들을 꺼낸다 (꺼내면 우편함은 빈다). [{ code, apply, at }]
    take() {
      const list = readInbox();
      if (list.length) writeInbox([]);
      return list.filter((x) => x && typeof x.code === 'string');
    },
    put(code, apply) {
      return writeInbox([...readInbox(), { code, apply: apply !== false, at: Date.now() }].slice(-INBOX_MAX));
    },
  };
  root.HW40_SITE = site;

  // 만들기 화면에서만 우편함 받는 곳을 연다. 확인용 모의 화면(localhost)도 받는다.
  const home = root.HW40_HOME;
  const makerPage = (home && location.href.indexOf(home) === 0) || (local && typeof window !== 'undefined' && window.HW40_MOCK_MAKER === true);
  if (makerPage && typeof window !== 'undefined') {
    window.addEventListener('message', (e) => {
      const d = e.data;
      if (e.origin !== location.origin || !d || d.type !== 'hw40-save-theme') return;
      const code = typeof d.code === 'string' ? d.code.trim() : '';
      const ok = /^HW40T\d+\./.test(code) && code.length < 4000000 && site.inbox.put(code, d.apply);
      window.postMessage({ type: 'hw40-theme-saved', ok, id: d.id }, location.origin);
    });
    // 만들기 화면이 "저장" 단추를 켤 수 있게 알린다.
    document.documentElement.dataset.hw40Inbox = '1';
    window.postMessage({ type: 'hw40-inbox-ready' }, location.origin);
  }

  // 사이트 켜기/끄기 메뉴 (Tampermonkey 메뉴. 크롬 확장은 도구 모음 단추가, 데스크톱 앱은 늘 켜져 있어 필요 없다)
  if (!site.enabled) {
    P.menu('⏱ 이 사이트에서 두들링 켜기', () => {
      if (site.enable()) location.reload();
    });
  } else if (!builtin && !P.alwaysOn) {
    P.menu('이 사이트에서 두들링 끄기', () => {
      if (window.confirm(`${host}에서 두들링을 끌까요? 이 사이트의 회사 설정도 지워져요.`) && site.disable()) location.reload();
    });
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);

// ---- gate ----
if (!globalThis.HW40_SITE.enabled) return;

// ---- config.js ----
// 회사 근무 규칙. 규칙이 바뀌면 이 파일만 고치면 된다.
(function (root) {
  const config = {
    weeklyHours: 40, // 주 근무시간
    workStart: '09:00', // 근무 인정 시작. 이보다 일찍 출근해도 이 시각부터 센다
    lunchStart: '13:00', // 점심시간 (근무시간에서 제외)
    lunchEnd: '14:00',
    fridayEarliestLeave: '17:00', // 금요일에 40시간을 채웠을 때 가장 빠른 퇴근 시각
    // 월~목에 보여주는 "금요일 예상 퇴근"의 가정
    plannedDailyHours: 8, // 목요일까지 남은 날 하루에 일한다고 보는 시간
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = config;
  else root.HW40_CONFIG = config;
})(typeof globalThis !== 'undefined' ? globalThis : this);

// ---- calc.js ----
// 근무 규칙과 계산. DOM에 의존하지 않아 node로 바로 테스트할 수 있다.
(function (root) {
  const H = 3600;
  const CONFIG = typeof module !== 'undefined' && module.exports ? require('./config.js') : root.HW40_CONFIG;
  const clock = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * H + m * 60;
  };
  // 지금 쓰는 근무 규칙. 회사 설정을 넣으면 setRules가 이 객체를 그대로 고쳐 쓴다 (다른 파일도 같은 객체를 본다).
  const RULES = {};
  // rules: company.js의 규칙 모양 { mode, hours, workStart, lunch, earliest, daily }. 없으면 config.js 기본값.
  function setRules(rules) {
    const r = rules || {
      mode: 'week',
      hours: CONFIG.weeklyHours,
      workStart: CONFIG.workStart,
      lunch: [CONFIG.lunchStart, CONFIG.lunchEnd],
      earliest: CONFIG.fridayEarliestLeave,
      daily: CONFIG.plannedDailyHours,
    };
    Object.assign(RULES, {
      mode: r.mode || 'week',
      hours: r.hours, // 'auto'면 월 단위에서 그달 평일 × 하루 시간
      autoHours: r.hours === 'auto',
      target: r.hours === 'auto' ? 0 : r.hours * H,
      weeklyTarget: r.hours === 'auto' ? 0 : r.hours * H,
      workStart: clock(r.workStart),
      lunchStart: r.lunch ? clock(r.lunch[0]) : 0,
      lunchEnd: r.lunch ? clock(r.lunch[1]) : 0,
      fridayEarliestLeave: r.earliest ? clock(r.earliest) : 0,
      plannedDaily: r.daily * H,
    });
    return RULES;
  }
  setRules(null);

  const TIME = '(\\d{1,2}:\\d{2}:\\d{2})';
  const DURATION = '((?:\\d+\\s*시간\\s*)?(?:\\d+\\s*분\\s*)?(?:\\d+\\s*초)?)';

  function timeToSec(s) {
    const [h, m, sec] = s.split(':').map(Number);
    return h * H + m * 60 + sec;
  }

  function secToTime(sec) {
    const s = Math.floor(sec);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(Math.floor(s / H))}:${pad(Math.floor((s % H) / 60))}:${pad(s % 60)}`;
  }

  function formatDuration(sec) {
    const s = Math.max(0, Math.floor(sec));
    return `${Math.floor(s / H)}시간 ${Math.floor((s % H) / 60)}분 ${s % 60}초`;
  }

  // "31시간 45분 57초" -> 초. 숫자가 없으면 null.
  function durationToSec(text) {
    if (!text || !/\d/.test(text)) return null;
    const part = (unit) => {
      const m = text.match(new RegExp(`(\\d+)\\s*${unit}`));
      return m ? Number(m[1]) : 0;
    };
    return part('시간') * H + part('분') * 60 + part('초');
  }

  function parseWeek(text) {
    const m = text.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*~\s*(?:(\d{1,2})월\s*)?(\d{1,2})일/);
    if (!m) return null;
    const year = Number(m[1]);
    const startMonth = Number(m[2]);
    const endMonth = m[4] ? Number(m[4]) : startMonth;
    return {
      start: new Date(year, startMonth - 1, Number(m[3])),
      end: new Date(endMonth < startMonth ? year + 1 : year, endMonth - 1, Number(m[5])),
    };
  }

  // 00:00:00 은 "아직 기록 없음"으로 표시되는 자리표시자다.
  function parseClock(text, label) {
    const nearButton = text.match(new RegExp(`${label}하기\\s*${TIME}`));
    const m = nearButton || text.match(new RegExp(`${TIME}\\s*${label}`));
    if (!m) return { found: false, sec: null };
    const sec = timeToSec(m[1]);
    return { found: true, sec: sec === 0 ? null : sec };
  }

  // 주간 근무현황의 요일 칸("출근 08:55 퇴근 18:00 총 8시간 4분 33초")에서 근무 인정 시작(9시) 전에
  // 출근해 사이트 합계에 더해진 시간을 모은다. 요일 이름과 칸이 떨어져 읽혀도 되도록 칸 내용만 찾는다.
  // 그날 합계에서 9시~퇴근 근무시간을 뺀 만큼이 9시 전 시간이다 (퇴근 전인 오늘 칸은 "총"이 없어 건너뛴다).
  function earlyArrival(text) {
    const cell = new RegExp(`출근\\s*(\\d{1,2}:\\d{2})(?::\\d{2})?\\s*퇴근\\s*(\\d{1,2}:\\d{2})(?::\\d{2})?\\s*총\\s*:?\\s*${DURATION}`, 'g');
    let extra = 0;
    for (const m of text.matchAll(cell)) {
      const inSec = timeToSec(`${m[1]}:00`);
      const outSec = timeToSec(`${m[2]}:00`);
      const total = durationToSec(m[3]);
      if (inSec >= RULES.workStart || total === null) continue;
      // 화면의 출근 시각은 분까지라 1분 안쪽 여유를 둔다.
      const cap = RULES.workStart - inSec + 59;
      extra += Math.max(0, Math.min(total - workedBetween(RULES.workStart, outSec), cap));
    }
    return extra;
  }

  function parsePage(text) {
    const summaryAt = text.lastIndexOf('주간 합계');
    const summary = summaryAt >= 0 ? text.slice(summaryAt) : '';

    const weeklyMatch = summary.match(new RegExp(`실근무[\\s\\S]*?총\\s*:\\s*${DURATION}`));
    let worked = weeklyMatch ? durationToSec(weeklyMatch[1]) : null;
    if (worked === null) {
      // 합계 영역을 못 읽으면 요일별 "총 7시간 48분 39초"를 더한다.
      const days = [...text.matchAll(new RegExp(`총\\s+${DURATION}`, 'g'))]
        .map((m) => durationToSec(m[1]))
        .filter((v) => v !== null);
      if (days.length) worked = days.reduce((a, b) => a + b, 0);
    }

    // 사이트 합계는 실제 출근 시각부터 센 값이라 9시 전 시간을 뺀다.
    const early = earlyArrival(text);
    if (worked !== null) worked = Math.max(0, worked - early);

    const leaveMatch = summary.match(new RegExp(`휴가\\s*${DURATION}`));
    const leave = (leaveMatch && durationToSec(leaveMatch[1])) || 0;

    const clockIn = parseClock(text, '출근');
    const clockOut = parseClock(text, '퇴근');

    const missing = [];
    const week = parseWeek(text);
    if (!week) missing.push('주간 날짜');
    if (worked === null) missing.push('주간 근무시간');
    if (!clockIn.found) missing.push('출근 시각');

    return { week, worked, early, leave, clockIn: clockIn.sec, clockOut: clockOut.sec, missing };
  }

  // 점심시간을 제외한 실제 근무시간
  function workedBetween(from, to) {
    if (to <= from) return 0;
    const lunch = Math.max(0, Math.min(to, RULES.lunchEnd) - Math.max(from, RULES.lunchStart));
    return to - from - lunch;
  }

  // from부터 need초를 더 일하면 끝나는 시각 (점심시간은 건너뜀)
  function finishTime(from, need) {
    let start = from;
    if (start >= RULES.lunchStart && start < RULES.lunchEnd) start = RULES.lunchEnd;
    const end = start + need;
    if (start < RULES.lunchStart && end > RULES.lunchStart) return end + (RULES.lunchEnd - RULES.lunchStart);
    return end;
  }

  // 월~목: 목요일까지 남은 날을 하루 plannedDaily씩 일하고, 금요일에 오늘과 같은 시각에 출근한다고 보고
  // 금요일에 몇 시에 퇴근할 수 있을지 계산한다. 오늘 이미 일한 시간은 그대로 센다.
  function fridayForecast(page, weekday, total, todayWorked, clockedOut) {
    if (weekday < 1 || weekday > 4) return null;
    const todayMore = clockedOut ? 0 : Math.max(0, RULES.plannedDaily - todayWorked);
    const planned = total + todayMore + RULES.plannedDaily * (4 - weekday);
    const need = Math.max(0, RULES.weeklyTarget - planned);
    const start = page.clockIn !== null ? Math.max(page.clockIn, RULES.workStart) : RULES.workStart;
    return {
      need,
      start,
      leaveAt: Math.max(finishTime(start, need), RULES.fridayEarliestLeave),
      daily: RULES.plannedDaily,
    };
  }

  // 오늘 이번 달 남은 평일 수 (오늘 포함 여부 선택). 공휴일은 모른다.
  function weekdaysLeft(now, includeToday) {
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    let n = 0;
    for (let d = now.getDate() + (includeToday ? 0 : 1); d <= last; d += 1) {
      const day = new Date(now.getFullYear(), now.getMonth(), d).getDay();
      if (day !== 0 && day !== 6) n += 1;
    }
    return n;
  }

  // 이번 달 평일 수 × 하루 시간 (월 단위 자동 목표)
  function monthTarget(now) {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return weekdaysLeft(first, true) * RULES.plannedDaily;
  }

  // 하루 단위 (시차출퇴근): 출근 시각 + 하루 목표 = 퇴근
  function evaluateDay(base, page, nowSec, startSec, clockedOut) {
    const target = RULES.target;
    const floor = (t) => Math.max(t, RULES.fridayEarliestLeave);
    if (startSec === null) {
      return { ...base, state: 'not-started', total: 0, remaining: target, leaveAt: floor(finishTime(Math.max(nowSec, RULES.workStart), target)) };
    }
    if (clockedOut) {
      const total = workedBetween(startSec, page.clockOut);
      return { ...base, state: 'clocked-out', total, remaining: target - total };
    }
    const total = workedBetween(startSec, nowSec);
    const leaveAt = floor(finishTime(startSec, target));
    return { ...base, state: 'working', total, remaining: Math.max(0, target - total), reachAt: leaveAt, leaveAt };
  }

  // 월 단위: 남은 시간을 남은 평일에 똑같이 나눠, 오늘 몇 시에 나가면 되는지 권한다.
  function evaluateMonth(base, page, now, nowSec, startSec, todayWorked, clockedOut) {
    const before = page.worked + page.leave;
    const target = RULES.autoHours ? monthTarget(now) : RULES.target;
    base = { ...base, target };
    if (clockedOut) {
      const daysLeft = weekdaysLeft(now, false);
      const remaining = target - before;
      return { ...base, state: 'clocked-out', total: before, remaining, month: { daysLeft, share: daysLeft ? Math.max(0, remaining) / daysLeft : 0 } };
    }
    const daysLeft = Math.max(1, weekdaysLeft(now, true));
    const share = Math.max(0, target - before) / daysLeft;
    if (startSec === null) {
      return { ...base, state: 'not-started', total: before, remaining: Math.max(0, target - before), leaveAt: null, month: { daysLeft, share } };
    }
    const total = before + todayWorked;
    const leaveAt = Math.max(finishTime(startSec, share), RULES.fridayEarliestLeave);
    return { ...base, state: 'working', total, remaining: Math.max(0, target - total), reachAt: leaveAt, leaveAt, month: { daysLeft, share } };
  }

  function evaluate(page, now) {
    if (page.missing.length) return { state: 'unreadable', missing: page.missing };

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // 이번 주 날짜를 읽은 화면(하이웍스)에서만 다른 주인지 본다.
    if (page.week && (today < page.week.start || today > page.week.end)) return { state: 'other-week' };

    const nowSec = now.getHours() * H + now.getMinutes() * 60 + now.getSeconds();
    const isFriday = now.getDay() === 5;
    const base = { isFriday, nowSec, target: RULES.target, mode: RULES.mode };
    const clockedOut = page.clockIn !== null && page.clockOut !== null;
    // 근무 인정 시작보다 일찍 출근했으면 그 시각부터 센다.
    const startSec = page.clockIn !== null ? Math.max(page.clockIn, RULES.workStart) : null;
    const todayWorked = startSec !== null && !clockedOut ? workedBetween(startSec, nowSec) : 0;
    // 누적에 오늘 일하는 중인 시간이 이미 들어 있는 화면이면 그만큼 빼고 아래에서 다시 더한다.
    if (page.includesToday && todayWorked && page.worked !== null) page = { ...page, worked: Math.max(0, page.worked - todayWorked) };

    if (RULES.mode === 'day') return evaluateDay(base, page, nowSec, startSec, clockedOut);
    if (RULES.mode === 'month') return evaluateMonth(base, page, now, nowSec, startSec, todayWorked, clockedOut);

    const before = page.worked + page.leave; // 오늘 진행분 제외(퇴근 후에는 사이트 합계에 포함됨)

    if (clockedOut) {
      return {
        ...base,
        state: 'clocked-out',
        total: before,
        remaining: RULES.weeklyTarget - before,
        friday: fridayForecast(page, now.getDay(), before, 0, true),
      };
    }

    if (startSec === null) {
      const need = Math.max(0, RULES.weeklyTarget - before);
      return {
        ...base,
        state: 'not-started',
        total: before,
        remaining: need,
        leaveAt: isFriday ? Math.max(finishTime(Math.max(nowSec, RULES.workStart), need), RULES.fridayEarliestLeave) : null,
        friday: fridayForecast(page, now.getDay(), before, 0, false),
      };
    }

    const total = before + todayWorked;
    const need = Math.max(0, RULES.weeklyTarget - before);
    const reachAt = finishTime(startSec, need);
    return {
      ...base,
      state: 'working',
      total,
      remaining: Math.max(0, RULES.weeklyTarget - total),
      reachAt,
      earlyLeave: isFriday && reachAt <= RULES.fridayEarliestLeave,
      leaveAt: isFriday ? Math.max(reachAt, RULES.fridayEarliestLeave) : null,
      friday: fridayForecast(page, now.getDay(), total, todayWorked, false),
    };
  }

  // 캐릭터 상태: 평소 / 퇴근 1시간 전부터 서두름 / 퇴근 가능 시각에 축하 / 퇴근 후 휴식
  function mascotMood(r) {
    if (!r) return 'normal';
    if (r.state === 'clocked-out') return 'rest';
    // 오늘 퇴근 시각이 있는 날 (주 단위의 금요일, 월·하루 단위는 매일)
    if (r.state === 'working' && typeof r.leaveAt === 'number') {
      if (r.nowSec >= r.leaveAt) return 'celebrate';
      if (r.leaveAt - r.nowSec <= H) return 'hurry';
    }
    return 'normal';
  }

  const api = { RULES, setRules, parsePage, evaluate, mascotMood, workedBetween, finishTime, secToTime, formatDuration, timeToSec };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HW40 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

// ---- company.js ----
// 회사 설정: 근무 규칙(유연근무 방식) + 근무 페이지에서 읽을 곳 + 주고받는 "회사 설정 코드".
// DOM 없이 돌아가서 node로 테스트한다. 화면에서 읽을 곳을 가르치는 부분은 reader.js가 맡는다.
//
// 근무 규칙 (rules)
//   mode      week: 주 단위 정산 (주 목표를 채우면 금요일 조기 퇴근)
//             month: 월 단위 정산 (남은 시간을 남은 평일에 나눠 오늘 권장 퇴근 시각)
//             day: 하루 단위 (시차출퇴근: 출근 + 하루 시간 = 퇴근)
//   hours     목표 시간 (week: 주, month: 월, day: 하루)
//   workStart 근무 인정 시작. 이보다 일찍 와도 이 시각부터 센다
//   lunch     [시작, 끝] 근무에서 빼는 점심시간. 없으면 null
//   earliest  가장 빠른 퇴근 시각 (금요일 조기 퇴근 하한, 하루 모드에서는 코어타임 끝). 없으면 null
//   daily     예상 계산에 쓰는 하루 근무시간 (주 모드: 월~목 예상)
(function (root) {
  const CODE_PREFIX = 'HW40S1.';
  const NAME_MAX = 30;
  const FIELDS = ['worked', 'clockIn', 'clockOut', 'leave'];

  class CompanyError extends Error {}

  // 근무 방식마다 모르는 값을 채울 기본값
  const PRESETS = {
    week: { label: '주 단위 선택근무 (금요일 조기 퇴근)', rules: { mode: 'week', hours: 40, workStart: '09:00', lunch: ['13:00', '14:00'], earliest: '17:00', daily: 8 } },
    // hours 'auto': 이번 달 평일 수 × 하루 시간
    month: { label: '월 단위 선택근무', rules: { mode: 'month', hours: 'auto', workStart: '09:00', lunch: ['12:00', '13:00'], earliest: null, daily: 8 } },
    day: { label: '하루 단위 (시차출퇴근)', rules: { mode: 'day', hours: 8, workStart: '07:00', lunch: ['12:00', '13:00'], earliest: null, daily: 8 } },
  };
  // 패널에서 고르는 프리셋. 첫 번째(우리 회사)가 기본이다.
  const PRESET_LIST = [
    { id: 'ours', label: '우리 회사 기본 (주 40시간 · 9시부터 · 점심 13~14시 · 금 17시)', rules: PRESETS.week.rules },
    { id: 'week40', label: '주 40시간 · 점심 12~13시 · 금 16시', rules: { mode: 'week', hours: 40, workStart: '08:00', lunch: ['12:00', '13:00'], earliest: '16:00', daily: 8 } },
    { id: 'week35', label: '주 35시간 단축근무', rules: { mode: 'week', hours: 35, workStart: '09:00', lunch: ['12:00', '13:00'], earliest: '15:00', daily: 7 } },
    { id: 'month', label: '월 단위 선택근무 (평일 × 8시간 자동)', rules: PRESETS.month.rules },
    { id: 'day8', label: '시차출퇴근 하루 8시간 (7시부터)', rules: PRESETS.day.rules },
    { id: 'core', label: '시차출퇴근 + 코어타임 10~16시', rules: { mode: 'day', hours: 8, workStart: '07:00', lunch: ['12:00', '13:00'], earliest: '16:00', daily: 8 } },
  ];
  const DEFAULT_PRESET = PRESET_LIST[0];
  // 이 규칙과 똑같은 프리셋 (없으면 null: 직접 고친 규칙)
  const presetOf = (rules) => PRESET_LIST.find((p) => JSON.stringify(normalizeRules(p.rules)) === JSON.stringify(normalizeRules(rules))) || null;

  const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;
  const cleanClock = (v, fallback) => {
    const m = String(v || '').trim().match(HHMM);
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : fallback;
  };
  const minutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

  // 규칙을 검사해 고친다. 모르는 값은 그 방식의 기본값으로.
  function normalizeRules(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const mode = PRESETS[r.mode] ? r.mode : 'week';
    const base = PRESETS[mode].rules;
    const limit = { week: [1, 80], month: [1, 400], day: [1, 16] }[mode];
    const num = (v, lo, hi, d) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.min(hi, Math.max(lo, Number(v))) : d);
    let lunch = null;
    if (Array.isArray(r.lunch) && r.lunch.length === 2) {
      const a = cleanClock(r.lunch[0], null);
      const b = cleanClock(r.lunch[1], null);
      if (a && b && minutes(b) > minutes(a)) lunch = [a, b];
    } else if (r.lunch === undefined) lunch = base.lunch;
    const auto = mode === 'month' && (r.hours === 'auto' || (r.hours === undefined && base.hours === 'auto'));
    return {
      mode,
      hours: auto ? 'auto' : Math.round(num(r.hours, limit[0], limit[1], base.hours === 'auto' ? 160 : base.hours) * 100) / 100,
      workStart: cleanClock(r.workStart, base.workStart),
      lunch,
      earliest: r.earliest === null ? null : cleanClock(r.earliest, r.earliest === undefined ? base.earliest : null),
      daily: Math.round(num(r.daily, 1, 16, base.daily) * 100) / 100,
    };
  }

  // 읽을 곳 하나: { sel: CSS 선택자, label: 옆에 있던 이름표 글자 }
  function normalizeField(f) {
    if (!f || typeof f !== 'object' || typeof f.sel !== 'string' || !f.sel.trim()) return null;
    const out = { sel: f.sel.trim().slice(0, 600) };
    if (typeof f.label === 'string' && f.label.trim()) out.label = f.label.trim().slice(0, 40);
    // 이름표에서 칸까지의 길 (화면 구조가 바뀌었을 때 다시 찾는 데 쓴다)
    if (out.label && typeof f.rel === 'string' && f.rel.trim() && Number.isInteger(f.up) && f.up >= 0 && f.up <= 6) {
      out.rel = f.rel.trim().slice(0, 300);
      out.up = f.up;
    }
    return out;
  }

  // 회사 설정 전체. fields가 없으면 하이웍스처럼 이미 아는 화면(규칙만 바꿈)이다.
  function normalizeCompany(raw) {
    if (!raw || typeof raw !== 'object') throw new CompanyError('회사 설정이 비어 있어요.');
    const out = {
      name: String(raw.name || '우리 회사').replace(/[<>&"]/g, '').trim().slice(0, NAME_MAX) || '우리 회사',
      rules: normalizeRules(raw.rules),
    };
    if (raw.host) out.host = String(raw.host).slice(0, 200);
    if (raw.fields && typeof raw.fields === 'object') {
      const fields = {};
      for (const key of FIELDS) {
        const f = normalizeField(raw.fields[key]);
        if (f) fields[key] = f;
      }
      // 하루 단위는 출근 시각만 있으면 되고, 주·월 단위는 누적 근무시간이 꼭 있어야 한다.
      if (out.rules.mode === 'day' ? !fields.clockIn : !fields.worked) {
        throw new CompanyError(out.rules.mode === 'day'
          ? '출근 시각을 읽을 곳이 없어요. 읽을 곳을 다시 가르쳐 주세요.'
          : '누적 근무시간을 읽을 곳이 없어요. 읽을 곳을 다시 가르쳐 주세요.');
      }
      out.fields = fields;
      out.includesToday = Boolean(raw.includesToday);
    }
    return out;
  }

  async function pipe(bytes, stream) {
    return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
  }
  const bytesToB64 = (bytes) => {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const b64ToBytes = (text) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

  async function encodeCompany(company) {
    const json = new TextEncoder().encode(JSON.stringify(normalizeCompany(company)));
    return CODE_PREFIX + bytesToB64(await pipe(json, new CompressionStream('deflate')));
  }
  async function decodeCompany(code) {
    const text = String(code || '').replace(/\s+/g, '');
    if (!text.startsWith(CODE_PREFIX)) {
      if (/^HW40(T|C|V)/.test(text)) throw new CompanyError('회사 설정 코드가 아니에요. 테마·캐릭터·초대 코드는 다른 곳에 넣어 주세요.');
      throw new CompanyError(`회사 설정 코드가 아니에요. "${CODE_PREFIX}"로 시작하는 코드를 붙여 넣어 주세요.`);
    }
    let raw;
    try {
      raw = JSON.parse(new TextDecoder().decode(await pipe(b64ToBytes(text.slice(CODE_PREFIX.length)), new DecompressionStream('deflate'))));
    } catch {
      throw new CompanyError('회사 설정 코드가 깨졌어요. 처음부터 끝까지 다 복사했는지 확인해 주세요.');
    }
    return normalizeCompany(raw);
  }

  // ---------- 화면 글자 → 시간 ----------
  // 걸린 시간: "31:45:57", "31:45", "31시간 45분 57초", "8시간", "31h 45m", "7.5시간", "7.5h"
  function parseDurationText(text) {
    const t = String(text || '').replace(/\s+/g, ' ');
    let m = t.match(/(\d{1,3}):([0-5]\d)(?::([0-5]\d))?/);
    if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] || 0);
    m = t.match(/(\d+(?:\.\d+)?)\s*(?:시간|h(?:ours?|rs?)?\b)/i);
    const mm = t.match(/(\d+)\s*(?:분|m(?:in(?:utes?)?)?\b)/i);
    const ss = t.match(/(\d+)\s*(?:초|s(?:ec(?:onds?)?)?\b)/i);
    if (!m && !mm && !ss) return null;
    return Math.round((m ? Number(m[1]) : 0) * 3600) + (mm ? Number(mm[1]) : 0) * 60 + (ss ? Number(ss[1]) : 0);
  }
  // 하루 중 시각: "09:12", "09:12:30", "오후 6:03", "PM 6:03", "18시 3분". 빈 칸·"--:--"·"00:00:00"은 기록 없음(null).
  function parseClockText(text) {
    const t = String(text || '');
    let h;
    let mi;
    let s = 0;
    let m = t.match(/(\d{1,2}):([0-5]\d)(?::([0-5]\d))?/);
    if (m) [h, mi, s] = [Number(m[1]), Number(m[2]), Number(m[3] || 0)];
    else {
      m = t.match(/(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/);
      if (!m) return null;
      [h, mi] = [Number(m[1]), Number(m[2] || 0)];
    }
    if (/오후|PM/i.test(t) && h < 12) h += 12;
    if (/오전|AM/i.test(t) && h === 12) h = 0;
    if (h > 23) return null;
    const sec = h * 3600 + mi * 60 + s;
    return sec === 0 ? null : sec;
  }
  // 시간처럼 생긴 글자인가 (가르칠 때 후보로 표시)
  const TIME_LIKE = /(\d{1,3}:[0-5]\d)|(\d+(?:\.\d+)?\s*시간)|(\d+\s*분)|(\d+(?:\.\d+)?\s*h\b)/i;

  const company = {
    CODE_PREFIX, FIELDS, PRESETS, PRESET_LIST, DEFAULT_PRESET, presetOf, CompanyError, TIME_LIKE,
    normalizeRules, normalizeCompany, encodeCompany, decodeCompany, parseDurationText, parseClockText,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = company;
  else root.HW40_COMPANY = company;
})(typeof globalThis !== 'undefined' ? globalThis : this);

// ---- reader.js ----
// 처음 보는 근무 페이지: 사용자가 화면에서 "여기가 누적 근무시간" 하고 찍어 주면 그 자리를 기억했다가 5초마다 다시 읽는다.
// 브라우저 기본 기능(DOM)만 쓴다: 글자 찾기(TreeWalker) · 위치(getBoundingClientRect) · 찍은 곳의 길(CSS 선택자) · 다시 찾기(querySelector).
// 근무 시스템에 따로 요청하지 않고, 사용자가 보고 있는 화면만 읽는다.
(function (root) {
  const C = root.HW40_COMPANY;
  const { parseDurationText, parseClockText, TIME_LIKE } = C;

  // 읽을 곳 종류
  const STEPS = [
    { key: 'worked', kind: 'duration', title: '이번 주(또는 이번 달) 누적 근무시간', need: 'week' },
    { key: 'clockIn', kind: 'clock', title: '오늘 출근 시각', need: 'day' },
    { key: 'clockOut', kind: 'clock', title: '오늘 퇴근 시각 (퇴근 전이라 비어 있으면 그 빈칸)' },
    { key: 'leave', kind: 'duration', title: '휴가로 인정된 시간' },
  ];
  const isOurs = (el) => el && el.closest && el.closest('[data-hw40]');

  // ---------- 찍은 곳 기억하기 ----------
  const SAFE_ID = /^[A-Za-z][\w-]{1,40}$/;
  // 숫자가 잔뜩 섞인 id는 새로고침마다 바뀌는 경우가 많아 쓰지 않는다.
  const stableId = (id) => SAFE_ID.test(id) && (id.match(/\d/g) || []).length <= 3;
  const nth = (node) => {
    let n = 1;
    for (let sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) if (sib.tagName === node.tagName) n += 1;
    return `${node.tagName.toLowerCase()}:nth-of-type(${n})`;
  };
  // stop 바로 아래부터 el까지의 상대 경로 (stop이 없으면 body부터)
  function pathBetween(stop, el) {
    const parts = [];
    for (let node = el; node && node !== stop; node = node.parentElement) parts.unshift(nth(node));
    return parts.join(' > ');
  }
  function selectorOf(el) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.body && node !== document.documentElement) {
      if (node.id && stableId(node.id) && document.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1) {
        parts.unshift(`#${CSS.escape(node.id)}`);
        return parts.join(' > ');
      }
      const tag = node.tagName.toLowerCase();
      let n = 1;
      for (let sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) if (sib.tagName === node.tagName) n += 1;
      parts.unshift(`${tag}:nth-of-type(${n})`);
      node = node.parentElement;
    }
    parts.unshift('body');
    return parts.join(' > ');
  }
  const textOf = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  // 찍은 칸 옆의 이름표 글자 (예: "누적 근무", "출근")와, 이름표에서 그 칸까지 가는 길.
  // 화면 구조가 바뀌어 원래 길로 못 찾으면, 이름표를 찾아 같은 모양의 길로 그 칸을 찾는다.
  //   up: 이름표 글자에서 몇 단계 올라가면 둘을 함께 감싼 상자인지, rel: 그 상자에서 칸까지의 길
  const isLabel = (text) => text && text.length <= 20 && /[가-힣A-Za-z]/.test(text) && !TIME_LIKE.test(text);
  function anchorOf(el) {
    let box = el;
    for (let depth = 0; depth < 4 && box.parentElement && box.parentElement !== document.documentElement; depth += 1) {
      box = box.parentElement;
      const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        if (el.contains(t) || isOurs(t.parentElement)) continue;
        const text = t.nodeValue.trim();
        if (!isLabel(text)) continue;
        let up = 0;
        for (let a = t.parentElement; a && a !== box; a = a.parentElement) up += 1;
        return { label: text, up, rel: pathBetween(box, el) };
      }
    }
    return {};
  }
  const labelOf = (el) => anchorOf(el).label || '';

  // ---------- 다시 찾기 ----------
  const parse = (kind, text) => (kind === 'clock' ? parseClockText(text) : parseDurationText(text));
  // 이름표 글자를 찾아, 가르칠 때와 같은 모양의 길로 칸을 찾는다. 모양이 다르면 찾지 않는다 (엉뚱한 칸을 읽지 않게).
  function findByAnchor(field) {
    if (!field.label || !field.rel || typeof field.up !== 'number') return null;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      if (t.nodeValue.trim() !== field.label || isOurs(t.parentElement)) continue;
      let box = t.parentElement;
      for (let i = 0; i < field.up && box; i += 1) box = box.parentElement;
      if (!box) continue;
      let el = null;
      try {
        el = box.querySelector(`:scope > ${field.rel}`);
      } catch {
        el = null;
      }
      if (el) return el;
    }
    return null;
  }
  // 읽을 곳 하나를 읽는다. found: 그 자리를 찾았는지, value: 읽은 값 (초, 비어 있으면 null)
  function readField(field, kind) {
    if (!field) return { found: false, value: null };
    let el = null;
    try {
      el = document.querySelector(field.sel);
    } catch {
      el = null;
    }
    let value = el ? parse(kind, textOf(el)) : null;
    // 그 자리가 없어졌거나, 누적 시간인데 숫자가 없으면 이름표로 다시 찾아본다.
    if (!el || (value === null && kind === 'duration')) {
      const again = findByAnchor(field);
      if (again) {
        el = again;
        value = parse(kind, textOf(el));
      }
    }
    return { found: Boolean(el), value };
  }
  // 가르친 회사 설정으로 화면을 읽어 calc.js가 쓰는 모양으로 만든다.
  function readPage(company) {
    const f = company.fields || {};
    const worked = readField(f.worked, 'duration');
    const clockIn = readField(f.clockIn, 'clock');
    const clockOut = readField(f.clockOut, 'clock');
    const leave = readField(f.leave, 'duration');
    const missing = [];
    const dayMode = company.rules && company.rules.mode === 'day';
    if (!dayMode && (!worked.found || worked.value === null)) missing.push('누적 근무시간');
    if (f.clockIn && !clockIn.found) missing.push('출근 시각');
    return {
      week: null,
      worked: dayMode ? 0 : worked.value,
      early: 0,
      leave: leave.value || 0,
      clockIn: clockIn.value,
      clockOut: clockOut.value,
      includesToday: Boolean(company.includesToday),
      missing,
    };
  }

  // ---------- 가르치기 화면 ----------
  // 화면 위에 투명한 막을 씌우고, 시간처럼 생긴 글자에 점선 테두리를 친다. 막 아래 요소를 눌러 고른다.
  // mode: 규칙 방식 (day면 출근 시각이 필수). done({ fields, includesToday }) / cancel()
  function teach({ mode, done, cancel }) {
    const host = document.createElement('div');
    host.dataset.hw40 = 'teach';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;';
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        #veil { position: fixed; inset: 0; cursor: crosshair; background: rgba(20,30,60,.08); }
        .cand { position: fixed; border: 1.5px dashed #3b5ba9; border-radius: 4px; background: rgba(59,91,169,.06); pointer-events: none; }
        .picked { position: fixed; border: 2px solid #2e7d32; border-radius: 4px; background: rgba(46,125,50,.12); pointer-events: none; }
        .picked span { position: absolute; left: 0; top: -18px; padding: 0 5px; border-radius: 6px; background: #2e7d32; color: #fff; font: 600 11px/16px 'Malgun Gothic', sans-serif; white-space: nowrap; }
        #hover { position: fixed; border: 2px solid #d9822b; border-radius: 4px; background: rgba(217,130,43,.12); pointer-events: none; display: none; }
        #bar { position: fixed; left: 50%; top: 12px; transform: translateX(-50%); max-width: calc(100vw - 32px); box-sizing: border-box;
          padding: 10px 14px; background: #fff; color: #222; border: 1px solid #d5dbe5; border-left: 4px solid #3b5ba9; border-radius: 8px;
          box-shadow: 0 6px 20px rgba(0,0,0,.2); font: 13px/1.5 'Malgun Gothic', sans-serif; cursor: default; }
        #bar b { color: #3b5ba9; }
        #bar .sub { color: #667; font-size: 12px; }
        #bar .acts { display: flex; flex-wrap: wrap; gap: 6px 12px; margin-top: 6px; align-items: center; }
        #bar button { border: 0; background: none; color: #3b5ba9; cursor: pointer; font: 600 12px 'Malgun Gothic', sans-serif; padding: 0; }
        #bar label { font-size: 12px; color: #334; }
        #seen { color: #2e7d32; font-weight: 600; }
      </style>
      <div id="veil"></div>
      <div id="marks"></div>
      <div id="hover"></div>
      <div id="bar" role="dialog" aria-label="읽을 곳 가르치기">
        <div id="ask"></div>
        <div class="sub" id="seen"></div>
        <div class="acts" id="acts"></div>
      </div>`;
    const $ = (id) => shadow.getElementById(id);
    const fields = {};
    const values = {};
    let at = 0;
    let hoverEl = null;

    const under = (x, y) => {
      host.style.pointerEvents = 'none';
      const el = document.elementFromPoint(x, y);
      host.style.pointerEvents = '';
      return el && !isOurs(el) ? el : null;
    };
    function box(el, cls, label) {
      const r = el.getBoundingClientRect();
      const d = document.createElement('div');
      d.className = cls;
      Object.assign(d.style, { left: `${r.left - 2}px`, top: `${r.top - 2}px`, width: `${r.width + 4}px`, height: `${r.height + 4}px` });
      if (label) {
        const s = document.createElement('span');
        s.textContent = label;
        d.appendChild(s);
      }
      return d;
    }
    // 시간처럼 생긴 글자 후보들
    function candidates() {
      const out = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let t = walker.nextNode(); t && out.length < 300; t = walker.nextNode()) {
        const el = t.parentElement;
        if (!el || isOurs(el) || !TIME_LIKE.test(t.nodeValue)) continue;
        const r = el.getBoundingClientRect();
        if (r.width && r.height && r.bottom > 0 && r.top < window.innerHeight) out.push(el);
      }
      return out;
    }
    function drawMarks() {
      const picked = Object.entries(fields).map(([key, f]) => {
        let el = null;
        try {
          el = document.querySelector(f.sel);
        } catch {
          el = null;
        }
        return el && box(el, 'picked', STEPS.find((s) => s.key === key).title.split(' (')[0]);
      }).filter(Boolean);
      $('marks').replaceChildren(...candidates().map((el) => box(el, 'cand')), ...picked);
    }
    function button(text, fn) {
      const b = document.createElement('button');
      b.textContent = text;
      b.onclick = fn;
      return b;
    }
    function render() {
      const s = STEPS[at];
      if (!s) {
        // 마지막: 누적 시간에 오늘 진행분이 들어 있는지 묻는다.
        $('ask').innerHTML = '<b>거의 다 됐어요!</b> 한 가지만 알려 주세요.';
        $('seen').textContent = '';
        const check = document.createElement('label');
        check.innerHTML = '<input type="checkbox" id="today"> 출근해서 일하는 동안 누적 근무시간이 실시간으로 늘어나요';
        $('acts').replaceChildren(check, button('저장', finish), button('처음부터', restart), button('그만두기', stop));
        if (!fields.worked) check.hidden = true;
        return;
      }
      const required = (s.need === 'week' && mode !== 'day') || (s.need === 'day' && mode === 'day');
      $('ask').innerHTML = `<b>${at + 1}/${STEPS.length}</b> 화면에서 <b>${s.title}</b>을(를) 눌러 주세요.${required ? '' : ' <span class="sub">(없으면 건너뛰기)</span>'}`;
      $('seen').textContent = '';
      $('acts').replaceChildren(
        ...(required ? [] : [button('건너뛰기', () => next())]),
        ...(at ? [button('← 이전', () => { at -= 1; render(); })] : []),
        button('그만두기', stop),
      );
      drawMarks();
    }
    function next() {
      at += 1;
      render();
    }
    function pick(el) {
      const s = STEPS[at];
      if (!s) return;
      const text = textOf(el);
      const value = parse(s.kind, text);
      // 누적 시간인데 숫자가 없는 칸을 누르면 다시 고르게 한다. 시각은 빈칸(아직 기록 없음)도 받는다.
      if (s.kind === 'duration' && value === null) {
        $('seen').textContent = `"${text.slice(0, 30)}"에서 시간을 못 찾았어요. 시간이 적힌 칸을 눌러 주세요.`;
        return;
      }
      fields[s.key] = { sel: selectorOf(el), ...anchorOf(el) };
      values[s.key] = value;
      next();
    }
    function finish() {
      const today = shadow.getElementById('today');
      cleanup();
      done({ fields, includesToday: Boolean(today && today.checked), values });
    }
    function restart() {
      for (const k of Object.keys(fields)) delete fields[k];
      at = 0;
      render();
    }
    function stop() {
      cleanup();
      if (cancel) cancel();
    }
    const veil = $('veil');
    veil.addEventListener('mousemove', (e) => {
      hoverEl = under(e.clientX, e.clientY);
      const h = $('hover');
      if (!hoverEl) {
        h.style.display = 'none';
        return;
      }
      const r = hoverEl.getBoundingClientRect();
      Object.assign(h.style, { display: 'block', left: `${r.left - 2}px`, top: `${r.top - 2}px`, width: `${r.width + 4}px`, height: `${r.height + 4}px` });
    });
    veil.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const el = under(e.clientX, e.clientY);
      if (el) pick(el);
    });
    // 막 위에서 굴리면 페이지가 스크롤되고, 테두리를 다시 그린다.
    const redraw = () => drawMarks();
    window.addEventListener('scroll', redraw, true);
    window.addEventListener('resize', redraw);
    const onKey = (e) => {
      if (e.key === 'Escape') stop();
    };
    window.addEventListener('keydown', onKey, true);
    function cleanup() {
      window.removeEventListener('scroll', redraw, true);
      window.removeEventListener('resize', redraw);
      window.removeEventListener('keydown', onKey, true);
      host.remove();
    }
    render();
    return { stop };
  }

  root.HW40_READER = { STEPS, readPage, teach, selectorOf, labelOf, anchorOf };
})(typeof globalThis !== 'undefined' ? globalThis : this);

// ---- content.js ----
// 하이웍스 화면 글자를 읽어 우측 하단 패널에 퇴근 시각을 표시한다.
// 페이지를 읽기만 하며, 어떤 데이터도 외부로 보내지 않는다.
(function () {
  const { parsePage, evaluate, secToTime, formatDuration, RULES, setRules } = globalThis.HW40;
  const READ_EVERY_MS = 5000;

  // body 바깥에 붙여서 패널 글자가 body.innerText 파싱에 섞이지 않게 한다.
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;';
  host.dataset.hw40 = 'panel';
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host { --paper: #fffdf6; --ink: #3b3226; --soft: #7a6d58; --rule: #e8dfcc; --pen: #3e5c9a; }
      * { box-sizing: border-box; }
      .wrap { display: flex; align-items: flex-end; gap: 12px; font: 13px/1.5 'Malgun Gothic', sans-serif; color: var(--ink); }
      /* 오른쪽(아이콘 옆)부터 근무 → 모이기 → 테마 → 설정 순으로 놓고, 자리가 모자라면 위로 쌓는다 */
      .cards { display: flex; flex-direction: row-reverse; flex-wrap: wrap-reverse; align-items: flex-start; gap: 14px; max-width: calc(100vw - 110px); }
      #panel, #pill { order: 0; } #visitMenu { order: 1; } #themeMenu { order: 2; } #setMenu { order: 3; }
      /* 그림판에서 뜯어 붙인 종이 한 장 */
      .card { position: relative; width: 290px; padding: 16px 16px 12px; color: var(--ink);
        background: radial-gradient(var(--rule) 1px, transparent 1.2px) 0 0 / 14px 14px, var(--paper);
        border: 2px solid var(--ink); border-radius: 14px 5px 12px 6px / 6px 12px 5px 14px;
        box-shadow: 3px 4px 0 rgba(59,50,38,.14), 0 8px 20px rgba(0,0,0,.08);
        transform-origin: bottom right; animation: unfold .22s ease-out; }
      .card.work { width: 260px; }
      /* 종이를 붙인 마스킹 테이프. 근무 종이는 지금 상태 색 */
      .card::before { content: ''; position: absolute; top: -10px; left: 50%; width: 76px; height: 18px;
        transform: translateX(-50%) rotate(-3deg); background: rgba(247,214,140,.75);
        box-shadow: 0 1px 2px rgba(0,0,0,.08); }
      .card.work::before { background: color-mix(in srgb, var(--accent, #8fa3c9) 70%, transparent); }
      #themeMenu::before { transform: translateX(-50%) rotate(2deg); background: rgba(240,170,190,.7); }
      #visitMenu::before { transform: translateX(-50%) rotate(-1deg); background: rgba(160,205,170,.75); }
      #setMenu::before { transform: translateX(-50%) rotate(3deg); background: rgba(170,190,230,.75); }
      @keyframes unfold { from { opacity: 0; transform: translateY(10px) scale(.94) rotate(1deg); } }
      .chead { display: flex; justify-content: space-between; align-items: center; gap: 6px;
        padding-bottom: 4px; margin-bottom: 8px; border-bottom: 2px dashed var(--rule); font-weight: 700; font-size: 13px; }
      .chead .sub { display: block; font-weight: 400; font-size: 11px; color: var(--soft); }
      .chead .x { font-size: 16px; line-height: 1; color: var(--soft); padding: 0 4px; border-radius: 4px; }
      .chead .x:hover { background: var(--rule); color: var(--ink); }
      .cbody { max-height: 62vh; overflow-y: auto; margin-right: -6px; padding-right: 6px; }
      button { border: 0; background: none; cursor: pointer; color: var(--soft); font-size: 14px; padding: 0 2px; font-family: inherit; }
      /* 오른쪽 아래 아이콘: 종이 조각 단추 */
      .dock { display: flex; flex-direction: column; gap: 8px; }
      .dock button { position: relative; width: 48px; height: 48px; display: grid; place-items: center; align-content: center; gap: 0;
        background: var(--paper); color: var(--ink); border: 2px solid var(--ink);
        border-radius: 50% 46% 52% 44% / 46% 52% 44% 50%; box-shadow: 2px 3px 0 rgba(59,50,38,.16); transition: transform .12s; }
      .dock button:hover { transform: translateY(-2px) rotate(-3deg); }
      .dock button svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
      .dock button span { font-size: 9px; line-height: 1; margin-top: 1px; color: var(--soft); }
      /* 펼친 종이의 단추는 형광펜으로 칠한 것처럼 */
      .dock button.on { background: radial-gradient(circle at 50% 55%, #ffe58a 0 58%, var(--paper) 60%); }
      .dock button.off svg { opacity: .35; }
      .dock button.off::after { content: ''; position: absolute; left: 9px; right: 9px; top: 50%; height: 2px; background: var(--ink); transform: rotate(-35deg); border-radius: 2px; }
      /* 모음 단추 = 스노우볼. 접으면 단추들이 빙글 돌며 작아져서 구슬 속으로 빨려 들어가고, 소용돌이치며 돌다가
         점점 느려지면서 10초 안팎에 걸쳐 제각각 바닥으로 가라앉는다 (shakeGlobe).
         내려앉은 뒤에도 바닥 근처를 아이콘마다 다른 길로 천천히 떠돈다 (settle). 마우스를 올리면 다시 흔든다.
         펼치면 지금 있던 자리에서 위로 촤악 펼쳐진다. 구슬 속 움직임은 모두 스크립트(Web Animations)가 맡는다.
         --i: 모음 단추에서 몇 칸 위인지 / --s: 구슬 속 크기 / --rx·--ry·--ra: 바닥 자리 (움직임 줄이기일 때는 여기 가만히 있다)
         자리 이동은 translate/scale/rotate로, 구슬 속 움직임은 transform으로 한다 (transform은 펼쳐 있을 때 흔들림에 쓴다). */
      .fan { display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
      .fan button { pointer-events: auto; --d: calc(var(--i) * 45ms);
        transition: transform .12s, translate .5s cubic-bezier(.3,1.55,.55,1) var(--d), scale .5s cubic-bezier(.3,1.55,.55,1) var(--d),
          rotate .5s cubic-bezier(.3,1.3,.55,1) var(--d); }
      .fan button span { transition: opacity .2s var(--d); }
      .dock.shut .fan button { translate: 0 calc(var(--i) * 56px); scale: var(--s, .28); rotate: -360deg; z-index: 3; pointer-events: none;
        box-shadow: 0 0 0 rgba(0,0,0,0); transform: translate(var(--rx, 0px), var(--ry, 0px)) rotate(var(--ra, 0deg));
        --d: calc((var(--i) - 1) * 45ms);
        transition: transform .12s, translate .6s cubic-bezier(.55,-.15,.6,1) var(--d), scale .6s cubic-bezier(.55,0,.6,1) var(--d),
          rotate .6s cubic-bezier(.4,0,.6,1) var(--d), box-shadow .3s; }
      .dock.shut .fan button span { opacity: 0; transition-delay: 0s; }
      /* 눈송이: 흔들 때만 보이는 작은 점들 (구슬 밖으로 나가지 않게 구슬 안에만 그린다) */
      .bundle { overflow: hidden; }
      .flakes { position: absolute; inset: 0; pointer-events: none; z-index: 2; }
      .flakes i { position: absolute; left: 50%; top: 50%; width: 2.6px; height: 2.6px; margin: -1.3px; border-radius: 50%; background: var(--soft); opacity: 0; }
      .dock.still .fan button, .dock.still .fan button span, .dock.still .bundle::before, .dock.still .bundle::after { transition: none; }
      /* 구슬: 실제로 물을 그리지 않고, 안쪽의 옅은 그늘과 왼쪽 위 반짝임 선만으로 "둥근 공간"처럼 보이게 한다. */
      .bundle { isolation: isolate; }
      .bundle::before { content: ''; position: absolute; z-index: -1; inset: 0; border-radius: inherit; opacity: 0;
        background: radial-gradient(circle at 38% 32%, rgba(255,255,255,0) 45%, rgba(59,50,38,.09) 100%); transition: opacity .5s .1s; }
      .bundle::after { content: ''; position: absolute; z-index: 4; top: 6px; left: 8px; width: 13px; height: 9px; opacity: 0;
        border-top: 1.6px solid rgba(59,50,38,.38); border-radius: 50%; rotate: -32deg; transition: opacity .5s .15s; pointer-events: none; }
      .dock.shut .bundle::before, .dock.shut .bundle::after { opacity: 1; }
      .bundle svg, .bundle span { transition: opacity .25s, rotate .35s cubic-bezier(.3,1.5,.55,1); }
      .dock.shut .bundle svg, .dock.shut .bundle span { opacity: 0; }
      .bundle.open { background: radial-gradient(circle at 50% 55%, #e6f0c8 0 58%, var(--paper) 60%); }
      .bundle.open svg { rotate: -12deg; }
      @media (prefers-reduced-motion: reduce) {
        .fan button, .dock.shut .fan button, .bundle::before, .bundle::after { transition: none; animation: none; }
        .flakes { display: none; }
      }
      .pill { padding: 6px 14px; background: var(--paper); color: var(--ink); border: 2px solid var(--ink);
        border-radius: 12px 4px 12px 4px / 4px 12px 4px 12px; box-shadow: 2px 3px 0 rgba(59,50,38,.16);
        font: 700 13px 'Malgun Gothic', sans-serif; font-variant-numeric: tabular-nums; animation: unfold .2s ease-out; }
      .main { font-size: 28px; font-weight: 800; margin: 2px 0; font-variant-numeric: tabular-nums; letter-spacing: -.5px; }
      .note { font-weight: 600; margin-bottom: 8px; }
      .hint { color: #889; font-size: 11px; margin-top: 4px; }
      .foot { display: flex; justify-content: flex-end; margin-top: 6px; color: #b5a98f; font-size: 10px; }
      .updated { margin: 6px 0 0; padding: 5px 8px; border-radius: 6px; background: #eef6e6; color: #3d6b1f; font-size: 12px; font-weight: 600; }
      .row { display: flex; justify-content: space-between; color: var(--soft); border-bottom: 1px dotted var(--rule); padding: 1px 0; font-variant-numeric: tabular-nums; }
      .pill { padding: 6px 12px; background: #fff; border: 1px solid #d5dbe5; border-radius: 16px;
        box-shadow: 0 2px 8px rgba(0,0,0,.15); color: #222; font: 600 13px 'Malgun Gothic', sans-serif; }
      .menu-title { font-size: 12px; color: var(--soft); margin-bottom: 4px; }
      .theme { display: flex; align-items: center; gap: 4px; }
      .theme .pick { flex: 1; text-align: left; font-size: 13px; color: #222; padding: 3px 4px; border-radius: 4px; }
      .theme .pick:hover { background: #e8ecf3; }
      .theme .pick[aria-checked="true"] { font-weight: 700; color: var(--pen); }
      .theme .pick[aria-checked="true"]::before { content: '● '; }
      .theme .pick[aria-checked="false"]::before { content: '○ '; color: #99a; }
      .tag { font-size: 10px; color: #778; border: 1px solid #ccd3df; border-radius: 8px; padding: 0 5px; margin-left: 4px; }
      .menu-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; font-size: 12px; }
      /* 누를 수 있는 것은 모두 종이 단추 모양 (글자 링크처럼 보이지 않게) */
      .menu-actions button, .menu-actions a, .vcode button, .vbtn { font: 600 12px/18px 'Malgun Gothic', sans-serif; color: var(--ink); background: #fff;
        border: 1.5px solid var(--ink); border-radius: 999px; padding: 2px 11px; text-decoration: none; cursor: pointer; white-space: nowrap;
        box-shadow: 1px 2px 0 rgba(59,50,38,.16); transition: background .12s, transform .08s, box-shadow .08s; }
      .menu-actions button:hover, .menu-actions a:hover, .vcode button:hover, .vbtn:hover { background: #ffe58a; }
      .menu-actions button:active, .menu-actions a:active, .vcode button:active, .vbtn:active { transform: translateY(1px); box-shadow: 0 1px 0 rgba(59,50,38,.16); }
      .menu-actions .main { background: #ffe58a; }
      .menu-actions .main:hover { background: #ffd447; }
      .menu-actions [hidden] { display: none; }
      .msg { font-size: 12px; color: #556; margin-top: 4px; }
      textarea { width: 100%; box-sizing: border-box; height: 56px; font: 11px Consolas, monospace; margin-top: 4px; }
      input[type="text"] { width: 100%; box-sizing: border-box; font: 13px 'Malgun Gothic', sans-serif; padding: 3px 6px; border: 1px solid #ccd3df; border-radius: 4px; }
      .vpeople { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
      .vchip { padding: 0 7px; border-radius: 9px; background: #fff; border: 1px solid #d5dbe5; font: 600 12px 'Malgun Gothic', sans-serif; color: var(--pen); }
      button.vchip:hover { background: #eef2fa; }
      .vchip.cast { color: #4a3520; font-weight: 400; display: inline-flex; align-items: center; gap: 2px; }
      .vchip.cast button { font-size: 10px; padding: 0 0 0 2px; color: #99a; }
      .vchip.cast button:hover { color: #c0392b; }
      [hidden] { display: none !important; }
      .form { display: grid; grid-template-columns: 84px minmax(0, 1fr); gap: 5px 8px; align-items: center; font-size: 12px; color: #556; margin-top: 4px; word-break: keep-all; line-height: 1.3; }
      .form input, .form select { font: 12px 'Malgun Gothic', sans-serif; min-width: 0; box-sizing: border-box; }
      .form select, .form input[type="time"], .form input[type="text"] { width: 100%; }
      .form .pair input[type="time"] { width: auto; flex: 1; }
      .form input[type="number"] { width: 70px; }
      .form .pair { display: flex; align-items: center; gap: 4px; }
      .readbox { margin-top: 8px; padding-top: 6px; border-top: 1px dashed #d5dbe5; font-size: 12px; color: #556; }
      .vdeco { margin-top: 8px; padding-top: 6px; border-top: 1px dashed #d5dbe5; }
      .vavatar { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #556; margin-top: 6px; flex-wrap: wrap; white-space: nowrap; }
      .vavatar select { flex: 1; min-width: 120px; font: 12px 'Malgun Gothic', sans-serif; }
      .vstep { font-size: 12px; color: #334; margin-top: 6px; font-weight: 600; }
      /* 코드 주고받기 팝업 */
      .modal { position: fixed; inset: 0; display: grid; place-items: center; padding: 16px; background: rgba(59,50,38,.28); }
      .modal[hidden] { display: none !important; }
      .sheet { width: min(420px, 100%); max-height: calc(100vh - 32px); overflow-y: auto; }
      .sheet::before { background: rgba(160,205,170,.8); }
      .msteps { display: flex; flex-direction: column; gap: 14px; }
      .msteps.join #vInBox { order: -1; }
      .mstep { padding: 10px 12px; border: 1.5px dashed var(--rule); border-radius: 10px; background: rgba(255,255,255,.6); }
      .mstep .vstep { margin: 0 0 6px; font-size: 13px; color: var(--ink); }
      .mstep .codebox { display: block; width: 100%; box-sizing: border-box; margin: 0 0 8px; padding: 8px; text-align: center;
        font: 700 24px/1.2 Consolas, 'Courier New', monospace; letter-spacing: 3px; text-transform: uppercase;
        border: 1.5px dashed var(--rule); border-radius: 8px; background: #fff; color: var(--ink); }
      .vcode { display: flex; align-items: center; gap: 6px; margin-top: 6px; font-size: 12px; color: #556; }
      .vcode[hidden] { display: none; }
      .vcode b { font: 700 14px Consolas, monospace; letter-spacing: 1px; color: var(--ink); }
      .vcode button { margin-left: auto; }
      .mstep.done { opacity: .55; }
      .big { display: block; width: 100%; padding: 8px 0; border: 2px solid var(--ink); border-radius: 10px 4px 10px 4px / 4px 10px 4px 10px;
        background: #ffe58a; color: var(--ink); font: 700 13px 'Malgun Gothic', sans-serif; box-shadow: 2px 3px 0 rgba(59,50,38,.16); }
      .big:hover { transform: translateY(-1px); }
      .sheet .msg { margin-top: 10px; font-size: 13px; color: var(--ink); font-weight: 600; }
    </style>
    <div class="wrap">
      <div class="cards">
      <section class="card" id="setMenu" hidden aria-label="set">
        <div class="chead"><span>회사 설정 · <span id="setSite"></span><span class="sub">근무 규칙과 화면에서 읽을 곳</span></span><button class="x" data-close="set" title="접어서 아이콘으로">–</button></div>
        <div class="cbody">
        <div class="form">
          <span>이름</span><input type="text" id="sName" maxlength="30" placeholder="우리 회사" aria-label="회사 이름">
          <span>프리셋</span><select id="sPreset" aria-label="프리셋"></select>
          <span>근무 방식</span>
          <select id="sMode" aria-label="근무 방식">
            <option value="week">주 단위 선택근무 (금요일 조기 퇴근)</option>
            <option value="month">월 단위 선택근무</option>
            <option value="day">하루 단위 (시차출퇴근)</option>
          </select>
          <span id="sHoursLabel">주 목표 시간</span><span class="pair"><input type="number" id="sHours" min="1" step="0.5" aria-label="목표 시간">시간</span>
          <label id="sAutoRow" style="grid-column:1/-1"><input type="checkbox" id="sAuto"> 이번 달 평일 수 × 하루 시간으로 자동</label>
          <span>근무 인정 시작</span><input type="time" id="sStart" aria-label="근무 인정 시작">
          <label style="grid-column:1/-1"><input type="checkbox" id="sLunchOn"> 점심시간 빼기</label><span class="pair" style="grid-column:1/-1"><input type="time" id="sLunchA" aria-label="점심 시작">~<input type="time" id="sLunchB" aria-label="점심 끝"></span>
          <span id="sEarliestLabel">금요일 가장 빠른 퇴근</span><input type="time" id="sEarliest" aria-label="가장 빠른 퇴근">
          <span id="sDailyRow" style="display:contents"><span id="sDailyLabel">월~목 예상 하루</span><span class="pair"><input type="number" id="sDaily" min="1" max="16" step="0.5" aria-label="예상 하루 근무">시간</span></span>
        </div>
        <div class="menu-actions"><button id="sSave" class="main">저장</button><button id="sReset" hidden>기본 규칙으로</button></div>
        <div class="readbox" id="readBox" hidden>
          <div>읽을 곳: <span id="readState"></span></div>
          <div class="menu-actions"><button id="sTeach">읽을 곳 가르치기</button></div>
        </div>
        <div class="menu-actions"><button id="sCopy">설정 코드 복사</button><button id="sPasteBtn">설정 코드 넣기</button></div>
        <div id="sPaste" hidden>
          <textarea id="sCode" placeholder="받은 회사 설정 코드(HW40S1…)를 붙여 넣으세요" aria-label="회사 설정 코드"></textarea>
          <div class="menu-actions"><button id="sCodeOk" class="main">넣기</button></div>
        </div>
        <div class="msg" id="setMsg" hidden></div>
        </div>
      </section>
      <section class="card" id="themeMenu" hidden aria-label="theme">
        <div class="chead"><span>캐릭터 테마<span class="sub">어떤 그림 친구들이 종이 밖으로 나올지 골라요</span></span><button class="x" data-close="theme" title="접어서 아이콘으로">–</button></div>
        <div class="cbody">
        <div id="themeList" role="radiogroup" aria-label="캐릭터 테마"></div>
        <div class="menu-actions">
          <button id="themeAdd">＋ 테마 코드 넣기</button><button id="themeFile">파일에서 넣기</button><button id="themeCopy">코드 복사</button>
        </div>
        <div class="menu-actions">
          <a id="themeMake" class="main" target="_blank" rel="noopener" hidden>🎨 테마 만들기</a><a id="charMake" class="main" target="_blank" rel="noopener" hidden>🧸 캐릭터 만들기</a>
        </div>
        <div id="themePaste" hidden>
          <textarea id="themeCode" placeholder="받은 테마 코드(HW40T…)를 붙여 넣으세요"></textarea>
          <div class="menu-actions"><button id="themeOk" class="main">넣기</button><button id="themeCancel">취소</button></div>
        </div>
        <div class="msg" id="themeMsg" hidden></div>
        </div>
      </section>
      <section class="card" id="visitMenu" hidden aria-label="visit">
        <div class="chead"><span>모이기 <span id="vCount"></span><span class="sub">동료들과 캐릭터로 대화해요</span></span><button class="x" data-close="visit" title="접어서 아이콘으로">–</button></div>
        <div class="cbody">
        <div id="vStart">
          <input type="text" id="vNick" maxlength="12" placeholder="내 이름 (모두에게 보여요)" aria-label="내 이름">
          <div class="menu-actions"><button id="vOpen" class="main">방 만들기</button><button id="vJoin">방 코드로 들어가기</button></div>
        </div>
        <div id="vRoom" hidden>
          <div class="vpeople" id="vPeople" aria-label="방에 있는 사람"></div>
          <div class="vcode" id="vCodeRow" hidden>방 코드 <b id="vCodeText"></b><button id="vInvite">보기·복사</button></div>
          <div class="vdeco" id="vDeco" hidden>
            <div class="vstep" id="vCastLabel"></div>
            <div class="vpeople" id="vCast" aria-label="방 캐릭터"></div>
            <label class="vavatar" id="vBringRow">내 캐릭터 데려오기 <select id="vBring" aria-label="데려올 내 캐릭터"></select><button id="vBringOk" class="vbtn">데려오기</button></label>
          </div>
        </div>
        <label class="vavatar">내 아바타 <select id="vAvatar" aria-label="내 아바타"></select></label>
        <div class="vstep" id="vAvatarHint">방에 들어가면 내 아바타 머리 위에 이름이 붙어요. 아바타를 눌러 <b>갈아입기</b>로도 바꿀 수 있어요.</div>
        <div class="msg" id="vMsg" hidden></div>
        <div class="menu-actions"><button id="vEnd" hidden></button></div>
        </div>
      </section>
            <section class="card work" id="panel" aria-label="이번 주 근무 현황">
        <div class="chead"><span id="title"></span><button class="x" id="min" title="접어서 아이콘으로">–</button></div>
<div class="main" id="main"></div>
      <div class="note" id="note"></div>
      <div id="rows"></div>
      <div class="hint" id="hint" hidden></div>
      <div class="updated" id="updated" hidden></div>
      <div class="foot"><span id="version"></span></div>
      </section>
      <button class="pill" id="pill" hidden title="근무 현황 펼치기"></button>
      </div>
      <nav class="dock" aria-label="두들링">
        <div class="fan" id="fan">
        <button id="pet" style="--i:5" title="캐릭터 켜기/끄기" aria-label="캐릭터 켜기/끄기"><svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="15.5" rx="4.2" ry="3.6"/><circle cx="6.3" cy="10" r="1.8"/><circle cx="9.6" cy="6.3" r="1.8"/><circle cx="14.4" cy="6.3" r="1.8"/><circle cx="17.7" cy="10" r="1.8"/></svg><span>친구</span></button>
        <button id="settings" style="--i:4" title="회사 설정 (근무 규칙·읽을 곳)" aria-label="회사 설정 (근무 규칙·읽을 곳)"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg><span>설정</span></button>
        <button id="theme" style="--i:3" title="캐릭터 테마" aria-label="캐릭터 테마"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.3 0 2-.8 2-1.8 0-1.4-1.3-1.8-1.3-3 0-1 .8-1.7 1.9-1.7H17a4 4 0 0 0 4-4C21 6.4 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.1"/><circle cx="10" cy="7" r="1.1"/><circle cx="15" cy="7.5" r="1.1"/></svg><span>테마</span></button>
        <button id="visit" style="--i:2" title="모이기 (동료들과 캐릭터로 대화)" aria-label="모이기 (동료들과 캐릭터로 대화)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5C4 5 5 4 6.5 4h11C19 4 20 5 20 6.5v7c0 1.5-1 2.5-2.5 2.5H11l-4 4v-4H6.5C5 16 4 15 4 13.5z"/><path d="M8.5 10h.01M12 10h.01M15.5 10h.01"/></svg><span>모이기</span></button>
        <button id="work" style="--i:1" title="이번 주 근무 현황" aria-label="이번 주 근무 현황"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9.5 2.5h5"/></svg><span>근무</span></button>
        </div>
        <button id="bundle" class="bundle" aria-controls="fan" aria-expanded="false" title="두들링 단추 펼치기"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M8 2.5v3M12 2.5v3M16 2.5v3M8.5 11.5c1.5-2 3-2 3.5 0s2.5 2 4-.5M8.5 16h7"/></svg><span id="bundleLabel">모음</span><b class="flakes" id="flakes" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></b></button>
      </nav>
    </div>
    <div class="modal" id="codeModal" hidden>
      <section class="card sheet" role="dialog" aria-modal="true" aria-labelledby="mTitle">
        <div class="chead"><span><span id="mTitle"></span><span class="sub" id="mSub"></span></span><button class="x" id="mClose" title="닫기">✕</button></div>
        <div class="msteps" id="mSteps">
          <div class="mstep" id="vOutBox" hidden>
            <div class="vstep" id="vOutLabel"></div>
            <input type="text" id="vOut" class="codebox" readonly aria-label="방 코드">
            <button class="big" id="vCopy">코드 복사</button>
          </div>
          <div class="mstep" id="vInBox" hidden>
            <div class="vstep" id="vInLabel"></div>
            <input type="text" id="vIn" class="codebox" maxlength="20" autocomplete="off" spellcheck="false" aria-label="방 코드" placeholder="K7Q2-M9XA">
            <button class="big" id="vInOk"></button>
          </div>
        </div>
        <div class="msg" id="mMsg" hidden></div>
      </section>
    </div>`;

  const $ = (id) => shadow.getElementById(id);

  // 지금 쓰는 버전. 새 버전을 받은 뒤 처음 열면 잠깐 알려준다.
  const VERSION = globalThis.HW40_VERSION || '';
  const SEEN_KEY = 'hw40-seen-version';
  if (VERSION) {
    $('version').textContent = `v${VERSION}`;
    $('version').title = '40시간 퇴근 계산기 버전';
    let seen = null;
    try {
      seen = localStorage.getItem(SEEN_KEY);
      localStorage.setItem(SEEN_KEY, VERSION);
    } catch {
      // 저장소를 못 쓰면 알림 없이 버전만 보여준다.
    }
    if (seen && seen !== VERSION) {
      $('updated').textContent = `새 버전 v${VERSION}로 업데이트됐어요`;
      $('updated').hidden = false;
      setTimeout(() => {
        $('updated').hidden = true;
      }, 15000);
    }
  }
  // 종이 네 장(근무·모이기·테마·설정)은 따로 펼치고 접는다. 접으면 오른쪽 아래 아이콘만 남는다.
  // 펼친 종이는 기억해 두었다가 다음에 그대로 연다.
  const CARDS = { work: ['panel', 'work'], visit: ['visitMenu', 'visit'], theme: ['themeMenu', 'theme'], set: ['setMenu', 'settings'] };
  const OPEN_KEY = 'hw40-open';
  const readOpen = () => {
    try {
      const v = JSON.parse(localStorage.getItem(OPEN_KEY));
      return Array.isArray(v) ? v.filter((k) => CARDS[k]) : ['work'];
    } catch {
      return ['work'];
    }
  };
  const isOpen = (name) => !$(CARDS[name][0]).hidden;
  function showCard(name, open) {
    const [card, icon] = CARDS[name];
    $(card).hidden = !open;
    $(icon).classList.toggle('on', open);
    $(icon).setAttribute('aria-pressed', String(open));
    if (name === 'work') $('pill').hidden = open;
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(Object.keys(CARDS).filter(isOpen)));
    } catch {
      // 기억하지 못해도 지금 화면은 그대로 쓴다.
    }
  }
  // 펼칠 때 할 일 (목록 새로 그리기 등)은 각 부분에서 등록한다.
  const onOpen = {};
  const toggleCard = (name) => {
    const open = !isOpen(name);
    showCard(name, open);
    if (open && onOpen[name]) onOpen[name]();
  };
  for (const [name, [, icon]] of Object.entries(CARDS)) $(icon).onclick = () => toggleCard(name);
  for (const b of shadow.querySelectorAll('[data-close]')) b.onclick = () => showCard(b.dataset.close, false);
  $('min').onclick = () => showCard('work', false);
  $('pill').onclick = () => showCard('work', true);
  const savedOpen = readOpen(); // showCard가 저장을 덮어쓰기 전에 읽어 둔다
  showCard('work', savedOpen.includes('work'));

  // 모음 단추: 단추 다섯 개를 펼치고 접는다. 접혀 있는지는 기억해 둔다 (처음에는 펼쳐 둔다).
  const DOCK_KEY = 'hw40-dock';
  const dock = shadow.querySelector('.dock');
  const bundle = $('bundle');
  // 스노우볼 속 자리: 단추 수에 맞춰 크기를 정하고, 아이콘마다 바닥에 내려앉을 자리와 흔들리는 폭·빠르기를 무작위로 정한다.
  // 위치는 구슬 가운데 기준 실제 픽셀로 계산하고, CSS에는 작아진 아이콘 안의 단위(px / s)로 넘긴다.
  const fanButtons = () => [...$('fan').children].filter((b) => !b.hidden);
  const rand = (a, b) => a + Math.random() * (b - a);
  let globe = { s: 0.22, reach: 14 };
  function layoutFan() {
    const btns = fanButtons();
    const n = btns.length;
    const s = n <= 3 ? 0.3 : n <= 6 ? 0.22 : 0.18;
    const reach = 22 - (48 * s) / 2 - 2; // 아이콘이 구슬(안쪽 반지름 22px) 밖으로 나가지 않는 거리
    globe = { s, reach };
    const local = (px) => `${(px / s).toFixed(1)}px`;
    // 바닥 쪽에 불규칙하게 쌓인다: 가로로 고르게 나눈 칸을 섞어 하나씩 주고, 칸 안에서도 위치·높이를 흔든다.
    const slots = btns.map((_, k) => k).sort(() => Math.random() - 0.5);
    btns.forEach((b, k) => {
      const x = reach * 0.8 * (((slots[k] + rand(0.15, 0.85)) / n) * 2 - 1);
      const y = Math.sqrt(Math.max(reach * reach - x * x, 0)) * rand(0.45, 0.95);
      b.restAt = { x, y, a: rand(-25, 25) };
      b.style.setProperty('--i', String(n - k));
      b.style.setProperty('--s', String(s));
      b.style.setProperty('--rx', local(b.restAt.x));
      b.style.setProperty('--ry', local(b.restAt.y));
      b.style.setProperty('--ra', `${b.restAt.a.toFixed(0)}deg`);
    });
  }
  layoutFan();
  const calm = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 구슬 밖으로 나가지 않게 가운데에서 r 안으로 당긴다.
  const inside = (x, y, r) => {
    const d = Math.hypot(x, y);
    return d > r ? [(x / d) * r, (y / d) * r] : [x, y];
  };
  const at = (x, y, a) => `translate(${(x / globe.s).toFixed(1)}px, ${(y / globe.s).toFixed(1)}px) rotate(${a.toFixed(0)}deg)`;
  const stopMotion = (b) => {
    if (b.fall) b.fall.cancel();
    if (b.idle) b.idle.cancel();
    b.fall = null;
    b.idle = null;
  };
  // 바닥에 내려앉은 뒤: 바닥 근처를 아이콘마다 다른 길·빠르기(7~12초에 한 바퀴)로 천천히 떠돈다.
  // 시작과 끝이 바닥 자리라서 가라앉은 뒤 바로 이어진다. randomStart: 처음 그릴 때 아이콘마다 다른 시점에서 시작
  function settle(b, randomStart) {
    if (!b.animate || calm()) return;
    const { reach } = globe;
    const rest = b.restAt;
    const frames = [{ transform: at(rest.x, rest.y, rest.a) }];
    for (let p = 0; p < 3; p += 1) {
      const [x, y] = inside(rest.x + rand(-5.5, 5.5), rest.y + rand(-4.5, 1.5), reach);
      frames.push({ transform: at(x, y, rest.a + rand(-22, 22)) });
    }
    frames.push({ transform: at(rest.x, rest.y, rest.a) });
    const duration = rand(7000, 12000);
    b.idle = b.animate(frames, { duration, iterations: Infinity, easing: 'ease-in-out' });
    if (randomStart) b.idle.currentTime = rand(0, duration);
  }
  // 스노우볼 흔들기: 아이콘이 구슬 속에서 소용돌이치며 돌다가, 도는 게 점점 느려지고 작아지면서
  // 제각각 바닥으로 천천히 가라앉는다 (8.5~13초). 끝나면 바닥에서 떠돌기로 이어진다. 눈송이도 같이 오래 휘날린다.
  // wait(아이콘) → 시작 전 기다릴 시간(ms). fromNow: 지금 있던 자리에서 바로 휘말려 올라간다 (마우스를 올렸을 때).
  function shakeGlobe(wait, fromNow) {
    if (!bundle.animate || calm()) return;
    const { reach } = globe;
    const ease = (t) => t * t * (3 - 2 * t);
    for (const b of fanButtons()) {
      const now = fromNow ? getComputedStyle(b).transform : null;
      stopMotion(b);
      const rest = b.restAt;
      const [sx, sy] = inside(rand(-reach, reach) * 0.7, -reach * rand(0.2, 0.9), reach);
      const dir = Math.random() < 0.5 ? -1 : 1; // 도는 방향도 제각각
      const turns = rand(1.6, 2.8);
      const swirl = reach * rand(0.4, 0.75);
      const phase = rand(0, Math.PI * 2);
      const frames = [];
      const STEPS = 48;
      for (let j = 0; j <= STEPS; j += 1) {
        const t = j / STEPS;
        const c = ease(Math.min(1, t * 1.08)); // 가운데 자리는 위쪽에서 바닥 자리로 천천히 내려간다
        const amp = (1 - t) ** 1.5; // 도는 폭은 점점 줄어든다
        const th = phase + dir * turns * Math.PI * 2 * (1 - (1 - t) * (1 - t)); // 처음엔 빨리, 갈수록 느리게 돈다
        const [x, y] = inside(sx + (rest.x - sx) * c + Math.cos(th) * swirl * amp, sy + (rest.y - sy) * c + Math.sin(th) * swirl * 0.75 * amp, reach);
        frames.push({ transform: at(x, y, rest.a * c + Math.sin(th) * 35 * amp) });
      }
      if (now && now !== 'none') {
        frames[0].offset = 0.05;
        frames.unshift({ transform: now, offset: 0 });
      }
      const fall = b.animate(frames, { duration: rand(8500, 13000), delay: wait(b), easing: 'linear', fill: 'backwards' });
      fall.onfinish = () => {
        if (b.fall === fall && dock.classList.contains('shut')) settle(b, false);
      };
      b.fall = fall;
    }
    // 눈송이 점들: 소용돌이를 따라 돌다가 바닥으로 내려앉으며 사라진다.
    for (const f of $('flakes').children) {
      const [fx, fy] = inside(rand(-17, 17), rand(-19, -2), 19);
      const ex = rand(-14, 14);
      const ey = rand(9, 17);
      const dir = Math.random() < 0.5 ? -1 : 1;
      const phase = rand(0, Math.PI * 2);
      const frames = [];
      const STEPS = 16;
      for (let j = 0; j <= STEPS; j += 1) {
        const t = j / STEPS;
        const c = ease(t);
        const amp = (1 - t) ** 1.3;
        const th = phase + dir * Math.PI * 4 * (1 - (1 - t) * (1 - t));
        const [x, y] = inside(fx + (ex - fx) * c + Math.cos(th) * 9 * amp, fy + (ey - fy) * c + Math.sin(th) * 7 * amp, 19);
        frames.push({ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`, opacity: t < 0.08 ? t * 9 : t > 0.82 ? (1 - t) * 4 : 0.72 });
      }
      f.animate(frames, { duration: rand(6000, 10000), delay: (fromNow ? 0 : 520) + rand(0, 600), easing: 'linear', fill: 'backwards' });
    }
  }
  // 접힌 스노우볼에 마우스를 올리면 흔든다 (너무 자주 흔들리지 않게 잠깐 쉰다).
  let lastShake = 0;
  bundle.addEventListener('pointerenter', () => {
    if (!dock.classList.contains('shut') || Date.now() - lastShake < 2200 || calm()) return;
    lastShake = Date.now();
    if (bundle.animate) bundle.animate([{ rotate: '0deg' }, { rotate: '-9deg' }, { rotate: '7deg' }, { rotate: '-4deg' }, { rotate: '0deg' }], { duration: 480, easing: 'ease-in-out' });
    shakeGlobe(() => 60, true);
  });
  function setDock(open, animate) {
    // 펼칠 때는 스노우볼 속에서 지금 있던 자리에서 출발한다 (가운데로 튀지 않게).
    const from = open && animate && dock.classList.contains('shut') ? fanButtons().map((b) => [b, getComputedStyle(b).transform]) : [];
    dock.classList.toggle('shut', !open);
    for (const [b, t] of from) {
      stopMotion(b);
      if (t && t !== 'none' && b.animate) b.animate([{ transform: t }, { transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.3,1.3,.55,1)' });
    }
    // 접을 때는 빨려 들어간 뒤 스노우볼을 흔든 것처럼 휘날렸다 가라앉는다 (빨려 들어가는 동안은 위쪽 자리로 들어간다).
    if (!open && animate) {
      layoutFan();
      shakeGlobe((b) => 380 + (Number(b.style.getPropertyValue('--i')) - 1) * 45, false);
    }
    bundle.classList.toggle('open', open);
    bundle.setAttribute('aria-expanded', String(open));
    bundle.title = open ? '단추 모아 두기' : '두들링 단추 펼치기';
    $('bundleLabel').textContent = open ? '접기' : '모음';
    if (animate && bundle.animate && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      // 펼칠 때는 톡 튀어 오르고, 접을 때는 다 빨아들인 뒤 꿀꺽 삼킨다.
      if (open) bundle.animate([{ scale: 1 }, { scale: 0.86 }, { scale: 1.08 }, { scale: 1 }], { duration: 320, easing: 'ease-out' });
      else bundle.animate([{ scale: 1 }, { scale: 1.16, rotate: '-6deg' }, { scale: 0.94, rotate: '3deg' }, { scale: 1, rotate: '0deg' }], { duration: 380, delay: 300, easing: 'ease-out' });
    }
    try {
      localStorage.setItem(DOCK_KEY, open ? 'open' : 'shut');
    } catch {
      // 기억하지 못해도 지금 화면은 그대로 쓴다.
    }
  }
  dock.classList.add('still'); // 처음 그릴 때는 움직이지 않고 바로 그 모양으로
  try {
    setDock(localStorage.getItem(DOCK_KEY) !== 'shut', false);
  } catch {
    setDock(true, false);
  }
  void dock.offsetHeight; // 지금 모양을 한 번 계산해 두면, 표시를 떼어도 움직이지 않는다.
  dock.classList.remove('still');
  // 접힌 채로 열렸으면 처음부터 바닥에서 떠돌고 있다.
  if (dock.classList.contains('shut')) for (const b of fanButtons()) settle(b, true);
  bundle.onclick = () => setDock(dock.classList.contains('shut'), true);
  const syncPet = () => {
    const on = globalThis.HW40.mascotOn ? globalThis.HW40.mascotOn() : true;
    $('pet').classList.toggle('off', !on);
    $('pet').setAttribute('aria-pressed', String(on));
  };
  $('pet').onclick = () => {
    globalThis.HW40.toggleMascot();
    syncPet();
  };
  setTimeout(syncPet, 0); // 캐릭터 엔진이 패널보다 늦게 읽힌다

  // ---------- 테마 목록 ----------
  // 기본 · 공용(저장소 themes/) · 내 테마(공유 코드로 추가). 고른 테마는 이 브라우저에만 저장된다.
  const themes = () => globalThis.HW40.themes;
  const message = (text) => {
    $('themeMsg').textContent = text || '';
    $('themeMsg').hidden = !text;
  };
  function renderThemes() {
    const t = themes();
    if (!t) return;
    const active = t.active();
    $('themeList').replaceChildren(
      ...t.list().map((theme) => {
        const row = document.createElement('div');
        row.className = 'theme';
        const pick = document.createElement('button');
        pick.className = 'pick';
        pick.setAttribute('role', 'radio');
        pick.setAttribute('aria-checked', String(theme.key === active));
        pick.textContent = theme.name;
        pick.title = `${theme.cast.length}명`;
        if (theme.source !== 'default') {
          const tag = document.createElement('span');
          tag.className = 'tag';
          tag.textContent = theme.source === 'shared' ? '공용' : '내 테마';
          pick.appendChild(tag);
        }
        pick.onclick = () => {
          t.apply(theme.key);
          message('');
          renderThemes();
        };
        row.appendChild(pick);
        if (theme.source === 'mine') {
          const del = document.createElement('button');
          del.textContent = '✕';
          del.title = '이 테마 지우기';
          del.onclick = () => {
            if (!window.confirm(`"${theme.name}" 테마를 지울까요?`)) return;
            t.remove(theme.key);
            renderThemes();
          };
          row.appendChild(del);
        }
        return row;
      })
    );
    if (t.site) {
      $('themeMake').href = `${t.site}themes.html`;
      $('themeMake').hidden = false;
      $('charMake').href = `${t.site}maker.html`;
      $('charMake').hidden = false;
    }
  }
  onOpen.theme = () => {
    message('');
    renderThemes();
  };
  // 테마 코드(캐릭터가 담긴 코드 포함)를 내 테마로 넣는다. 만들기·고치기는 테마 만들기 화면에서 한다.
  async function addThemeCode(code) {
    message('읽는 중…');
    try {
      const r = await themes().addCode(code);
      const extra = r.characters ? ` 캐릭터 ${r.characters}명도 함께 들어왔어요.` : '';
      message(`"${r.name}" 테마를 넣었어요.${extra}${r.warnings.length ? ` ${r.warnings.join(' ')}` : ''}`);
      $('themePaste').hidden = true;
      $('themeCode').value = '';
    } catch (e) {
      message(e.message);
    }
    renderThemes();
  }
  // 테마 만들기 화면에서 "내 목록에 저장"으로 보낸 테마를 꺼내 넣는다.
  // 이 화면으로 돌아올 때와 몇 초마다 확인한다.
  let pulling = false;
  async function pullThemes() {
    if (pulling || !themes() || !SITE.inbox) return;
    const items = SITE.inbox.take();
    if (!items.length) return;
    pulling = true;
    try {
      for (const item of items) {
        const before = themes().active();
        await addThemeCode(item.code); // 넣으면서 바로 적용된다
        if (!item.apply) themes().apply(before);
      }
      renderThemes();
      if (!isOpen('theme')) showCard('theme', true);
    } finally {
      pulling = false;
    }
  }
  setInterval(pullThemes, 3000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) pullThemes();
  });
  setTimeout(pullThemes, 0);

  // 테마 만들기를 새 탭 대신 이 화면 위 팝업(창 안의 창)으로 연다.
  // 팝업 속 만들기 화면에는 두들링 스크립트가 돌지 않으므로, 저장과 내 캐릭터는 이 화면이 대신 주고받는다.
  // 사이트가 창 안의 창을 막아 열리지 않으면 새 탭으로 여는 단추를 보여 준다.
  let maker = null;
  function closeMaker() {
    if (!maker) return;
    const m = maker;
    maker = null;
    window.removeEventListener('message', m.onMsg);
    document.removeEventListener('keydown', m.onKey, true);
    clearTimeout(m.wait);
    m.box.classList.add('out');
    setTimeout(() => m.host.remove(), 180);
  }
  function openMaker(url, title = '🎨 테마 만들기') {
    closeMaker();
    const origin = new URL(url).origin;
    const host = document.createElement('div');
    host.dataset.hw40 = 'maker';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;';
    document.documentElement.appendChild(host);
    const sh = host.attachShadow({ mode: 'open' });
    sh.innerHTML = `<style>
      * { box-sizing: border-box; }
      .dim { position: absolute; inset: 0; background: rgba(40,32,22,.42); animation: fade .2s ease-out; }
      .box { position: absolute; left: 50%; top: 50%; width: min(1200px, calc(100vw - 32px)); height: min(860px, calc(100vh - 32px));
        transform: translate(-50%, -50%); display: flex; flex-direction: column; overflow: hidden;
        background: #fffdf6; border: 2px solid #3b3226; border-radius: 16px; box-shadow: 4px 6px 0 rgba(59,50,38,.18), 0 18px 50px rgba(0,0,0,.25);
        font: 13px/1.5 'Malgun Gothic', sans-serif; color: #3b3226; animation: pop .26s cubic-bezier(.3,1.4,.5,1); }
      .box.out { animation: shut .18s ease-in forwards; }
      .dim:has(+ .box.out) { animation: fade .18s ease-in reverse forwards; }
      header { display: flex; align-items: center; gap: 8px; padding: 8px 10px 8px 16px; border-bottom: 2px solid #3b3226; background: #fff7dc; }
      header b { font-size: 14px; }
      header a, header button { font: inherit; color: #3b3226; background: #fff; border: 1.5px solid #3b3226; border-radius: 999px; padding: 3px 12px; cursor: pointer; text-decoration: none; }
      header a { margin-left: auto; }
      header button.x { width: 30px; height: 30px; padding: 0; font-weight: 700; }
      header a:hover, header button:hover { background: #ffe58a; }
      iframe { flex: 1; width: 100%; border: 0; background: #fbf7ee; }
      .fail { flex: 1; display: grid; place-content: center; gap: 12px; text-align: center; padding: 24px; }
      .fail a { justify-self: center; color: #3b3226; background: #ffe58a; border: 2px solid #3b3226; border-radius: 999px; padding: 6px 16px; text-decoration: none; font-weight: 700; }
      @keyframes fade { from { opacity: 0; } }
      @keyframes pop { from { opacity: 0; transform: translate(-50%, -46%) scale(.94); } }
      @keyframes shut { to { opacity: 0; transform: translate(-50%, -48%) scale(.96); } }
    </style>
    <div class="dim"></div>
    <div class="box" role="dialog">
      <header><b></b><a target="_blank" rel="noopener">새 탭으로 열기 ↗</a><button class="x" aria-label="닫기" title="닫기 (Esc)">✕</button></header>
      <iframe allow="clipboard-write"></iframe>
    </div>`;
    const box = sh.querySelector('.box');
    const frame = sh.querySelector('iframe');
    sh.querySelector('header b').textContent = title;
    box.setAttribute('aria-label', title.replace(/^S+s/, ''));
    frame.title = box.getAttribute('aria-label');
    const embedUrl = `${url}${url.includes('?') ? '&' : '?'}embed=1`;
    sh.querySelector('header a').href = url;
    sh.querySelector('header a').addEventListener('click', () => closeMaker());
    sh.querySelector('.x').addEventListener('click', closeMaker);
    sh.querySelector('.dim').addEventListener('click', closeMaker); // 빈 곳을 누르면 닫힌다
    const tell = (msg) => frame.contentWindow && frame.contentWindow.postMessage(msg, origin);
    const onMsg = (e) => {
      if (e.source !== frame.contentWindow || e.origin !== origin || !e.data) return;
      const d = e.data;
      if (d.type === 'hw40-embed-hello') {
        clearTimeout(m.wait);
        if (typeof d.title === 'string' && d.title.length < 40) sh.querySelector('header b').textContent = d.title;
        // 내 캐릭터를 건네주고, 저장 단추를 켜게 한다.
        const specs = globalThis.HW40.characters && globalThis.HW40.characters.specs ? globalThis.HW40.characters.specs() : [];
        tell({ type: 'hw40-chars', specs });
        tell({ type: 'hw40-inbox-ready', embedded: true });
      }
      if (d.type === 'hw40-save-theme') {
        const code = typeof d.code === 'string' ? d.code.trim() : '';
        const ok = /^HW40T\d+\./.test(code) && code.length < 4000000 && Boolean(SITE.inbox) && SITE.inbox.put(code, d.apply);
        tell({ type: 'hw40-theme-saved', ok, id: d.id, embedded: true });
        if (ok) pullThemes();
      }
      // 캐릭터 만들기에서 "내 캐릭터에 저장"
      if (d.type === 'hw40-save-char' && typeof d.code === 'string' && globalThis.HW40.characters) {
        globalThis.HW40.characters.addCode(d.code.trim()).then(
          (r) => tell({ type: 'hw40-char-saved', ok: true, id: d.id, name: r.name, replaced: r.replaced }),
          (err) => tell({ type: 'hw40-char-saved', ok: false, id: d.id, error: String(err && err.message ? err.message : err) })
        );
      }
    };
    // 실수로 닫히지 않게 바깥을 눌러도 닫지 않는다. Esc와 ✕로 닫는다.
    const onKey = (e) => {
      if (e.key === 'Escape') closeMaker();
    };
    const m = { host, box, onMsg, onKey, wait: 0 };
    maker = m;
    window.addEventListener('message', onMsg);
    document.addEventListener('keydown', onKey, true);
    // 만들기 화면이 인사하지 않으면(사이트가 창 안의 창을 막음) 새 탭 안내로 바꾼다.
    m.wait = setTimeout(() => {
      if (maker !== m) return;
      const fail = document.createElement('div');
      fail.className = 'fail';
      fail.innerHTML = '<div>이 사이트에서는 만들기 화면을 창 안에 열 수 없어요.</div><a target="_blank" rel="noopener">새 탭으로 열기 ↗</a>';
      fail.querySelector('a').href = url;
      fail.querySelector('a').addEventListener('click', () => closeMaker());
      frame.replaceWith(fail);
    }, 10000);
    frame.src = embedUrl;
    frame.focus();
  }
  for (const [btn, title] of [['themeMake', '🎨 테마 만들기'], ['charMake', '🧸 캐릭터 만들기']]) {
    $(btn).addEventListener('click', (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return; // 새 탭으로 열고 싶을 때는 그대로
      e.preventDefault();
      openMaker($(btn).href, title);
    });
  }
  $('themeAdd').onclick = () => {
    $('themePaste').hidden = !$('themePaste').hidden;
    message('');
    if (!$('themePaste').hidden) $('themeCode').focus();
  };
  $('themeCancel').onclick = () => {
    $('themePaste').hidden = true;
  };
  $('themeOk').onclick = () => addThemeCode($('themeCode').value);
  $('themeFile').onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,text/plain';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (file) addThemeCode(await file.text());
    };
    input.click();
  };
  $('themeCopy').onclick = async () => {
    const code = await themes().code(themes().active());
    try {
      await navigator.clipboard.writeText(code);
      message('지금 테마 코드를 복사했어요. 동료에게 보내 주세요.');
    } catch {
      window.prompt('이 코드를 복사해 동료에게 보내 주세요.', code);
    }
  };

  // ---------- 모이기 (방장의 방) ----------
  // 방장이 방을 열면 8글자 방 코드가 나온다. 동료는 그 코드로 들어온다. 말은 중계 서버(relay.js)를 거쳐 방장이 모두에게 전해 준다.
  // 방에 있는 동안 모두의 화면에는 방장의 테마 캐릭터들(방 캐릭터)이 돌아다니고, 그 위로 각자의 아바타가 이름표를 달고 나온다.
  // 방장이 꾸미기 권한을 준 사람은 자기 캐릭터를 방에 데려오거나 방 캐릭터를 뺄 수 있다.
  // 말은 아바타 말풍선 + 왼쪽 벽 채팅 목록에 뜬다.
  const VISIT = () => globalThis.HW40_VISIT;
  const ROOM = () => globalThis.HW40_ROOM;
  const RELAY = () => globalThis.HW40_RELAY_LINK;
  const guests = () => globalThis.HW40.guests;
  const engineRoom = () => globalThis.HW40.room;
  const NICK_KEY = 'hw40-visit-nick';
  const AVATAR_KEY = 'hw40-room-avatar';
  const FAIL_NOTE = '방에 연결하지 못했어요. 잠시 뒤 다시 해 주세요.';
  const CLOSED_NOTE = {
    'host-left': '방장이 방을 닫았어요.',
    full: '방이 꽉 찼어요.',
    kicked: '방장이 방에서 내보냈어요.',
    lost: '방과 연결이 끊겼어요.',
    left: '방에서 나왔어요.',
  };
  let room = null;
  let entered = false; // 방에 실제로 들어갔는지 (멤버: 방장과 연결된 뒤)
  let joinWait = 0;
  let selfHandle = null; // 내 화면에 나온 내 아바타
  const handles = new Map(); // pid → 내 화면에 나온 그 사람의 아바타
  const readKey = (key) => {
    try {
      return localStorage.getItem(key) || '';
    } catch {
      return '';
    }
  };
  const writeKey = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // 이번에만 쓴다.
    }
  };
  $('vNick').value = readKey(NICK_KEY);
  $('vNick').addEventListener('change', () => writeKey(NICK_KEY, $('vNick').value.trim()));
  const avatarId = () => $('vAvatar').value || null;
  const myNick = () => VISIT().cleanNick($('vNick').value);
  const me = () => ({ nick: $('vNick').value, avatar: guests() ? guests().me(avatarId()) : null });
  // 안내 글은 모이기 종이와, 코드 팝업이 떠 있으면 팝업에도 쓴다.
  const vmsg = (text) => {
    for (const id of ['vMsg', 'mMsg']) {
      $(id).textContent = text || '';
      $(id).hidden = !text;
    }
  };
  // 방 코드 팝업: 방장은 코드를 보고 복사하고, 동료는 코드를 넣는다.
  function showModal(open) {
    $('codeModal').hidden = !open;
    if (open) setTimeout(() => (!$('vInBox').hidden ? $('vIn') : $('vCopy')).focus(), 0);
  }
  function closeModal() {
    if (visitStep === 'joining') return $('vEnd').click(); // 들어가기 취소
    if (visitStep === 'hostCode') return step('host');
    $('codeModal').hidden = true;
  }
  $('mClose').onclick = closeModal;
  $('codeModal').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
  const optionsOf = (select, items, saved) => {
    select.replaceChildren(...items.map((c) => {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.mine ? `${c.name} (내 캐릭터)` : c.name;
      return o;
    }));
    if (items.some((c) => c.id === saved)) select.value = saved;
  };

  // 아바타로 고를 수 있는 캐릭터 = 내 테마 캐릭터 + 나머지 모든 캐릭터
  function renderAvatars() {
    if (!guests()) return;
    const select = $('vAvatar');
    const saved = select.value || readKey(AVATAR_KEY);
    const all = guests().choices ? guests().choices() : guests().cast();
    const groups = [['theme', '내 테마'], ['all', '다른 캐릭터']].map(([key, label]) => {
      const g = document.createElement('optgroup');
      g.label = label;
      for (const c of all.filter((x) => (x.group || 'theme') === key)) {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = c.mine ? `${c.name} (내 캐릭터)` : c.name;
        g.appendChild(o);
      }
      return g;
    }).filter((g) => g.children.length);
    select.replaceChildren(...groups);
    if (all.some((c) => c.id === saved)) select.value = saved;
  }
  // 내 아바타를 눌러 "갈아입기": 모이기 종이를 펴고 아바타 고르는 칸으로 간다.
  function pickAvatar() {
    if (!isOpen('visit')) toggleCard('visit');
    if (!$('vAvatar').options.length) renderAvatars();
    const select = $('vAvatar');
    select.focus();
    try {
      if (select.showPicker) select.showPicker();
    } catch {
      // 목록을 바로 못 펼치면 칸에만 손이 가게 둔다.
    }
  }
  // 내 아바타를 (다시) 내 화면에 내보낸다.
  function showSelf(quiet) {
    if (selfHandle) selfHandle.leave(quiet ? '갈아입는 중~' : '안녕~');
    selfHandle = guests().arrive(me().avatar || {}, { nick: myNick(), self: true, quiet, change: pickAvatar });
  }
  $('vAvatar').addEventListener('focus', () => {
    if (!$('vAvatar').options.length) renderAvatars();
  });
  $('vAvatar').addEventListener('change', () => {
    writeKey(AVATAR_KEY, $('vAvatar').value);
    if (room && entered) {
      showSelf(true);
      room.avatarChanged();
    }
  });

  // ---------- 왼쪽 벽 칠판 (채팅 목록) ----------
  // 나무 틀에 초록 칠판. 다른 사람 말은 왼쪽, 내 말은 오른쪽, 알림은 가운데에 분필로 적힌다.
  // 캐릭터보다 낮은 층에 둔다: 가둔 캐릭터의 종이가 왼쪽 벽에 붙으면 칠판을 덮는다.
  const wallHost = document.createElement('div');
  wallHost.style.cssText = 'position:fixed;left:8px;bottom:96px;width:260px;height:min(380px, calc(100vh - 180px));z-index:2147483630;pointer-events:none;';
  wallHost.dataset.hw40 = 'wall';
  wallHost.hidden = true;
  document.documentElement.appendChild(wallHost);
  const wallRoot = wallHost.attachShadow({ mode: 'open' });
  wallRoot.innerHTML = `
    <style>
      .board { position: absolute; inset: 0; box-sizing: border-box; padding: 9px; border-radius: 6px;
        background: linear-gradient(135deg, #a8774a, #8a5a32 45%, #a8774a); box-shadow: 0 4px 14px rgba(0,0,0,.28), inset 0 0 0 1px rgba(0,0,0,.25);
        animation: hang .3s ease-out; }
      .slate { position: relative; height: 100%; box-sizing: border-box; border-radius: 3px; overflow: hidden;
        background: radial-gradient(ellipse at 30% 20%, rgba(255,255,255,.07), transparent 60%),
          radial-gradient(ellipse at 75% 80%, rgba(255,255,255,.05), transparent 55%), #2f4a3a;
        box-shadow: inset 0 0 18px rgba(0,0,0,.45); }
      /* 지우개로 덜 지운 흔적 */
      .slate::before { content: ''; position: absolute; inset: 0; pointer-events: none;
        background: repeating-linear-gradient(-12deg, transparent 0 22px, rgba(255,255,255,.025) 22px 30px); }
      .title { position: absolute; top: 6px; left: 0; right: 0; text-align: center; color: rgba(245,245,235,.55);
        font: 600 11px 'Malgun Gothic', sans-serif; letter-spacing: 2px; }
      /* 분필 받침 */
      .tray { position: absolute; left: 14px; right: 14px; bottom: -3px; height: 7px; border-radius: 2px; background: #6e4524;
        box-shadow: 0 2px 3px rgba(0,0,0,.3); }
      .tray::before, .tray::after { content: ''; position: absolute; top: -4px; height: 5px; border-radius: 3px; }
      .tray::before { left: 22px; width: 26px; background: #f4f1e6; }
      .tray::after { left: 56px; width: 18px; background: #f2c2c8; }
      .wall { position: absolute; inset: 22px 8px 46px; display: flex; flex-direction: column; justify-content: flex-end; gap: 6px; overflow: hidden;
        -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 60px); mask-image: linear-gradient(to bottom, transparent 0, #000 60px); }
      .line { max-width: 82%; box-sizing: border-box; word-break: break-all; color: #f4f1e6;
        font: 13px/1.45 'Malgun Gothic', sans-serif; text-shadow: 0 0 1px rgba(255,255,255,.55), 0 0 4px rgba(255,255,255,.15);
        animation: chalk .35s ease-out both; }
      .line b { display: block; font-size: 11px; font-weight: 700; margin-bottom: 1px; }
      .line.other { align-self: flex-start; text-align: left; padding-left: 8px; border-left: 2px solid rgba(244,241,230,.35); }
      .line.mine { align-self: flex-end; text-align: right; padding-right: 8px; border-right: 2px solid rgba(255,229,138,.6); color: #fff3b8; }
      .line.sys { align-self: center; max-width: 92%; text-align: center; color: rgba(244,241,230,.6); font-size: 11px; text-shadow: none; }
      @keyframes chalk { from { opacity: 0; transform: translateX(-10px); } }
      .line.mine { animation-name: chalkR; }
      @keyframes chalkR { from { opacity: 0; transform: translateX(10px); } }
      @keyframes hang { from { opacity: 0; transform: translateY(-10px) rotate(-1.5deg); } }
      /* 칠판 아래에서 바로 적기 */
      .say { position: absolute; left: 8px; right: 8px; bottom: 8px; display: flex; gap: 5px; pointer-events: auto; }
      .say[hidden] { display: none; }
      .say input { flex: 1; min-width: 0; box-sizing: border-box; height: 30px; padding: 0 9px; border-radius: 6px;
        border: 1.5px dashed rgba(244,241,230,.45); background: rgba(0,0,0,.18); color: #fff3b8; outline: none;
        font: 13px 'Malgun Gothic', sans-serif; }
      .say input::placeholder { color: rgba(244,241,230,.5); }
      .say input:focus { border-style: solid; border-color: rgba(255,229,138,.8); background: rgba(0,0,0,.26); }
      .say button { height: 30px; padding: 0 10px; border-radius: 6px; border: 0; background: #f4f1e6; color: #2f4a3a; cursor: pointer;
        font: 700 12px 'Malgun Gothic', sans-serif; box-shadow: 0 2px 0 rgba(0,0,0,.25); }
      .say button:hover { background: #fff3b8; }
      /* 칠판 크기 손잡이: 오른쪽 위 모서리를 끌어 크기를 바꾼다 (왼쪽 아래는 벽에 붙어 있다) */
      .grip { position: absolute; top: -4px; right: -4px; width: 22px; height: 22px; pointer-events: auto; cursor: nesw-resize;
        border-radius: 50%; background: #6e4524; box-shadow: 0 1px 3px rgba(0,0,0,.35); display: grid; place-items: center; touch-action: none; }
      .grip svg { width: 12px; height: 12px; stroke: #f4f1e6; stroke-width: 2; fill: none; stroke-linecap: round; }
      .grip:hover { background: #8a5a32; }
      .resizing .line { animation: none; }
      @media (prefers-reduced-motion: reduce) { .line, .board { animation: none; } }
    </style>
    <div class="board"><div class="slate"><div class="title">칠 판</div>
    <div class="wall" id="wall" role="log" aria-label="채팅 칠판"></div>
    <div class="say" id="say" hidden><input type="text" id="wText" maxlength="100" placeholder="분필로 적고 Enter" aria-label="할 말"><button id="wSend">적기</button></div>
    </div><div class="tray"></div>
    <div class="grip" id="grip" title="끌어서 칠판 크기 바꾸기 (두 번 누르면 원래대로)"><svg viewBox="0 0 12 12"><path d="M3 9 9 3M3 5V3h2M9 7v2H7"/></svg></div></div>`;
  const wallEl = wallRoot.getElementById('wall');
  const wallSay = wallRoot.getElementById('say');
  // 칠판 크기: 오른쪽 위 손잡이로 바꾸고, 다음에도 그 크기로 건다.
  const BOARD_KEY = 'hw40-board-size';
  const BOARD_DEFAULT = { w: 260, h: 380 };
  const boardLimit = ({ w, h }) => ({
    w: Math.round(Math.min(Math.max(w, 180), Math.min(520, window.innerWidth - 40))),
    h: Math.round(Math.min(Math.max(h, 170), window.innerHeight - 140)),
  });
  let boardSize = BOARD_DEFAULT; // 사람이 고른 크기 (화면이 좁아지면 잠시 줄여 보여도 이 값은 그대로)
  function setBoard(size, save) {
    if (save !== null) boardSize = size;
    const { w, h } = boardLimit(size);
    wallHost.style.width = `${w}px`;
    wallHost.style.height = `${h}px`;
    if (save) {
      boardSize = { w, h };
      writeKey(BOARD_KEY, JSON.stringify({ w, h }));
    }
  }
  try {
    setBoard({ ...BOARD_DEFAULT, ...JSON.parse(readKey(BOARD_KEY) || '{}') }, false);
  } catch {
    setBoard(BOARD_DEFAULT, false);
  }
  window.addEventListener('resize', () => setBoard(boardSize, null));
  const grip = wallRoot.getElementById('grip');
  grip.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    const start = { x: e.clientX, y: e.clientY, w: wallHost.offsetWidth, h: wallHost.offsetHeight };
    wallRoot.querySelector('.board').classList.add('resizing');
    const move = (ev) => setBoard({ w: start.w + ev.clientX - start.x, h: start.h - (ev.clientY - start.y) }, false);
    const up = () => {
      grip.removeEventListener('pointermove', move);
      wallRoot.querySelector('.board').classList.remove('resizing');
      setBoard({ w: wallHost.offsetWidth, h: wallHost.offsetHeight }, true);
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up, { once: true });
    grip.addEventListener('pointercancel', up, { once: true });
  });
  grip.addEventListener('dblclick', () => setBoard(BOARD_DEFAULT, true));
  const wallText = wallRoot.getElementById('wText');
  const NICK_COLORS = ['#ffb3a7', '#b5e8a3', '#d3bfff', '#ffd88a', '#9fe3ea', '#ffb8d9', '#e8cfb0', '#b7ccff'];
  const colorOf = (pid) => NICK_COLORS[[...String(pid)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % NICK_COLORS.length];
  let wallTimer = 0;
  function wallLine(who, text, { pid = null, mine = false } = {}) {
    clearTimeout(wallTimer);
    wallHost.hidden = false;
    const row = document.createElement('div');
    row.className = who ? (mine ? 'line mine' : 'line other') : 'line sys';
    // 내 말에는 이름을 쓰지 않는다 (오른쪽에 있으면 내 말).
    if (who && !mine) {
      const b = document.createElement('b');
      b.textContent = who;
      b.style.color = colorOf(pid);
      row.appendChild(b);
    }
    row.appendChild(document.createTextNode(text));
    wallEl.appendChild(row);
    while (wallEl.children.length > 40) wallEl.firstChild.remove();
  }
  const josa = (word, withBatchim, without) => {
    const code = String(word).charCodeAt(String(word).length - 1) - 0xac00;
    return code >= 0 && code <= 11171 && code % 28 ? withBatchim : without;
  };

  // ---------- 패널 화면 ----------
  const STEPS = {
    start: { start: true },
    host: { room: true, chat: true, end: '방 닫기', invite: true },
    hostCode: { room: true, chat: true, end: '방 닫기', invite: true, out: '이 방 코드를 동료들에게 알려 주세요. 몇 명이든 같은 코드로 들어와요.', modal: ['방을 열었어요', '방 코드만 알려 주면 바로 들어와요'] },
    joining: { in: '방장에게 받은 방 코드를 넣어요', ok: '들어가기', end: '취소', modal: ['방 코드로 들어가기', '방장이 알려 준 8글자 코드예요'] },
    member: { room: true, chat: true, end: '방에서 나가기' },
  };
  let visitStep = 'start';
  function step(name) {
    visitStep = name;
    const s = STEPS[name];
    $('vStart').hidden = !s.start;
    $('vRoom').hidden = !s.room;
    $('vCodeRow').hidden = !s.invite;
    $('vOutBox').hidden = !s.out;
    $('vOutLabel').textContent = s.out || '';
    $('vInBox').hidden = !s.in;
    $('vInLabel').textContent = s.in || '';
    $('vInOk').textContent = s.ok || '';
    $('vInOk').disabled = false;
    if (s.modal) {
      $('mTitle').textContent = s.modal[0];
      $('mSub').textContent = s.modal[1];
    }
    showModal(Boolean(s.modal));
    // 방에 있는 동안은 칠판을 걸어 두고, 칠판 아래에서 바로 말한다.
    wallSay.hidden = !s.chat;
    if (s.chat) {
      clearTimeout(wallTimer);
      wallHost.hidden = false;
    }
    $('vEnd').hidden = !s.end;
    $('vEnd').textContent = s.end || '';
    if (s.in) $('vIn').value = '';
    renderDeco();
  }
  // 사람 목록. 방장은 다른 사람 이름을 눌러 꾸미기 권한(✏️)을 주거나 거둔다.
  function renderPeople(list) {
    const hosting = room && room.role === 'host';
    $('vPeople').replaceChildren(...list.map((p) => {
      const chip = document.createElement(hosting && !p.me ? 'button' : 'span');
      chip.className = 'vchip';
      const crown = p.pid === ROOM().HOST_ID ? ' 👑' : p.editor ? ' ✏️' : '';
      chip.textContent = `${p.me ? '나' : p.nick}${crown}`;
      chip.title = p.avatar ? `${p.nick} · ${p.avatar.name}` : p.nick;
      if (!p.me) chip.style.color = colorOf(p.pid);
      if (hosting && !p.me) {
        chip.title += p.editor ? ' · 눌러서 꾸미기 권한 거두기' : ' · 눌러서 방 꾸미기 권한 주기';
        chip.onclick = () => {
          room.grant(p.pid, !p.editor);
          wallLine('', p.editor ? `${p.nick}님의 꾸미기 권한을 거뒀어요` : `${p.nick}님에게 방 꾸미기 권한을 줬어요`);
        };
      }
      return chip;
    }));
    $('vCount').textContent = `${list.length}명`;
  }
  // 방 꾸미기: 방 캐릭터 목록(✕로 빼기)과 내 캐릭터 데려오기
  function renderDeco() {
    const show = Boolean(room && entered && !room.closed && $('vRoom').hidden === false);
    $('vDeco').hidden = !show;
    if (!show) return;
    const canEdit = room.canEdit;
    const cast = room.cast();
    $('vCastLabel').textContent = `방 캐릭터 ${cast.length}/${ROOM().MAX_CAST}${canEdit ? '' : ' · 꾸미려면 방장에게 권한을 받아요'}`;
    $('vCast').replaceChildren(...cast.map((c) => {
      const chip = document.createElement('span');
      chip.className = 'vchip cast';
      chip.textContent = c.name || (engineRoom().entryFor(c.id) || {}).name || c.id;
      if (canEdit) {
        const del = document.createElement('button');
        del.textContent = '✕';
        del.title = '방에서 빼기';
        del.onclick = () => room.removeCast(c.key);
        chip.appendChild(del);
      }
      return chip;
    }));
    $('vBringRow').hidden = !canEdit;
    if (canEdit && !$('vBring').options.length) optionsOf($('vBring'), engineRoom().bringable(), '');
  }
  $('vBringOk').onclick = () => {
    if (!room || !room.canEdit) return;
    const item = engineRoom().entryFor($('vBring').value);
    if (!item) return;
    if (!room.addCast(item)) vmsg(`방 캐릭터는 ${ROOM().MAX_CAST}명까지예요. 하나를 빼고 데려와 주세요.`);
  };

  function showAvatar(p, had) {
    const old = handles.get(p.pid);
    if (old) old.leave('갈아입는 중~');
    handles.set(p.pid, guests().arrive(p.avatar || {}, {
      nick: p.nick,
      quiet: had,
      pet: () => room && room.pet(p.pid),
      leave: room && room.role === 'host' ? () => room.kick(p.pid) : null,
    }));
  }
  // 방에 들어간 순간: 화면을 방으로 바꾸고 내 아바타를 내보낸다.
  function enterRoom(note) {
    entered = true;
    showSelf(false);
    wallLine('', note);
    renderDeco();
  }
  // 지금 있는 방을 이 탭에 기억해 둔다. 새로고침하거나 크롬이 숨은 탭을 비웠다 다시 불러와도 같은 방, 같은 자리로 돌아간다.
  // (탭을 닫으면 sessionStorage도 사라진다. 서버는 닫거나 새로고침한 자리를 1분, 그 밖의 끊김은 10시간 비워 둔다.)
  const SESSION_KEY = 'hw40-room-session';
  const SESSION_MAX_MS = 10 * 60 * 60 * 1000;
  function saveSession(r) {
    if (!r || r !== room || !roomCode || !r.relayId) return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        code: roomCode,
        role: r.role,
        id: r.relayId,
        cast: r.role === 'host' ? r.cast() : null,
        editors: r.role === 'host' ? r.editors : null,
        at: Date.now(),
      }));
    } catch {
      // 기억하지 못해도 지금 방은 그대로 쓴다.
    }
  }
  function clearSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // 지울 것이 없다.
    }
  }
  // 새로고침한 뒤: 기억해 둔 방으로 조용히 돌아간다.
  async function resumeRoom() {
    let saved = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    } catch {
      saved = null;
    }
    if (!saved || !saved.code || room || Date.now() - saved.at > SESSION_MAX_MS) return;
    if (!VISIT() || !ROOM() || !RELAY() || !engineRoom() || typeof WebSocket === 'undefined' || !RELAY().relayUrl()) return;
    hookCast();
    if (!$('vAvatar').options.length) renderAvatars();
    const r = newRoom();
    roomCode = saved.code;
    $('vCodeText').textContent = roomCode;
    $('vOut').value = roomCode;
    try {
      if (saved.role === 'host') {
        await r.openOnline(roomCode, Array.isArray(saved.cast) && saved.cast.length ? saved.cast : engineRoom().themeCast(), { prev: saved.id, editors: saved.editors || [] });
        if (r !== room) return;
        step('host');
        enterRoom('다시 연결했어요. 방은 그대로예요.');
      } else {
        // 방장이 인사를 받아 주면 join 알림으로 방 화면이 열린다.
        await r.enter(roomCode, { prev: saved.id });
      }
      saveSession(r);
    } catch {
      if (r === room) room = null;
      clearSession();
    }
  }
  setTimeout(resumeRoom, 600);
  function newRoom() {
    const r = ROOM().createRoom({
      makeLink: (hooks) => VISIT().createLink(hooks),
      makeHub: (opts) => RELAY().connect(opts),
      me,
      on: {
        people(list) {
          if (r === room) renderPeople(list);
        },
        join(p, had) {
          if (r !== room) return;
          if (!entered && r.role === 'member') {
            clearTimeout(joinWait);
            step('member');
            vmsg('');
            enterRoom('방에 들어왔어요. 여기는 방장의 방이에요!');
            wallText.focus();
          }
          showAvatar(p, had);
          if (!had) wallLine('', `${p.nick}님이 들어왔어요`);
        },
        leave(p) {
          const h = handles.get(p.pid);
          if (h) h.leave('안녕~');
          handles.delete(p.pid);
          if (!r.closed) wallLine('', `${p.nick}님이 나갔어요`);
        },
        say(p, text) {
          const h = handles.get(p.pid);
          if (h) h.say(text);
          wallLine(p.nick, text, { pid: p.pid });
        },
        petted(p) {
          if (selfHandle) selfHandle.react(p.nick);
        },
        wobble(state) {
          if (r !== room || !entered) return;
          wallLine('', state === 'retrying' ? '연결이 잠깐 끊겼어요. 다시 붙는 중…' : '다시 연결됐어요');
        },
        // 누가 자리를 비웠다(💤) / 돌아왔다. 방장이 비운 방에 들어오는 중이면 기다리라고 알린다.
        away(p, on) {
          if (r !== room) return;
          if (p.pid === 'h' && !entered && r.role === 'member') {
            if (on) {
              clearTimeout(joinWait);
              vmsg('방장이 잠깐 자리를 비웠어요. 돌아오면 바로 들어가져요.');
            }
            return;
          }
          const h = handles.get(p.pid);
          if (h && h.away) h.away(on);
        },
        cast(list, change) {
          if (r !== room) return;
          if (r.role === 'host') saveSession(r);
          engineRoom().setCast(list);
          if (change && change.added) {
            const name = change.added.name || (engineRoom().entryFor(change.added.id) || {}).name || '캐릭터';
            wallLine('', `${change.nick}님이 ${name}${josa(name, '을', '를')} 방에 데려왔어요`);
          } else if (change && change.removed) {
            const name = change.removed.name || (engineRoom().entryFor(change.removed.id) || {}).name || '캐릭터';
            wallLine('', `${change.nick}님이 ${name}${josa(name, '을', '를')} 방에서 뺐어요`);
          }
          renderDeco();
        },
        perm(canEdit) {
          if (r !== room) return;
          if (r.role === 'host') saveSession(r);
          if (r.role === 'member' && entered) wallLine('', canEdit ? '방장이 방 꾸미기 권한을 줬어요 ✏️' : '방 꾸미기 권한이 없어졌어요');
          renderDeco();
        },
        closed(reason) {
          if (r !== room) return;
          const note = !entered && reason === 'lost' ? FAIL_NOTE
            : r.role === 'host' && reason === 'left' ? '방을 닫았어요.'
              : CLOSED_NOTE[reason] || '방이 닫혔어요.';
          clearSession();
          // 다른 사람 아바타는 벽에 붙었다가 사라지고, 화면은 내 테마로 돌아온다.
          for (const h of handles.values()) h.leave('안녕~');
          handles.clear();
          if (selfHandle) selfHandle.leave('안녕~');
          selfHandle = null;
          engineRoom().exit();
          if (entered) wallLine('', note);
          room = null;
          entered = false;
          step('start');
          vmsg(note);
          // 채팅 목록은 잠깐 더 보여주고 치운다.
          wallTimer = setTimeout(() => {
            wallHost.hidden = true;
            wallEl.replaceChildren();
          }, 15000);
        },
      },
    });
    room = r;
    return r;
  }
  const canConnect = () => {
    if (!VISIT() || !ROOM() || !RELAY() || !engineRoom() || typeof WebSocket === 'undefined' || !(typeof crypto !== 'undefined' && crypto.subtle)) {
      vmsg('이 브라우저에서는 모이기를 쓸 수 없어요.');
      return false;
    }
    if (!RELAY().relayUrl()) {
      vmsg('아직 중계 서버가 준비되지 않았어요.');
      return false;
    }
    writeKey(NICK_KEY, $('vNick').value.trim());
    hookCast();
    if (!$('vAvatar').options.length) renderAvatars();
    $('vBring').replaceChildren();
    return true;
  };

  onOpen.visit = () => {
    hookCast();
    renderAvatars();
  };
  let roomCode = '';
  $('vOpen').onclick = async () => {
    if (!canConnect()) return;
    const r = newRoom();
    roomCode = RELAY().newCode();
    $('vOpen').disabled = true;
    vmsg('방을 여는 중…');
    try {
      await r.openOnline(roomCode, engineRoom().themeCast());
    } catch (e) {
      if (r === room) {
        room = null;
        vmsg(e.message);
      }
      return;
    } finally {
      $('vOpen').disabled = false;
    }
    if (r !== room) return;
    $('vCodeText').textContent = roomCode;
    $('vOut').value = roomCode;
    step('hostCode');
    enterRoom('방을 열었어요. 방 코드를 동료들에게 알려 주세요. 이름을 누르면 꾸미기 권한을 줄 수 있어요.');
    vmsg('');
    saveSession(r);
  };
  $('vInvite').onclick = () => {
    if (room && room.role === 'host') step('hostCode');
  };
  $('vJoin').onclick = () => {
    if (!canConnect()) return;
    room = null;
    entered = false;
    step('joining');
    vmsg('');
  };
  async function joinByCode() {
    const code = RELAY().cleanCode($('vIn').value);
    if (!code) {
      vmsg('방 코드는 8글자예요 (예: K7Q2-M9XA). 다시 확인해 주세요.');
      return;
    }
    const r = newRoom();
    $('vInOk').disabled = true;
    vmsg('들어가는 중…');
    try {
      await r.enter(code);
      if (r !== room) return;
      roomCode = code;
      saveSession(r);
      clearTimeout(joinWait);
      // 방장이 인사를 받아 주면 join 알림으로 방에 들어간다. 오래 답이 없으면 알려 준다.
      joinWait = setTimeout(() => {
        if (r === room && !entered) {
          r.leave();
          vmsg('방장에게서 답이 없어요. 잠시 뒤 다시 해 주세요.');
        }
      }, 15000);
    } catch (e) {
      if (r === room) {
        room = null;
        $('vInOk').disabled = false;
        vmsg(e.message);
      }
    }
  }
  $('vInOk').onclick = joinByCode;
  $('vIn').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) joinByCode();
  });
  $('vCopy').onclick = async () => {
    try {
      await navigator.clipboard.writeText($('vOut').value);
      vmsg('복사했어요. 하이웍스 메신저 등으로 보내 주세요.');
    } catch {
      $('vOut').select();
      vmsg('코드를 선택해 두었어요. Ctrl+C로 복사해 주세요.');
    }
  };
  function sendChat() {
    if (!room || !entered) return;
    const text = room.say(wallText.value);
    if (!text) return;
    if (selfHandle) selfHandle.say(text);
    wallLine(myNick(), text, { mine: true });
    wallText.value = '';
  }
  wallRoot.getElementById('wSend').onclick = sendChat;
  wallText.addEventListener('keydown', (e) => {
    e.stopPropagation(); // 근무 페이지의 단축키로 새지 않게
    if (e.key === 'Enter' && !e.isComposing) sendChat();
  });
  $('vEnd').onclick = () => {
    if (!room) return step('start');
    if (room.role === 'host' && room.people().length > 1 && !window.confirm('방을 닫으면 모두 나가게 돼요. 닫을까요?')) return;
    room.leave();
  };
  // 내 테마를 바꾸면 아바타 목록을 다시 만든다 (방 화면은 그대로).
  function hookCast() {
    if (!guests()) return;
    guests().onCast = () => {
      const before = avatarId();
      renderAvatars();
      if (room && entered && avatarId() !== before) {
        showSelf(true);
        room.avatarChanged();
      }
    };
  }
  hookCast();
  setTimeout(hookCast, 0); // 캐릭터 엔진이 패널보다 늦게 읽히는 경우
  // 페이지를 떠나면 방에서 나간다 (방장이면 방이 닫힌다).
  window.addEventListener('pagehide', () => {
    if (room) room.leave();
  });

  // ---------- 회사 설정 ----------
  // 근무 규칙(주·월·하루 단위)과, 하이웍스가 아닌 근무 페이지에서 읽을 곳. "회사 설정 코드"로 동료와 나눈다.
  const COMPANY = globalThis.HW40_COMPANY;
  const READER = globalThis.HW40_READER;
  const SITE = globalThis.HW40_SITE || { builtin: true, builtinName: '하이웍스', company: () => null, saveCompany: () => false, clearCompany() {} };
  let company = null;
  function loadCompany() {
    try {
      company = SITE.company() ? COMPANY.normalizeCompany(SITE.company()) : null;
    } catch {
      company = null;
    }
    setRules(company ? company.rules : null);
  }
  loadCompany();
  // 하이웍스가 아닌 사이트는 읽을 곳을 가르쳐야 계산할 수 있다.
  const needsTeach = () => !SITE.builtin && !(company && company.fields);
  const smsg = (text, err) => {
    $('setMsg').textContent = text || '';
    $('setMsg').hidden = !text;
    $('setMsg').style.color = err ? '#c0392b' : '';
  };
  const MODE_TEXT = {
    week: { hours: '주 목표 시간', earliest: '금요일 가장 빠른 퇴근' },
    month: { hours: '월 목표 시간', earliest: '가장 빠른 퇴근 (없으면 비움)' },
    day: { hours: '하루 근무 시간', earliest: '코어타임 끝 (없으면 비움)' },
  };
  $('sPreset').replaceChildren(
    ...COMPANY.PRESET_LIST.map((p) => new Option(p.label, p.id)),
    new Option('직접 고친 규칙', ''),
  );
  function fillForm(rules) {
    $('sMode').value = rules.mode;
    $('sAuto').checked = rules.hours === 'auto';
    $('sHours').value = rules.hours === 'auto' ? '' : rules.hours;
    $('sStart').value = rules.workStart;
    $('sLunchOn').checked = Boolean(rules.lunch);
    $('sLunchA').value = rules.lunch ? rules.lunch[0] : '12:00';
    $('sLunchB').value = rules.lunch ? rules.lunch[1] : '13:00';
    $('sEarliest').value = rules.earliest || '';
    $('sDaily').value = rules.daily;
    syncForm();
  }
  function syncForm() {
    const mode = $('sMode').value;
    const t = MODE_TEXT[mode];
    $('sHoursLabel').textContent = t.hours;
    $('sEarliestLabel').textContent = t.earliest;
    $('sAutoRow').hidden = mode !== 'month';
    const auto = mode === 'month' && $('sAuto').checked;
    $('sHours').disabled = auto;
    $('sHours').placeholder = auto ? '자동' : '';
    $('sDailyRow').hidden = mode === 'day';
    $('sDailyLabel').textContent = mode === 'month' ? '하루 기준 시간' : '월~목 예상 하루';
    // 지금 값과 같은 프리셋을 보여 준다 (고치면 "직접 고친 규칙")
    const preset = COMPANY.presetOf(formRules());
    $('sPreset').value = preset ? preset.id : '';
    $('sLunchA').disabled = !$('sLunchOn').checked;
    $('sLunchB').disabled = !$('sLunchOn').checked;
  }
  const formRules = () => COMPANY.normalizeRules({
    mode: $('sMode').value,
    hours: $('sMode').value === 'month' && $('sAuto').checked ? 'auto' : $('sHours').value,
    workStart: $('sStart').value,
    lunch: $('sLunchOn').checked ? [$('sLunchA').value, $('sLunchB').value] : null,
    earliest: $('sEarliest').value || null,
    daily: $('sDaily').value,
  });
  function renderSettings() {
    $('setSite').textContent = SITE.builtin ? `${SITE.builtinName} (기본 지원)` : SITE.host;
    $('sName').value = company ? company.name : '';
    fillForm(company ? company.rules : COMPANY.DEFAULT_PRESET.rules);
    $('sReset').hidden = !(SITE.builtin && company);
    $('readBox').hidden = SITE.builtin;
    const f = (company && company.fields) || {};
    $('readState').textContent = READER.STEPS.map((s) => `${s.title.split(' (')[0].replace('이번 주(또는 이번 달) ', '')} ${f[s.key] ? '✓' : '–'}`).join(' · ');
  }
  // 프리셋을 고르면 그 값으로 채운다. 방식을 바꾸면 그 방식의 첫 프리셋으로.
  $('sPreset').onchange = () => {
    const p = COMPANY.PRESET_LIST.find((x) => x.id === $('sPreset').value);
    if (p) fillForm(p.rules);
  };
  $('sMode').onchange = () => fillForm((COMPANY.PRESET_LIST.find((x) => x.rules.mode === $('sMode').value) || COMPANY.PRESETS[$('sMode').value]).rules);
  for (const id of ['sLunchOn', 'sAuto', 'sHours', 'sStart', 'sLunchA', 'sLunchB', 'sEarliest', 'sDaily']) $(id).addEventListener('input', syncForm);
  function store(next, note) {
    if (!SITE.saveCompany(next)) return smsg('설정을 저장하지 못했어요.', true);
    loadCompany();
    page = null; // 바로 다시 읽는다
    renderSettings();
    smsg(note);
  }
  $('sSave').onclick = () => {
    try {
      const next = COMPANY.normalizeCompany({ ...(company || {}), name: $('sName').value, rules: formRules(), host: SITE.host });
      store(next, '저장했어요. 바로 계산에 반영돼요.');
    } catch (e) {
      // 아직 읽을 곳을 안 가르친 사이트: 규칙만 먼저 저장해 둔다.
      if (needsTeach()) {
        SITE.saveCompany({ name: $('sName').value || '우리 회사', rules: formRules(), host: SITE.host, pendingTeach: true });
        loadCompany();
        smsg('규칙을 저장했어요. 이제 "읽을 곳 가르치기"를 해 주세요.');
      } else smsg(e.message, true);
    }
  };
  $('sReset').onclick = () => {
    SITE.clearCompany();
    loadCompany();
    page = null;
    renderSettings();
    smsg('하이웍스 기본 규칙으로 되돌렸어요.');
  };
  $('sTeach').onclick = () => {
    showCard('set', false);
    const rules = formRules();
    READER.teach({
      mode: rules.mode,
      done: ({ fields, includesToday }) => {
        showCard('set', true);
        try {
          const next = COMPANY.normalizeCompany({ name: $('sName').value || (company && company.name) || '우리 회사', rules, fields, includesToday, host: SITE.host });
          store(next, '읽을 곳을 기억했어요. 패널에 계산이 나오는지 확인해 주세요.');
        } catch (e) {
          smsg(e.message, true);
        }
      },
      cancel: () => {
        showCard('set', true);
      },
    });
  };
  $('sCopy').onclick = async () => {
    try {
      const code = await COMPANY.encodeCompany({ ...(company || {}), name: $('sName').value || '우리 회사', rules: formRules(), host: SITE.host });
      try {
        await navigator.clipboard.writeText(code);
        smsg('회사 설정 코드를 복사했어요. 같은 근무 페이지를 쓰는 동료에게 보내 주세요.');
      } catch {
        window.prompt('이 코드를 복사해 동료에게 보내 주세요.', code);
      }
    } catch (e) {
      smsg(e.message, true);
    }
  };
  $('sPasteBtn').onclick = () => {
    $('sPaste').hidden = !$('sPaste').hidden;
    if (!$('sPaste').hidden) $('sCode').focus();
  };
  $('sCodeOk').onclick = async () => {
    try {
      const next = await COMPANY.decodeCompany($('sCode').value);
      // 하이웍스는 화면을 이미 알아서 규칙만 쓴다.
      if (SITE.builtin) delete next.fields;
      const other = next.host && next.host !== SITE.host ? ` (코드는 ${next.host}용이에요. 화면이 다르면 읽을 곳을 다시 가르쳐 주세요.)` : '';
      store({ ...next, host: SITE.host }, `"${next.name}" 설정을 넣었어요.${other}`);
      $('sCode').value = '';
      $('sPaste').hidden = true;
    } catch (e) {
      smsg(e.message, true);
    }
  };
  onOpen.set = () => {
    smsg('');
    renderSettings();
  };
  // 이 사이트의 화면을 읽는다: 하이웍스는 정해진 규칙으로, 다른 사이트는 가르친 자리에서.
  const readNow = () => (company && company.fields ? READER.readPage(company) : parsePage(document.body ? document.body.innerText : ''));

  const COLOR = { wait: '#8fa3c9', done: '#7fa650', warn: '#d9822b' };

  function view({ title, main, note, rows = [], accent = COLOR.wait, pill, hint }) {
    $('hint').textContent = hint || '';
    $('hint').hidden = !hint;
    $('title').textContent = title;
    $('main').textContent = main || '';
    $('main').hidden = !main;
    $('note').textContent = note || '';
    $('panel').style.setProperty('--accent', accent);
    $('rows').replaceChildren(
      ...rows.map(([label, value]) => {
        const row = document.createElement('div');
        row.className = 'row';
        const l = document.createElement('span');
        l.textContent = label;
        const v = document.createElement('span');
        v.textContent = value;
        row.append(l, v);
        return row;
      })
    );
    $('pill').textContent = pill || title;
  }

  // 월~목: 금요일 예상 퇴근 줄과 그 가정
  const hhmm = (sec) => secToTime(sec).slice(0, 5);
  function withFriday(r, rows) {
    if (!r.friday) return { rows };
    const f = r.friday;
    return {
      rows: [...rows, ['금요일 예상 퇴근', hhmm(f.leaveAt)]],
      hint: f.need
        ? `목요일까지 하루 ${Math.round(f.daily / 3600)}시간 · 금요일 ${hhmm(f.start)} 출근 기준 (금요일 ${formatDuration(f.need)} 근무)`
        : `목요일까지 하루 ${Math.round(f.daily / 3600)}시간이면 ${RULES.hours}시간을 다 채워요`,
    };
  }

  // 월 단위: 남은 시간을 남은 평일에 나눠 오늘 권장 퇴근 시각
  function renderMonth(r) {
    const m = r.month;
    const rows = [
      ['이번 달 누적', formatDuration(r.total)],
      ['남은 시간', formatDuration(Math.max(0, r.remaining))],
      ['남은 평일', `${m.daysLeft}일`],
      ['하루 평균 필요', formatDuration(m.share)],
    ];
    const hint = `월 목표 ${Math.round(r.target / 360) / 10}시간 · 공휴일은 빼지 않고 평일로 셉니다`;
    const goal = Math.round(r.target / 360) / 10;
    if (r.remaining <= 0) return view({ title: '이번 달 근무', note: `월 ${goal}시간 달성`, rows, accent: COLOR.done, pill: '이번 달 달성' });
    if (r.state === 'clocked-out') return view({ title: '오늘 퇴근 완료', note: `월 ${goal}시간까지 ${formatDuration(r.remaining)}`, rows, hint });
    if (r.state === 'not-started') return view({ title: '아직 출근 전', note: `오늘 ${formatDuration(m.share)} 일하면 돼요`, rows, hint });
    const canLeave = r.nowSec >= r.leaveAt;
    view({
      title: '오늘 권장 퇴근 시각',
      main: secToTime(r.leaveAt),
      note: canLeave ? '오늘 몫을 채웠어요' : `${formatDuration(r.leaveAt - r.nowSec)} 후`,
      rows,
      hint,
      accent: canLeave ? COLOR.done : COLOR.wait,
      pill: canLeave ? '오늘 몫 달성' : `퇴근 ${secToTime(r.leaveAt)}`,
    });
  }
  // 하루 단위: 출근 + 하루 시간
  function renderDay(r) {
    const rows = [
      ['오늘 근무', formatDuration(r.total)],
      ['남은 시간', formatDuration(Math.max(0, r.remaining))],
    ];
    if (r.state === 'clocked-out') return view({ title: '오늘 퇴근 완료', note: r.remaining <= 0 ? `하루 ${RULES.hours}시간 채움` : `${formatDuration(r.remaining)} 덜 채움`, rows, accent: r.remaining <= 0 ? COLOR.done : COLOR.warn });
    if (r.state === 'not-started') return view({ title: '지금 출근하면 퇴근', main: secToTime(r.leaveAt), note: `하루 ${RULES.hours}시간 기준`, rows });
    const canLeave = r.nowSec >= r.leaveAt;
    view({
      title: '오늘 퇴근 가능 시각',
      main: secToTime(r.leaveAt),
      note: canLeave ? '지금 퇴근 가능' : `${formatDuration(r.leaveAt - r.nowSec)} 후`,
      rows,
      accent: canLeave ? COLOR.done : COLOR.wait,
      pill: canLeave ? '지금 퇴근 가능' : `퇴근 ${secToTime(r.leaveAt)}`,
    });
  }

  function render(r) {
    if (r.state === 'unreadable') {
      host.hidden = SITE.builtin && location.pathname.indexOf('/personal') === -1;
      view({
        title: '두들링',
        note: '화면에서 읽지 못함',
        rows: [['누락', r.missing.join(', ')]],
        accent: COLOR.warn,
        hint: SITE.builtin ? '' : '화면이 바뀌었으면 오른쪽 아래 "설정" → 읽을 곳 가르치기를 다시 해 주세요',
      });
      return;
    }
    host.hidden = false;
    if (r.mode === 'month') return renderMonth(r);
    if (r.mode === 'day') return renderDay(r);
    if (r.state === 'other-week') {
      view({ title: '두들링', note: '이번 주 화면에서만 계산해요' });
      return;
    }

    const rows = [
      ['누적', formatDuration(r.total)],
      ['남은 시간', formatDuration(Math.max(0, r.remaining))],
    ];

    if (r.state === 'clocked-out') {
      const ok = r.remaining <= 0;
      view({
        title: '오늘 퇴근 완료',
        note: ok ? `이번 주 ${RULES.hours}시간 달성` : `${RULES.hours}시간까지 ${formatDuration(r.remaining)} 부족`,
        ...(ok ? { rows } : withFriday(r, rows)),
        accent: ok ? COLOR.done : COLOR.warn,
      });
      return;
    }

    if (r.state === 'not-started') {
      view({
        title: r.isFriday ? '지금 출근하면 퇴근 가능' : '아직 출근 전',
        main: r.isFriday ? secToTime(r.leaveAt) : '',
        ...withFriday(r, rows),
      });
      return;
    }

    if (!r.isFriday) {
      view({ title: '이번 주 근무 현황', main: formatDuration(r.remaining), note: `${RULES.hours}시간까지 남음`, ...withFriday(r, rows), pill: `${formatDuration(r.remaining)} 남음` });
      return;
    }

    const canLeave = r.nowSec >= r.leaveAt;
    const left = r.leaveAt - r.nowSec;
    const note = canLeave
      ? '지금 퇴근 가능'
      : `${formatDuration(left)} 후 · ${r.earlyLeave ? `${secToTime(RULES.fridayEarliestLeave).slice(0, 5)} 조기 퇴근` : `${RULES.hours}시간 채운 뒤 퇴근`}`;
    view({
      title: '금요일 퇴근 가능 시각',
      main: secToTime(r.leaveAt),
      note,
      rows,
      accent: canLeave ? COLOR.done : COLOR.wait,
      pill: canLeave ? '지금 퇴근 가능' : `퇴근 ${secToTime(r.leaveAt)}`,
    });
  }

  let page = null;
  let lastRead = 0;
  function tick() {
    const nowMs = Date.now();
    if (needsTeach()) {
      // 처음 켠 사이트: 읽을 곳을 먼저 가르쳐야 한다.
      host.hidden = false;
      globalThis.HW40.latest = null;
      view({ title: '두들링', note: '이 사이트에서 읽을 곳을 알려 주세요', hint: '오른쪽 아래 "설정" → 근무 방식을 고르고 "읽을 곳 가르치기"', accent: COLOR.warn });
      return;
    }
    if (!page || nowMs - lastRead >= READ_EVERY_MS) {
      page = readNow();
      lastRead = nowMs;
    }
    const result = evaluate(page, new Date(nowMs));
    globalThis.HW40.latest = result; // mascot.js가 읽는다
    render(result);
  }
  // 캐릭터 엔진까지 읽힌 뒤에 연다 (모이기의 아바타 목록 등이 엔진을 쓴다).
  setTimeout(() => {
    for (const name of savedOpen) if (name !== 'work' && !isOpen(name)) toggleCard(name);
  }, 0);
  tick();
  setInterval(tick, 1000);
})();

// ---- builtin-characters.js ----
// 기본으로 들어 있는 오리지널 캐릭터들. 외부 이미지 없이 SVG와 CSS 애니메이션으로 그린다.
// mascot.js가 화면에 띄우고, scripts/export-samples.js가 캐릭터 팩 샘플로 뽑아낸다.
(function (root) {
  const ART_CSS = `
    .leg { transform-box: fill-box; transform-origin: top center; }
    .walk .leg-a { animation: step .5s ease-in-out infinite; }
    .walk .leg-b { animation: step .5s ease-in-out infinite reverse; }
    .walk #body { animation: bob .25s ease-in-out infinite alternate; }
    .fast .leg-a, .fast .leg-b, .skit-zoom .leg-a, .skit-zoom .leg-b { animation-duration: .2s; }
    .fast #body, .skit-zoom #body { animation-duration: .1s; }
    .idle #body { animation: breathe 1.6s ease-in-out infinite alternate; }
    .prop, #confetti, #eyes-closed { display: none; }
    #body { transform-box: fill-box; transform-origin: bottom center; }
    .skit-weed #weed { display: inline; animation: weed-pop 3.2s linear forwards; }
    .skit-weed #body { animation: tug 3.2s ease-in-out forwards; }
    .skit-tear #tears { display: inline; }
    .skit-tear #tears path { animation: tear-drop .9s ease-in infinite; }
    .skit-tear #tears path + path { animation-delay: .45s; }
    .skit-tear #body { animation: tremble .12s linear infinite alternate; }
    .skit-eat #food, .skit-carrot #food { display: inline; transform-box: fill-box; transform-origin: center;
      animation: munch 3s steps(4) forwards; }
    .skit-eat #body, .skit-carrot #body { animation: bob .22s ease-in-out infinite alternate; }
    .skit-coffee #mug { display: inline; transform-box: fill-box; transform-origin: left bottom;
      animation: sip 3.4s ease-in-out forwards; }
    .skit-nap #eyes-open { display: none; }
    .skit-nap #eyes-closed { display: inline; }
    .skit-nap #body { animation: breathe 1.8s ease-in-out infinite alternate; }
    .skit-roar #body { animation: tremble .08s linear infinite alternate; }
    .party #cert, .party #confetti { display: inline; }
    .party #confetti rect { animation: confetti 1.3s linear infinite; }
    .party #confetti rect:nth-child(2) { animation-delay: .35s; }
    .party #confetti rect:nth-child(3) { animation-delay: .7s; }
    .party #confetti rect:nth-child(4) { animation-delay: 1s; }
    @keyframes step { from { transform: rotate(-24deg); } to { transform: rotate(24deg); } }
    @keyframes bob { from { transform: translateY(0); } to { transform: translateY(-2px); } }
    @keyframes breathe { from { transform: translateY(0); } to { transform: translateY(1px); } }
    @keyframes hop { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-26px); } }
    @keyframes tug { 0%, 100% { transform: rotate(0); } 15%, 45% { transform: rotate(9deg); }
      30%, 60% { transform: rotate(4deg); } 72% { transform: rotate(13deg); } 80% { transform: rotate(-9deg); } }
    @keyframes weed-pop { 0%, 72% { transform: translateY(0); opacity: 1; }
      90% { transform: translateY(-16px); opacity: 1; } 100% { transform: translateY(-20px); opacity: 0; } }
    @keyframes tear-drop { 0%, 65% { opacity: 1; } 0% { transform: translateY(0); }
      100% { transform: translateY(11px); opacity: 0; } }
    @keyframes tremble { from { transform: translateX(-.7px); } to { transform: translateX(.7px); } }
    @keyframes munch { from { transform: scale(1); } to { transform: scale(0); } }
    @keyframes sip { 0%, 100% { transform: rotate(0); } 25%, 45% { transform: rotate(-32deg); }
      60%, 80% { transform: rotate(-32deg) translateY(-1px); } }
    @keyframes confetti { from { transform: translateY(0) rotate(0); opacity: 1; }
      to { transform: translateY(58px) rotate(200deg); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
  `;

  const CONFETTI = `
    <g id="confetti">
      <rect x="4" y="-8" width="4" height="4" fill="#f2a58e"/>
      <rect x="20" y="-14" width="4" height="4" fill="#8cc152"/>
      <rect x="40" y="-10" width="4" height="4" fill="#8fd0f2"/>
      <rect x="56" y="-16" width="4" height="4" fill="#f4c542"/>
    </g>`;

  const legs = (fill) => `
    <g fill="${fill}" stroke="#6b4a2b" stroke-width="2">
      <rect class="leg leg-a" x="21" y="49" width="8" height="12" rx="4"/>
      <rect class="leg leg-b" x="35" y="49" width="8" height="12" rx="4"/>
    </g>`;

  // 머리에 새싹이 난 떡. 겁이 많고 잘 운다.
  const KONG = {
    id: 'kong',
    label: '콩떡이',
    speed: 28,
    pauseChance: 0.5,
    partyLine: '40시간 합격! 퇴근!',
    restLine: 'Zz',
    skits: {
      weed: { ms: 3200, text: '뽑았다!', sayAt: 2400 },
      tear: { ms: 2600, text: '흐엉…', sayAt: 200 },
      eat: { ms: 3000, text: '냠냠', sayAt: 200 },
    },
    art: `
      ${legs('#e9c48f')}
      <g id="body">
        <path d="M32 15 C32 11 33 9 34 7" fill="none" stroke="#5c8a3a" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M34 8 C38 2 45 3 47 5 C45 10 38 11 34 8 Z" fill="#8cc152" stroke="#5c8a3a" stroke-width="1.5"/>
        <path d="M33 9 C29 4 23 5 21 7 C23 11 29 12 33 9 Z" fill="#a5d36a" stroke="#5c8a3a" stroke-width="1.5"/>
        <ellipse cx="32" cy="33" rx="23" ry="20" fill="#f6dfb4" stroke="#6b4a2b" stroke-width="2"/>
        <ellipse cx="25" cy="24" rx="7" ry="3.5" fill="#fff" opacity=".6"/>
        <ellipse cx="28" cy="32" rx="2.4" ry="3" fill="#3d2a17"/>
        <ellipse cx="44" cy="32" rx="2.4" ry="3" fill="#3d2a17"/>
        <ellipse cx="22" cy="39" rx="4" ry="2.4" fill="#f2a58e" opacity=".75"/>
        <ellipse cx="49" cy="39" rx="3.4" ry="2.4" fill="#f2a58e" opacity=".75"/>
        <path d="M33 37 Q36 41 39 37" fill="none" stroke="#3d2a17" stroke-width="1.8" stroke-linecap="round"/>
        <g id="tears" class="prop" fill="#4fb0e8" stroke="#2b86bd" stroke-width=".6">
          <path d="M28 35 C24.5 40 24.5 43 28 43 C31.5 43 31.5 40 28 35 Z"/>
          <path d="M44 35 C40.5 40 40.5 43 44 43 C47.5 43 47.5 40 44 35 Z"/>
        </g>
      </g>
      <g id="weed" class="prop" fill="none" stroke="#5c8a3a" stroke-width="2.5" stroke-linecap="round">
        <path d="M62 62 L62 48"/>
        <path d="M62 62 C62 56 60 53 56 51"/>
        <path d="M62 62 C62 56 64 53 69 51"/>
      </g>
      <g id="food" class="prop">
        <path d="M46 34 C48 34 58 47 56 49 C54 51 38 51 36 49 C34 47 44 34 46 34 Z" fill="#fff" stroke="#6b4a2b" stroke-width="1.5"/>
        <rect x="41" y="44" width="10" height="6" rx="1" fill="#2f3b2c"/>
      </g>
      <g id="cert" class="prop">
        <rect x="50" y="10" width="20" height="25" rx="1.5" fill="#fff" stroke="#6b4a2b" stroke-width="1.5" transform="rotate(8 60 22)"/>
        <path d="M54 16 L65 18 M53.5 20 L64.5 22" stroke="#9a8a76" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="60" cy="28" r="4" fill="none" stroke="#d9483b" stroke-width="2"/>
      </g>`,
  };

  // 한쪽 귀가 접힌 연보라 토끼. 이마에 반창고를 붙인 말썽꾸러기.
  const PPYONG = {
    id: 'ppyong',
    label: '뿅이',
    speed: 58,
    pauseChance: 0.3,
    partyLine: '야호!',
    restLine: 'Zz',
    skits: {
      zoom: { ms: 2200, text: '뿅!', sayAt: 100, moving: true },
      carrot: { ms: 3000, text: '아삭아삭', sayAt: 200 },
    },
    art: `
      ${legs('#c6b6e6')}
      <g id="body">
        <ellipse cx="23" cy="14" rx="5.5" ry="13" fill="#dcd0f2" stroke="#6b4a2b" stroke-width="2"/>
        <ellipse cx="23" cy="15" rx="2.4" ry="8.5" fill="#f4c3d3"/>
        <path d="M38 23 C37 12 40 6 46 5 C52 4 57 8 58 13 C54 11 49 12 46 17 C45 20 45 22 45 24 Z" fill="#dcd0f2" stroke="#6b4a2b" stroke-width="2" stroke-linejoin="round"/>
        <ellipse cx="32" cy="37" rx="21" ry="17" fill="#e6dcf7" stroke="#6b4a2b" stroke-width="2"/>
        <g transform="rotate(-18 24 27)">
          <rect x="18" y="24.5" width="12" height="5" rx="2" fill="#f2d3a8" stroke="#a9825a" stroke-width="1"/>
          <path d="M23 25.5 V28.5 M25 25.5 V28.5" stroke="#a9825a" stroke-width=".8"/>
        </g>
        <circle cx="29" cy="36" r="2.6" fill="#3d2a17"/>
        <circle cx="44" cy="36" r="2.6" fill="#3d2a17"/>
        <circle cx="30" cy="35" r=".9" fill="#fff"/>
        <circle cx="45" cy="35" r=".9" fill="#fff"/>
        <path d="M33 41 Q37 46 41 41 Z" fill="#b5475f" stroke="#3d2a17" stroke-width="1.3" stroke-linejoin="round"/>
        <rect x="35.6" y="41" width="2.8" height="2.4" fill="#fff"/>
        <ellipse cx="23" cy="42" rx="3.4" ry="2.1" fill="#f2a5c0" opacity=".8"/>
        <ellipse cx="49" cy="42" rx="3" ry="2.1" fill="#f2a5c0" opacity=".8"/>
      </g>
      <g id="food" class="prop">
        <path d="M43 44 L57 40 C59 44 57 48 54 49 Z" fill="#f09a3e" stroke="#6b4a2b" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M57 41 L62 37 M58 43 L63 42" stroke="#5c8a3a" stroke-width="2" stroke-linecap="round"/>
      </g>`,
  };

  // 동그란 안경을 쓴 치즈 고양이. 늘 침착하고 느릿느릿 걷는다.
  const HODU = {
    id: 'hodu',
    label: '호두',
    speed: 15,
    pauseChance: 0.7,
    partyLine: '수고했어',
    restLine: '수고했어',
    skits: {
      coffee: { ms: 3400, text: '후루룩', sayAt: 900 },
      nap: { ms: 3600, text: 'Zz', sayAt: 300 },
    },
    art: `
      <path d="M12 46 C3 44 2 34 7 29" fill="none" stroke="#6b4a2b" stroke-width="7" stroke-linecap="round"/>
      <path d="M12 46 C3 44 2 34 7 29" fill="none" stroke="#f2ae63" stroke-width="4" stroke-linecap="round"/>
      ${legs('#e89c4e')}
      <g id="body">
        <path d="M13 26 L15 8 L29 17 Z" fill="#f2ae63" stroke="#6b4a2b" stroke-width="2" stroke-linejoin="round"/>
        <path d="M51 26 L49 8 L35 17 Z" fill="#f2ae63" stroke="#6b4a2b" stroke-width="2" stroke-linejoin="round"/>
        <ellipse cx="32" cy="35" rx="24" ry="19" fill="#f6bd7c" stroke="#6b4a2b" stroke-width="2"/>
        <path d="M26 17 L27 23 M32 16 L32 23 M38 17 L37 23" stroke="#cf7a2c" stroke-width="2.4" stroke-linecap="round"/>
        <g id="eyes-open">
          <circle cx="28" cy="34" r="2.1" fill="#3d2a17"/>
          <circle cx="44" cy="34" r="2.1" fill="#3d2a17"/>
        </g>
        <g id="eyes-closed" fill="none" stroke="#3d2a17" stroke-width="1.8" stroke-linecap="round">
          <path d="M24.5 34.5 Q28 37 31.5 34.5"/>
          <path d="M40.5 34.5 Q44 37 47.5 34.5"/>
        </g>
        <g fill="none" stroke="#4a3520" stroke-width="1.7">
          <circle cx="28" cy="34" r="6.2"/>
          <circle cx="44" cy="34" r="6.2"/>
          <path d="M34.2 33.5 H37.8"/>
        </g>
        <path d="M34 42 L38 42 L36 44.5 Z" fill="#d9707a"/>
        <path d="M18 42 L9 40 M18 45 L9 46 M54 42 L60 40 M54 45 L60 46" stroke="#6b4a2b" stroke-width="1.1" stroke-linecap="round"/>
      </g>
      <g id="mug" class="prop">
        <rect x="46" y="42" width="11" height="11" rx="2" fill="#fff" stroke="#6b4a2b" stroke-width="1.6"/>
        <path d="M57 45 C61 45 61 51 57 51" fill="none" stroke="#6b4a2b" stroke-width="1.6"/>
        <rect x="47.5" y="44" width="8" height="2.4" fill="#8a5a33"/>
      </g>`,
  };

  // 양쪽 귀가 축 늘어진 크림색 토끼. 통통하고 느긋하며 간식을 좋아한다.
  const MONG = {
    id: 'mong',
    label: '몽실이',
    speed: 22,
    pauseChance: 0.6,
    partyLine: '오예~ 퇴근!',
    restLine: 'Zz',
    skits: {
      eat: { ms: 3000, text: '쿠키 냠', sayAt: 200 },
      nap: { ms: 3600, text: '꾸벅…', sayAt: 300 },
    },
    art: `
      ${legs('#f3e3b8')}
      <g id="body">
        <path d="M22 17 C14 12 6 16 4 26 C2 36 4 46 8 47 C12 48 13 40 14 32 C15 26 18 22 24 21 Z" fill="#fbf0cf" stroke="#4a3520" stroke-width="2" stroke-linejoin="round"/>
        <path d="M16 19 C10 21 7.5 30 8 42" fill="none" stroke="#f4b9c4" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M42 17 C50 12 58 16 60 26 C62 36 60 46 56 47 C52 48 51 40 50 32 C49 26 46 22 40 21 Z" fill="#fbf0cf" stroke="#4a3520" stroke-width="2" stroke-linejoin="round"/>
        <path d="M48 19 C54 21 56.5 30 56 42" fill="none" stroke="#f4b9c4" stroke-width="2.6" stroke-linecap="round"/>
        <ellipse cx="32" cy="34" rx="22" ry="20" fill="#fdf3d6" stroke="#4a3520" stroke-width="2"/>
        <ellipse cx="24" cy="23" rx="5" ry="2.6" fill="#fff" opacity=".7"/>
        <ellipse cx="14" cy="45" rx="3" ry="4" fill="#fdf3d6" stroke="#4a3520" stroke-width="1.8"/>
        <ellipse cx="50" cy="45" rx="3" ry="4" fill="#fdf3d6" stroke="#4a3520" stroke-width="1.8"/>
        <g id="eyes-open">
          <circle cx="25" cy="33" r="3" fill="#3d2a17"/>
          <circle cx="39" cy="33" r="3" fill="#3d2a17"/>
          <circle cx="26" cy="32" r="1.1" fill="#fff"/>
          <circle cx="40" cy="32" r="1.1" fill="#fff"/>
        </g>
        <g id="eyes-closed" fill="none" stroke="#3d2a17" stroke-width="1.8" stroke-linecap="round">
          <path d="M22 33.5 Q25 31 28 33.5"/>
          <path d="M36 33.5 Q39 31 42 33.5"/>
        </g>
        <circle cx="19" cy="39" r="3.2" fill="#f7a8b4" opacity=".85"/>
        <circle cx="45" cy="39" r="3.2" fill="#f7a8b4" opacity=".85"/>
        <ellipse cx="32" cy="37" rx="1.8" ry="1.3" fill="#e9839a"/>
        <path d="M32 38.3 V40 M29.5 41 Q32 43 34.5 41" fill="none" stroke="#3d2a17" stroke-width="1.4" stroke-linecap="round"/>
      </g>
      <g id="food" class="prop">
        <circle cx="50" cy="45" r="6" fill="#d9a060" stroke="#6b4a2b" stroke-width="1.5"/>
        <circle cx="48" cy="43" r="1.1" fill="#5a3a1e"/>
        <circle cx="52" cy="46" r="1.1" fill="#5a3a1e"/>
        <circle cx="49" cy="48" r="1" fill="#5a3a1e"/>
      </g>`,
  };

  // 뿔 하나 달린 보라색 털뭉치 괴물. 가끔 친구들을 쫓아다니며 놀래킨다.
  const BORA = {
    id: 'bora',
    label: '보라괴물',
    speed: 34,
    pauseChance: 0.5,
    chaser: true,
    partyLine: '축하한다 크앙!',
    restLine: 'Zz',
    skits: {
      roar: { ms: 2000, text: '크아앙!', sayAt: 200 },
      nap: { ms: 3600, text: 'Zz', sayAt: 300 },
    },
    art: `
      ${legs('#7a5bb8')}
      <g id="body">
        <path d="M30 13 L33 2 L37 13 Z" fill="#f3e6c4" stroke="#3a2456" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M11 30 C10 18 20 12 32 12 C44 12 54 18 53 30 L56 34 L53 37 L55 42 L51 45 C48 52 40 54 32 54 C24 54 16 52 13 45 L9 42 L11 37 L8 34 Z" fill="#9b7fd4" stroke="#3a2456" stroke-width="2" stroke-linejoin="round"/>
        <path d="M22 14 L24 9 L27 13 M40 13 L43 9 L44 14" fill="#9b7fd4" stroke="#3a2456" stroke-width="1.6" stroke-linejoin="round"/>
        <ellipse cx="24" cy="21" rx="5" ry="2.5" fill="#fff" opacity=".35"/>
        <g id="eyes-open">
          <circle cx="25" cy="31" r="4.6" fill="#fff" stroke="#3a2456" stroke-width="1.4"/>
          <circle cx="41" cy="31" r="4.6" fill="#fff" stroke="#3a2456" stroke-width="1.4"/>
          <circle cx="26" cy="31.5" r="2.2" fill="#2a1a3d"/>
          <circle cx="42" cy="31.5" r="2.2" fill="#2a1a3d"/>
        </g>
        <g id="eyes-closed" fill="none" stroke="#2a1a3d" stroke-width="1.8" stroke-linecap="round">
          <path d="M21 32 Q25 35 29 32"/>
          <path d="M37 32 Q41 35 45 32"/>
        </g>
        <path d="M24 40 Q33 46 42 40" fill="#5a2d4f" stroke="#2a1a3d" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M27 41 L28.5 44 L30 42 M36 42 L37.5 44 L39 41" fill="#fff" stroke="#2a1a3d" stroke-width=".8" stroke-linejoin="round"/>
        <path d="M11 38 L4 32 M53 38 L60 32" stroke="#3a2456" stroke-width="5" stroke-linecap="round"/>
        <path d="M11 38 L4 32 M53 38 L60 32" stroke="#9b7fd4" stroke-width="2.6" stroke-linecap="round"/>
      </g>`,
  };

  // 왼쪽부터의 축하 자리 순서. 말풍선이 긴 콩떡이가 오른쪽을 쓴다.
  // 왼쪽부터의 축하 자리 순서. 말풍선이 긴 콩떡이가 오른쪽을 쓴다.
  const CHARACTERS = [BORA, PPYONG, HODU, MONG, KONG];

  // 둘이 마주쳤을 때 대사 (id 알파벳순 키)
  const MEET_LINES = {
    'kong+ppyong': { ppyong: '비켜비켜!', kong: '히익!' },
    'hodu+ppyong': { ppyong: '같이 놀자!', hodu: '바빠.' },
    'hodu+kong': { kong: '안녕…', hodu: '오냐.' },
    'kong+mong': { mong: '같이 간식 먹을래?', kong: '응!' },
    'hodu+mong': { mong: '선배 쿠키 드실래요?', hodu: '하나만.' },
    'mong+ppyong': { ppyong: '느림보다!', mong: '천천히 가도 돼~' },
  };

  const builtins = { characters: CHARACTERS, meetLines: MEET_LINES, artCss: ART_CSS, confetti: CONFETTI };
  if (typeof module !== 'undefined' && module.exports) module.exports = builtins;
  else root.HW40_BUILTINS = builtins;
})(typeof globalThis !== 'undefined' ? globalThis : this);

// ---- sprite.js ----
// 캐릭터 팩 애니메이션 재생기. 엔진이 보낸 트리거(상태)에 맞는 프레임을 보여준다.
// 하이웍스 화면(mascot.js)과 작업 화면(studio.html)이 같이 쓴다.
(function (root) {
  // 트리거마다 팩에 그 애니메이션이 없을 때 대신 재생할 순서
  const FALLBACKS = {
    idle: ['idle'],
    walk: ['walk', 'idle'],
    hurry: ['hurry', 'walk', 'idle'],
    flee: ['flee', 'hurry', 'walk', 'idle'],
    chase: ['chase', 'hurry', 'walk', 'idle'],
    celebrate: ['celebrate', 'hop', 'idle'],
    rest: ['rest', 'idle'],
    hop: ['hop', 'idle'],
    click: ['click', 'hop', 'idle'],
    meet: ['meet', 'idle'],
    // 마우스로 잡아 들었을 때 → 놓아서 떨어질 때 → 바닥에 닿았을 때
    drag: ['drag', 'hop', 'idle'],
    fall: ['fall', 'flee', 'hurry', 'walk', 'idle'],
    land: ['land', 'hop', 'idle'],
  };

  // 팩 애니메이션 재생기. 상태(트리거)를 받아 맞는 프레임을 보여준다.
  function createSpriteRenderer(pack, el) {
    let current = null;
    let startedAt = 0;
    let frameShown = -1;

    const pick = (state, dir) => {
      for (const name of FALLBACKS[state] || [state, 'idle']) {
        // 왼쪽을 볼 때 쓸 그림이 따로 있으면 (예: walk_left) 그걸 쓴다.
        if (dir < 0 && pack.animations[`${name}_left`]) return { name: `${name}_left`, mirrored: false };
        if (pack.animations[name]) return { name, mirrored: true };
      }
      return { name: 'idle', mirrored: true };
    };

    return (state, now, dir) => {
      const { name, mirrored } = pick(state, dir);
      const anim = pack.animations[name];
      if (name !== current) {
        current = name;
        startedAt = now;
        frameShown = -1;
        for (const c of [...el.classList]) if (c.startsWith('motion-')) el.classList.remove(c);
        if (anim.motion && anim.motion !== 'none') el.classList.add(`motion-${anim.motion}`);
        if (anim.sheet) {
          el.style.backgroundImage = `url("${anim.sheet}")`;
          el.style.backgroundSize = `${anim.count * 100}% 100%`;
        } else {
          el.style.backgroundSize = 'contain';
          el.style.backgroundPosition = 'center bottom';
        }
      }
      const count = anim.sheet ? anim.count : anim.frames.length;
      const step = Math.floor(((now - startedAt) / 1000) * anim.fps);
      const i = anim.loop ? step % count : Math.min(step, count - 1);
      if (i !== frameShown) {
        frameShown = i;
        if (anim.sheet) el.style.backgroundPosition = count > 1 ? `${(i / (count - 1)) * 100}% 0` : '0 0';
        else el.style.backgroundImage = `url("${anim.frames[i]}")`;
      }
      // 화면에 그릴 좌우 방향: 정면 그림은 뒤집지 않고, 왼쪽을 보는 그림은 반대로 뒤집는다.
      if (!mirrored || pack.facing === 'front') return 1;
      return pack.facing === 'left' ? -dir : dir;
    };
  }

  const sprite = { FALLBACKS, createSpriteRenderer };
  if (typeof module !== 'undefined' && module.exports) module.exports = sprite;
  else root.HW40_SPRITE = sprite;
})(typeof globalThis !== 'undefined' ? globalThis : this);

// ---- pack-rules ----
// 캐릭터 팩(characters/<id>/character.json + 이미지)을 읽어 엔진이 쓰는 데이터로 만든다.
// 규격은 characters/README.md 참고. 이미지는 data URL로 바꿔 스크립트 안에 묶는다.
// 빌드(Node)와 작업 화면 studio.html(브라우저)이 같은 규칙으로 검사하도록 둘 다에서 돌아간다.
(function (root) {
  const MIME = {
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
  };
  const MOTIONS = ['none', 'bob', 'breathe', 'shake', 'wobble'];
  const FACINGS = ['right', 'left', 'front'];
  const TRIGGERS = ['idle', 'walk', 'hurry', 'flee', 'chase', 'celebrate', 'rest', 'hop', 'click', 'meet', 'drag', 'fall', 'land'];
  const ONE_SHOT = ['hop', 'click', 'land'];
  const ID_RE = /^[a-z][a-z0-9-]*$/;
  const NAME_RE = /^[a-z][a-z0-9_-]*$/;
  const WARN_BYTES = 3 * 1024 * 1024;

  class PackError extends Error {}

  function fail(where, message) {
    throw new PackError(`[캐릭터 팩] ${where}: ${message}`);
  }

  const extOf = (file) => {
    const m = /\.[^./\\]+$/.exec(file);
    return m ? m[0].toLowerCase() : '';
  };

  // 이미지 파일 이름 검사. 실제 읽기는 resolveFile(이름, 위치)이 맡는다 (Node: 파일, 브라우저: 고른 폴더).
  function checkFile(file, where) {
    if (typeof file !== 'string' || !file) fail(where, '이미지 파일 이름이 비어 있어요.');
    if (/(^|[\\/])\.\.([\\/]|$)/.test(file) || /^[\\/]/.test(file)) fail(where, `"${file}"는 팩 폴더 밖을 가리켜요.`);
    if (!MIME[extOf(file)]) fail(where, `"${file}"는 지원하지 않는 형식이에요. (${Object.keys(MIME).join(', ')})`);
    return file;
  }

  const num = (value, fallback, where, name) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'number' || !(value > 0)) fail(where, `${name}은(는) 0보다 큰 숫자여야 해요.`);
    return value;
  };

  function readAnimation(name, spec, where, resolveFile) {
    if (!spec || typeof spec !== 'object') fail(where, '애니메이션 설정이 객체가 아니에요.');
    const hasFrames = spec.frames !== undefined;
    const hasSheet = spec.sheet !== undefined;
    if (hasFrames === hasSheet) fail(where, '"frames"와 "sheet" 중 하나만 써 주세요.');

    const anim = {
      fps: num(spec.fps, 8, where, 'fps'),
      loop: spec.loop === undefined ? !ONE_SHOT.includes(name) : Boolean(spec.loop),
      motion: spec.motion || 'none',
    };
    // 상호작용 그림(act_·duo_)에서: 그림에 몸 움직임까지 담겨 있으면 엔진은 자리만 옮기고 기울이거나 뒤집지 않는다.
    if (spec.still) anim.still = true;
    if (!MOTIONS.includes(anim.motion)) fail(where, `motion은 ${MOTIONS.join(', ')} 중 하나예요.`);

    if (hasFrames) {
      if (!Array.isArray(spec.frames) || !spec.frames.length) fail(where, '"frames"는 이미지 파일 이름 목록이에요.');
      anim.frames = spec.frames.map((f, i) => resolveFile(checkFile(f, `${where} frames[${i}]`), `${where} frames[${i}]`));
    } else {
      anim.sheet = resolveFile(checkFile(spec.sheet, `${where} sheet`), `${where} sheet`);
      anim.count = Math.round(num(spec.count, 1, where, 'count'));
    }

    if (spec.special) {
      if (TRIGGERS.includes(name)) fail(where, `"${name}"은 트리거 이름이라 special로 쓸 수 없어요.`);
      anim.special = {
        ms: num(spec.duration, 3000, where, 'duration'),
        text: typeof spec.say === 'string' ? spec.say : '',
        sayAt: spec.sayAt === undefined ? 200 : Math.max(0, Number(spec.sayAt) || 0),
        moving: Boolean(spec.moving),
      };
    }
    return anim;
  }

  // character.json 내용(spec)을 검사하고 엔진용 데이터로 바꾼다.
  function normalizePack(spec, folder, resolveFile) {
    const where = `${folder}/character.json`;
    if (!spec || typeof spec !== 'object') fail(where, '내용이 JSON 객체가 아니에요.');
    const id = spec.id === undefined ? folder.replace(/^_/, '') : spec.id;
    if (typeof id !== 'string' || !ID_RE.test(id)) fail(where, 'id는 영문 소문자로 시작하는 영문·숫자·하이픈이에요.');
    if (!spec.animations || typeof spec.animations !== 'object') fail(where, '"animations"가 없어요.');
    if (!spec.animations.idle) fail(where, '"idle" 애니메이션은 꼭 있어야 해요.');
    const facing = spec.facing || 'right';
    if (!FACINGS.includes(facing)) fail(where, `facing은 ${FACINGS.join(', ')} 중 하나예요.`);
    const lines = spec.lines || {};

    const animations = {};
    for (const [name, anim] of Object.entries(spec.animations)) {
      if (!NAME_RE.test(name)) fail(where, `애니메이션 이름 "${name}"은 영문 소문자로 써 주세요.`);
      animations[name] = readAnimation(name, anim, `${where} animations.${name}`, resolveFile);
    }

    return {
      id,
      label: typeof spec.label === 'string' ? spec.label : id,
      size: Math.round(num(spec.size, 64, where, 'size')),
      speed: num(spec.speed, 30, where, 'speed'),
      pauseChance: spec.pauseChance === undefined ? 0.5 : Math.min(1, Math.max(0, Number(spec.pauseChance) || 0)),
      chaser: Boolean(spec.chaser),
      bounce: spec.bounce !== false,
      facing,
      lines: {
        celebrate: lines.celebrate || '퇴근!',
        rest: lines.rest || 'Zz',
        meet: lines.meet && typeof lines.meet === 'object' ? lines.meet : {},
      },
      animations,
    };
  }

  // 아래는 Node(빌드)에서만 쓴다.
  function readPackDir(dir, folder) {
    const fs = require('node:fs');
    const path = require('node:path');
    let spec;
    try {
      spec = JSON.parse(fs.readFileSync(path.join(dir, 'character.json'), 'utf8'));
    } catch (e) {
      fail(`${folder}/character.json`, `JSON을 읽지 못했어요 (${e.message})`);
    }
    return normalizePack(spec, folder, (file, where) => {
      const full = path.resolve(dir, file);
      if (!full.startsWith(path.resolve(dir) + path.sep)) fail(where, `"${file}"는 팩 폴더 밖을 가리켜요.`);
      if (!fs.existsSync(full)) fail(where, `"${file}" 파일이 없어요.`);
      return `data:${MIME[extOf(file)]};base64,${fs.readFileSync(full).toString('base64')}`;
    });
  }

  // 밑줄(_)로 시작하는 폴더는 작업용이라 includeHidden일 때만 읽는다.
  function loadPacks(packsRoot, { includeHidden = false, warn = console.warn } = {}) {
    const fs = require('node:fs');
    const path = require('node:path');
    const result = { builtin: null, packs: [] };
    if (!fs.existsSync(packsRoot)) return result;

    const configFile = path.join(packsRoot, 'config.json');
    if (fs.existsSync(configFile)) {
      const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      if (config.builtin !== undefined) {
        if (!Array.isArray(config.builtin)) fail('config.json', '"builtin"은 기본 캐릭터 id 목록이에요.');
        result.builtin = config.builtin;
      }
    }

    const folders = fs
      .readdirSync(packsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory() && (includeHidden || !d.name.startsWith('_')))
      .map((d) => d.name)
      .sort();
    const seen = new Set();
    for (const folder of folders) {
      const dir = path.join(packsRoot, folder);
      if (!fs.existsSync(path.join(dir, 'character.json'))) continue;
      const pack = readPackDir(dir, folder);
      if (seen.has(pack.id)) fail(`${folder}/character.json`, `id "${pack.id}"가 다른 팩과 겹쳐요.`);
      seen.add(pack.id);
      const bytes = JSON.stringify(pack).length;
      if (bytes > WARN_BYTES) warn(`[캐릭터 팩] ${folder}: 이미지가 ${(bytes / 1024 / 1024).toFixed(1)}MB로 커서 스크립트가 무거워져요.`);
      result.packs.push(pack);
    }
    return result;
  }

  const packsScript = (data) => `globalThis.HW40_PACKS = ${JSON.stringify(data)};`;

  const api = { MIME, MOTIONS, FACINGS, TRIGGERS, PackError, normalizePack, loadPacks, packsScript };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HW40_PACK_RULES = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

// ---- themes.js ----
// 테마: 어떤 캐릭터를 몇 명, 어떤 이름·크기로 내보낼지 정한 묶음.
// 그림은 담지 않고 캐릭터 id만 가리키므로 공유 코드가 짧다. 그림은 기본 캐릭터나 캐릭터 팩에서 온다.
// 하이웍스 화면(mascot.js), 빌드(themes/ 폴더 검사), 테마 만들기 화면(themes.html)이 같이 쓴다.
(function (root) {
  const CODE_PREFIX = 'HW40T1.';
  const MAX_CAST = 10;
  const NAME_MAX = 20;
  const LABEL_MAX = 12;
  const SIZE_MIN = 32;
  const SIZE_MAX = 160;
  const UID_RE = /^[a-z0-9-]{1,40}$/;
  const BOND_MIN = -100;
  const BOND_MAX = 100;

  class ThemeError extends Error {}

  // 화면에 그대로 넣어도 안전한 짧은 글자로 만든다.
  const clean = (value, max) =>
    typeof value === 'string'
      ? value.replace(/[\u0000-\u001f\u007f<>&"`]/g, '').trim().slice(0, max)
      : '';

  // 테마를 규격에 맞게 고친다. knownIds가 있으면 없는 캐릭터는 빼고 warnings에 적는다.
  function normalizeTheme(raw, knownIds) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ThemeError('테마 형식이 아니에요.');
    if (!Array.isArray(raw.cast)) throw new ThemeError('"cast"(나올 캐릭터 목록)가 없어요.');
    const warnings = [];
    const cast = [];
    const uids = new Set();
    for (const entry of raw.cast) {
      const item = typeof entry === 'string' ? { id: entry } : entry;
      if (!item || typeof item.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(item.id)) {
        warnings.push('id가 없는 캐릭터를 뺐어요.');
        continue;
      }
      if (knownIds && !knownIds.has(item.id)) {
        warnings.push(`"${item.id}" 캐릭터가 이 버전에 없어서 뺐어요.`);
        continue;
      }
      const out = { id: item.id };
      const name = clean(item.name, LABEL_MAX);
      if (name) out.name = name;
      if (item.size !== undefined && item.size !== null && item.size !== '') {
        const size = Number(item.size);
        if (Number.isFinite(size)) out.size = Math.round(Math.min(SIZE_MAX, Math.max(SIZE_MIN, size)));
      }
      // uid: 테마 안에서 이 아이를 알아보는 표식 (우호도가 이 아이에게 붙는다). 겹치면 뒤의 것은 버린다.
      if (typeof item.uid === 'string' && UID_RE.test(item.uid) && !uids.has(item.uid)) {
        uids.add(item.uid);
        out.uid = item.uid;
      }
      cast.push(out);
    }
    if (cast.length > MAX_CAST) {
      warnings.push(`캐릭터는 ${MAX_CAST}명까지라 뒤쪽 ${cast.length - MAX_CAST}명을 뺐어요.`);
      cast.length = MAX_CAST;
    }
    if (!cast.length) throw new ThemeError('나올 캐릭터가 하나도 없어요.');
    const theme = { name: clean(raw.name, NAME_MAX) || '이름 없는 테마', cast };
    const bonds = normalizeBonds(raw.bonds, cast);
    if (bonds) theme.bonds = bonds;
    // acts가 배열이면(빈 배열 포함) 이 테마만의 상호작용. 없으면 기본 상호작용을 쓴다.
    const acts = normalizeActs(raw.acts);
    if (acts) theme.acts = acts;
    return { theme, warnings };
  }

  // bonds: 캐릭터 종류끼리의 처음 우호도 { "kong+mong": 70 } (-100~100). 출연진에 있는 종류끼리만 남긴다.
  // 같은 종류끼리("kong+kong")는 그 종류가 둘 이상일 때만 남긴다.
  function normalizeBonds(raw, cast) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const count = {};
    for (const c of cast) count[c.id] = (count[c.id] || 0) + 1;
    const out = {};
    for (const [key, value] of Object.entries(raw)) {
      const ids = key.split('+');
      const v = Number(value);
      if (ids.length !== 2 || !Number.isFinite(v)) continue;
      const [a, b] = ids.sort();
      if (!count[a] || !count[b] || (a === b && count[a] < 2)) continue;
      out[`${a}+${b}`] = Math.round(Math.min(BOND_MAX, Math.max(BOND_MIN, v)));
    }
    return Object.keys(out).length ? out : null;
  }

  // acts: 만나면 하는 상호작용 목록. 동작 이름(move)은 모르는 것이어도 남겨 두고, 화면에서 "가만히 있기"로 대신한다.
  const ACT_MAX = 20;
  const BEAT_MAX = 8;
  const TIER_KEYS = ['best', 'friend', 'normal', 'cold', 'rival'];
  const pickOf = (value, list, fallback) => (list.includes(value) ? value : fallback);
  function normalizeActs(raw) {
    if (!Array.isArray(raw)) return null;
    const out = [];
    for (const a of raw.slice(0, ACT_MAX)) {
      if (!a || typeof a !== 'object' || !Array.isArray(a.beats)) continue;
      const beats = [];
      for (const b of a.beats.slice(0, BEAT_MAX)) {
        if (!b || typeof b !== 'object' || typeof b.move !== 'string' || !/^[a-z]{1,16}$/.test(b.move)) continue;
        const beat = { who: pickOf(b.who, ['a', 'b', 'both'], 'a'), move: b.move };
        if (beats.length) beat.when = pickOf(b.when, ['with', 'hit', 'after'], 'after');
        const wait = Math.round(Number(b.wait) || 0);
        if (wait) beat.wait = Math.min(5000, Math.max(-5000, wait));
        const ms = Math.round(Number(b.ms) || 0);
        if (ms > 0) beat.ms = Math.min(6000, Math.max(150, ms));
        const line = clean(b.line, 30);
        if (line) beat.line = line;
        if (b.layer === 'front' || b.layer === 'back') beat.layer = b.layer;
        beats.push(beat);
      }
      if (!beats.length) continue;
      const tiers = Array.isArray(a.tiers) ? TIER_KEYS.filter((t) => a.tiers.includes(t)) : [];
      const act = { name: clean(a.name, NAME_MAX) || '이름 없는 상호작용', tiers, often: pickOf(a.often, ['often', 'some', 'rare'], 'some'), bond: Math.round(Math.min(20, Math.max(-20, Number(a.bond) || 0))), beats };
      if (a.on === false) act.on = false;
      out.push(act);
    }
    return out;
  }

  const toBase64Url = (text) => {
    let bin = '';
    for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const fromBase64Url = (code) => {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  };

  // 코드에 담을 테마 내용: 이름, 출연진, (있으면) 처음 우호도
  const plain = (theme) => ({ name: theme.name, cast: theme.cast, ...(theme.bonds ? { bonds: theme.bonds } : {}), ...(theme.acts ? { acts: theme.acts } : {}) });

  // 공유 코드: HW40T1.<테마 JSON을 base64url로>
  function encodeTheme(theme) {
    return CODE_PREFIX + toBase64Url(JSON.stringify(plain(theme)));
  }

  // 공유 코드(또는 테마 JSON 그대로)를 읽는다. 규격 검사는 normalizeTheme으로 한다.
  function decodeTheme(code) {
    const raw = String(code || '').trim();
    // 메신저에서 줄이 바뀌어 붙여 넣어져도 코드는 읽히게 공백을 지운다 (JSON은 그대로 읽는다).
    const text = raw.startsWith('{') ? raw : raw.replace(/\s+/g, '');
    try {
      if (text.startsWith('{')) return JSON.parse(text);
      if (text.startsWith(CODE_PREFIX)) return JSON.parse(fromBase64Url(text.slice(CODE_PREFIX.length)));
    } catch {
      throw new ThemeError('테마 코드가 깨졌어요. 처음부터 끝까지 다 복사했는지 확인해 주세요.');
    }
    throw new ThemeError(`테마 코드가 아니에요. "${CODE_PREFIX}"로 시작하는 코드를 붙여 넣어 주세요.`);
  }

  // ---------- 캐릭터를 담은 테마 코드 ----------
  // 직접 넣은 캐릭터(my-…)를 쓰는 테마는 그 캐릭터의 그림까지 압축해 함께 담는다: HW40T2.<압축한 JSON>
  // 기본·팩 캐릭터만 쓰면 짧은 HW40T1 코드를 그대로 쓴다.
  const BUNDLE_PREFIX = 'HW40T2.';

  async function pipe(bytes, stream) {
    return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
  }
  const bytesToB64 = (bytes) => {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const b64ToBytes = (text) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

  // characters: 테마에 들어간 내 캐릭터 설정 목록 (없으면 HW40T1)
  async function encodeThemeCode(theme, characters = []) {
    const base = plain(theme);
    if (!characters.length) return encodeTheme(base);
    const json = new TextEncoder().encode(JSON.stringify({ ...base, characters }));
    return BUNDLE_PREFIX + bytesToB64(await pipe(json, new CompressionStream('deflate')));
  }

  // { theme: 테마 원본, characters: 함께 온 캐릭터 설정 목록 }
  async function decodeThemeCode(code) {
    const text = String(code || '').replace(/\s+/g, '');
    if (!text.startsWith(BUNDLE_PREFIX)) return { theme: decodeTheme(code), characters: [] };
    let raw;
    try {
      raw = JSON.parse(new TextDecoder().decode(await pipe(b64ToBytes(text.slice(BUNDLE_PREFIX.length)), new DecompressionStream('deflate'))));
    } catch {
      throw new ThemeError('테마 코드가 깨졌어요. 처음부터 끝까지 다 복사했는지 확인해 주세요.');
    }
    const characters = Array.isArray(raw && raw.characters) ? raw.characters : [];
    return { theme: { name: raw && raw.name, cast: raw && raw.cast, ...(raw && raw.bonds ? { bonds: raw.bonds } : {}), ...(raw && raw.acts ? { acts: raw.acts } : {}) }, characters };
  }

  const themes = {
    CODE_PREFIX, BUNDLE_PREFIX, MAX_CAST, NAME_MAX, LABEL_MAX, SIZE_MIN, SIZE_MAX, BOND_MIN, BOND_MAX, ThemeError,
    normalizeTheme, normalizeActs, encodeTheme, decodeTheme, encodeThemeCode, decodeThemeCode,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = themes;
  else root.HW40_THEMES = themes;
})(typeof globalThis !== 'undefined' ? globalThis : this);

// ---- chars.js ----
// 내 캐릭터: 그림까지 통째로 담은 "캐릭터 코드". GitHub 없이 코드(또는 .txt 파일)로 주고받는다.
// 받은 사람의 브라우저에만 저장되고, 어떤 서버로도 보내지 않는다.
// 하이웍스 화면(mascot.js)과 캐릭터 만들기 화면(maker.html)이 같이 쓴다.
(function (root) {
  const CODE_PREFIX = 'HW40C1.';
  const ID_PREFIX = 'my-';
  const MAX_BYTES = 1500 * 1024; // 캐릭터 하나에 담을 수 있는 그림 데이터 (브라우저 저장소 한도를 생각한 값)
  // SVG도 받는다: 캐릭터 그림은 CSS 배경으로만 그려서 SVG 안의 스크립트나 외부 주소가 실행·요청되지 않는다.
  const DATA_URL = /^data:image\/(png|webp|gif|jpeg|svg\+xml);base64,[A-Za-z0-9+/]+=*$/;
  const EXT = { png: '.png', webp: '.webp', gif: '.gif', jpeg: '.jpg', 'svg+xml': '.svg' };

  class CharError extends Error {}

  const rules = () => {
    const r = typeof module !== 'undefined' && module.exports ? require('../scripts/packs.js') : root.HW40_PACK_RULES;
    if (!r) throw new CharError('캐릭터 규칙을 불러오지 못했어요.');
    return r;
  };

  // 캐릭터 설정(spec)을 검사하고 엔진용 팩으로 바꾼다. 그림은 data URL(PNG·WebP·GIF·JPG)만 받는다.
  function normalizeCharacter(spec) {
    if (!spec || typeof spec !== 'object') throw new CharError('캐릭터 형식이 아니에요.');
    if (typeof spec.id !== 'string' || !spec.id.startsWith(ID_PREFIX)) throw new CharError('내 캐릭터 id는 "my-"로 시작해야 해요.');
    const bytes = JSON.stringify(spec).length;
    if (bytes > MAX_BYTES) throw new CharError(`그림이 너무 커요 (${Math.round(bytes / 1024)}KB, 최대 ${MAX_BYTES / 1024}KB). 그림 수나 크기를 줄여 주세요.`);

    // 팩 규칙은 파일 이름으로 검사하므로, 그림마다 임시 이름을 붙여 넘긴다.
    const urls = [];
    const nameOf = (url) => {
      const m = typeof url === 'string' && DATA_URL.exec(url);
      if (!m) throw new CharError('그림 데이터가 깨졌거나 지원하지 않는 형식이에요.');
      urls.push(url);
      return `img${urls.length - 1}${EXT[m[1]]}`;
    };
    const animations = {};
    for (const [name, anim] of Object.entries(spec.animations || {})) {
      if (!anim || typeof anim !== 'object') continue;
      const copy = { ...anim };
      if (Array.isArray(anim.frames)) copy.frames = anim.frames.map(nameOf);
      if (anim.sheet !== undefined) copy.sheet = nameOf(anim.sheet);
      animations[name] = copy;
    }
    try {
      const pack = rules().normalizePack({ ...spec, animations }, spec.id, (file) => urls[Number(/^img(\d+)\./.exec(file)[1])]);
      pack.label = String(pack.label).slice(0, 20);
      pack.size = Math.min(160, Math.max(32, pack.size));
      return pack;
    } catch (e) {
      throw new CharError(e.message.replace(/^\[캐릭터 팩\] [^:]+: /, ''));
    }
  }

  const toBase64Url = (bytes) => {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const fromBase64Url = (text) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

  async function pipe(bytes, stream) {
    const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await out.arrayBuffer());
  }

  // 캐릭터 코드: HW40C1.<설정 JSON을 압축해 base64url로>
  async function encodeCharacter(spec) {
    const json = new TextEncoder().encode(JSON.stringify(spec));
    return CODE_PREFIX + toBase64Url(await pipe(json, new CompressionStream('deflate')));
  }

  async function decodeCharacter(code) {
    const text = String(code || '').replace(/\s+/g, '');
    if (!text.startsWith(CODE_PREFIX)) throw new CharError(`캐릭터 코드가 아니에요. "${CODE_PREFIX}"로 시작하는 코드를 붙여 넣어 주세요.`);
    try {
      const bytes = await pipe(fromBase64Url(text.slice(CODE_PREFIX.length)), new DecompressionStream('deflate'));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new CharError('캐릭터 코드가 깨졌어요. 처음부터 끝까지 다 복사했는지 확인해 주세요.');
    }
  }

  // 팩 데이터(엔진용)를 캐릭터 설정으로 되돌린다. 기본 캐릭터 샘플을 고쳐 쓸 때 쓴다.
  function packToSpec(pack) {
    const animations = {};
    for (const [name, a] of Object.entries(pack.animations)) {
      const out = { fps: a.fps, loop: a.loop, motion: a.motion };
      if (a.still) out.still = true;
      if (a.sheet) Object.assign(out, { sheet: a.sheet, count: a.count });
      else out.frames = [...a.frames];
      if (a.special) Object.assign(out, { special: true, duration: a.special.ms, say: a.special.text, sayAt: a.special.sayAt, moving: a.special.moving });
      animations[name] = out;
    }
    return {
      id: pack.id, label: pack.label, size: pack.size, speed: pack.speed, pauseChance: pack.pauseChance,
      chaser: pack.chaser, bounce: pack.bounce, facing: pack.facing, lines: pack.lines, animations,
    };
  }

  const newId = () => ID_PREFIX + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const chars = { CODE_PREFIX, ID_PREFIX, MAX_BYTES, CharError, normalizeCharacter, encodeCharacter, decodeCharacter, packToSpec, newId };
  if (typeof module !== 'undefined' && module.exports) module.exports = chars;
  else root.HW40_CHARS = chars;
})(typeof globalThis !== 'undefined' ? globalThis : this);

// ---- packs ----
globalThis.HW40_PACKS = {"builtin":null,"packs":[],"themes":[{"id":"quiet-office","name":"조용한 사무실","cast":[{"id":"hodu"},{"id":"mong","size":72},{"id":"kong"}]}],"site":"https://ohjaeyoung95.github.io/doodling/"};

// ---- bonds.js ----
// 우호도: 화면을 돌아다니는 캐릭터끼리의 사이.
// - 처음 값은 캐릭터 "종류"끼리 정한다 (테마의 bonds → 아래 기본값 → 0). 거기에 아이마다 조금씩 흔들림을 더한다.
// - 그 뒤로는 "한 마리씩" 따로 쌓인다. 같은 종류 두 마리도 겪은 일에 따라 사이가 갈라진다.
// - 한 마리는 테마 안의 표식(uid)으로 알아본다. 표식이 없는 옛 테마는 "종류-몇 번째"로 알아본다.
// 화면 없이도 테스트할 수 있게 규칙만 담는다. 실제 움직임은 mascot.js가 한다.
(function (root) {
  const MIN = -100;
  const MAX = 100;
  const JITTER = 12; // 처음 값에 더하는 아이마다의 흔들림

  // 사이 단계 (위에서부터 먼저 맞는 것)
  const TIERS = [
    { key: 'best', min: 60, label: '단짝', mark: '♥♥', color: '#e0577a' },
    { key: 'friend', min: 20, label: '친함', mark: '♥', color: '#ef8aa3' },
    { key: 'normal', min: -19, label: '보통', mark: '·', color: '#8a7d68' },
    { key: 'cold', min: -59, label: '서먹', mark: '💧', color: '#5b8bd0' },
    { key: 'rival', min: MIN, label: '앙숙', mark: '💢', color: '#d0503a' },
  ];
  const tierOf = (v) => TIERS.find((t) => v >= t.min) || TIERS[TIERS.length - 1];
  const clamp = (v) => Math.round(Math.min(MAX, Math.max(MIN, v)));

  // 기본 캐릭터끼리의 처음 사이 (성격과 마주쳤을 때 대사에서 따왔다). 같은 종류끼리도 정한다.
  const DEFAULTS = {
    'kong+mong': 70, // 간식 친구
    'hodu+mong': 45, // 쿠키 드리는 후배와 선배
    'hodu+kong': 20,
    'mong+ppyong': 5,
    'hodu+ppyong': -25, // "바빠."
    'kong+ppyong': -35, // "비켜비켜!" "히익!"
    'bora+kong': -50, // 겁 많은 콩떡이와 괴물
    'bora+ppyong': 25, // 술래잡기 좋아하는 둘
    'bora+hodu': -15,
    'bora+mong': 15,
    'kong+kong': 40,
    'mong+mong': 60,
    'ppyong+ppyong': 15,
    'hodu+hodu': -10,
    'bora+bora': -30,
  };

  // 종류 둘의 열쇠: 알파벳순으로 "a+b" (같은 종류면 "a+a")
  const typeKey = (a, b) => [a, b].sort().join('+');
  // 한 마리 둘의 열쇠
  const pairKey = (a, b) => [a, b].sort().join('|');

  // 처음 값: 테마가 정한 값 → 기본값 → 0
  function baseValue(idA, idB, themeBonds) {
    const k = typeKey(idA, idB);
    if (themeBonds && Number.isFinite(themeBonds[k])) return clamp(themeBonds[k]);
    return DEFAULTS[k] !== undefined ? DEFAULTS[k] : 0;
  }

  // 테마 출연진의 한 마리 열쇠들: uid가 있으면 그것, 없으면 "종류-몇 번째"
  function memberKeys(cast) {
    const seen = {};
    return cast.map((c) => {
      const nth = (seen[c.id] = (seen[c.id] || 0) + 1) - 1;
      return c.uid || `${c.id}-${nth}`;
    });
  }

  // 화면에 보일 이름: 같은 이름이 여럿이면 "콩떡이 1", "콩떡이 2"처럼 번호를 붙여 누가 누군지 알게 한다.
  function displayNames(cast, labelOf) {
    const base = cast.map((c) => c.name || labelOf(c.id));
    const total = {};
    for (const n of base) total[n] = (total[n] || 0) + 1;
    const seen = {};
    return base.map((n) => {
      if (total[n] < 2) return n;
      seen[n] = (seen[n] || 0) + 1;
      return `${n} ${seen[n]}`;
    });
  }

  // 저장된 사이를 지금 출연진에 맞춘다: 있던 사이는 그대로, 새 아이와의 사이는 처음 값으로 만들고, 빠진 아이의 사이는 지운다.
  // members: [{ key, id }]
  function syncBonds(stored, members, themeBonds, rand = Math.random) {
    const out = {};
    for (let i = 0; i < members.length; i += 1) {
      for (let j = i + 1; j < members.length; j += 1) {
        const [a, b] = [members[i], members[j]];
        const k = pairKey(a.key, b.key);
        if (stored && Number.isFinite(stored[k])) out[k] = clamp(stored[k]);
        else out[k] = clamp(baseValue(a.id, b.id, themeBonds) + (rand() * 2 - 1) * JITTER);
      }
    }
    return out;
  }

  // ---------- 만났을 때 ----------
  // 사이 단계마다 일어날 수 있는 일과 그 확률. 결과에 따라 우호도가 오르내린다.
  const KINDS = {
    hug: { delta: [1, 3], emote: ['♥', '♥'], lines: [['헤헤♥', '좋아!', '꼬옥!'], ['나도♥', '히히', '따뜻해~']] },
    together: { delta: [2, 4], emote: ['♪', '♪'], lines: [['같이 가자!', '산책할래?'], ['응!', '좋아~']] },
    greet: { delta: [2, 5], emote: ['♪', null], pairLines: true, lines: [['안녕!', '반가워~', '오늘 어때?'], ['안녕~', '오늘도 힘내!', '좋아!']] },
    chat: { delta: [-3, 6], emote: [null, null], pairLines: true, lines: [['어…', '안녕?', '음…'], ['아, 안녕', '응…', '어어']] },
    spat: { delta: [-5, -2], emote: ['💢', '💦'], lines: [['그건 내 거야!', '왜 밀어!'], ['칫…', '내가 뭘!']] },
    ignore: { delta: [-3, -1], emote: ['💧', '💧'], lines: [['흥.', '…'], ['…', '쳇.']] },
    makeup: { delta: [3, 7], emote: ['❔', '❕'], lines: [['저기…', '있잖아…'], ['응?', '왜?']] },
    quarrel: { delta: [-4, -1], emote: ['💢', '💢'], lines: [['으르렁!', '뭐야!', '저리 가!'], ['너나 잘해!', '흥!', '뭘 봐!']] },
    reconcile: { delta: [10, 18], emote: ['💗', '💗'], lines: [['미안해…', '우리 화해할래?'], ['나도…', '응, 좋아']] },
  };
  const CHANCES = {
    best: [['hug', 0.5], ['together', 0.45], ['spat', 0.05]],
    friend: [['greet', 0.55], ['together', 0.2], ['hug', 0.1], ['spat', 0.15]],
    normal: [['chat', 0.8], ['greet', 0.1], ['spat', 0.1]],
    cold: [['ignore', 0.65], ['makeup', 0.25], ['quarrel', 0.1]],
    rival: [['quarrel', 0.75], ['ignore', 0.1], ['reconcile', 0.15]],
  };

  // 사이 value인 둘이 만났을 때 할 일을 고른다.
  // → { kind, delta, emote: [왼쪽, 오른쪽], lines: [왼쪽 후보, 오른쪽 후보], pairLines }
  function planMeeting(value, rand = Math.random) {
    const tier = tierOf(value);
    let r = rand();
    let kind = CHANCES[tier.key][0][0];
    for (const [name, p] of CHANCES[tier.key]) {
      kind = name;
      if ((r -= p) < 0) break;
    }
    const k = KINDS[kind];
    const [lo, hi] = k.delta;
    const delta = Math.round(lo + rand() * (hi - lo));
    return { kind, delta, emote: k.emote, lines: k.lines, pairLines: Boolean(k.pairLines), tier: tier.key };
  }

  // 사이를 바꾼다. → { value, before, after, changed(단계가 바뀌었는지), up }
  function applyDelta(value, delta) {
    const next = clamp(value + delta);
    const before = tierOf(value);
    const after = tierOf(next);
    return { value: next, before: before.key, after: after.key, changed: before !== after, up: TIERS.indexOf(after) < TIERS.indexOf(before) };
  }

  // ---------- 상호작용: 둘이 박자(beat)를 이어 하나의 장면을 연기한다 ----------
  // 동작 하나 = 몸 움직임(keys) + 손에 든 것·날아가는 것·맞는 곳 효과(fx). t는 동작 안의 시간 비율(0~1).
  // 몸 값: x(상대 쪽으로 px) y(위로 px) r(상대 쪽으로 기울기, 도) sx·sy(늘이기 배율). 빠진 값은 0(배율은 1).
  // hit: "맞는 순간"(비율). abs: 몸 값이 지금 자세와 상관없는 절대 자세(쓰러지기·일어나기).
  // shift: 동작이 끝난 뒤에도 남는 자리 이동. 장면이 끝나면 그 자리에 그대로 선다.
  const MOVES = {
    stand: { label: '가만히 있기', icon: '🧍', ms: 600, keys: [{}, {}] },
    hop: { label: '콩 뛰기', icon: '🤸', ms: 600, keys: [{}, { t: 0.2, sx: 1.12, sy: 0.86 }, { t: 0.5, y: 26, sx: 0.94, sy: 1.08 }, { t: 0.82, sx: 1.08, sy: 0.92 }, {}] },
    nod: { label: '끄덕끄덕', icon: '🙂', ms: 700, keys: [{}, { t: 0.25, r: 8, y: -1 }, { t: 0.5 }, { t: 0.75, r: 8, y: -1 }, {}] },
    bow: { label: '꾸벅 인사', icon: '🙇', ms: 1000, keys: [{}, { t: 0.3, r: 28 }, { t: 0.7, r: 28 }, {}] },
    wave: { label: '손 흔들기', icon: '👋', ms: 1100, keys: [{}, { t: 0.25, r: -4 }, { t: 0.5, r: 4 }, { t: 0.75, r: -4 }, {}], fx: [{ type: 'hand', emoji: '👋', up: 0.85, keys: [{ r: -20 }, { t: 0.25, r: 20 }, { t: 0.5, r: -20 }, { t: 0.75, r: 20 }, { r: 0, o: 0 }] }] },
    approach: { label: '다가가기', icon: '👣', ms: 600, keys: [{}, { t: 0.5, x: 9, y: 4 }, { x: 18 }], shift: { x: 18 } },
    backoff: { label: '뒷걸음질', icon: '🔙', ms: 600, keys: [{}, { t: 0.5, x: -10, y: 4 }, { x: -20 }], shift: { x: -20 } },
    lunge: { label: '달려들기', icon: '💨', ms: 550, hit: 0.55, keys: [{}, { t: 0.3, x: -6, r: -8 }, { t: 0.55, x: 26, r: 12 }, {}] },
    swing: {
      label: '칼 휘두르기', icon: '🗡️', ms: 850, hit: 0.5,
      keys: [{}, { t: 0.35, r: -10 }, { t: 0.5, x: 10, r: 14 }, { t: 0.75, x: 6, r: 6 }, {}],
      fx: [{ type: 'hand', emoji: '🗡️', keys: [{ r: -30 }, { t: 0.35, r: -90 }, { t: 0.55, r: 100, x: 14 }, { r: 70, x: 6 }] }, { type: 'burst', emoji: '💥' }],
    },
    sheathe: { label: '칼 집어넣기', icon: '🗡️', ms: 800, keys: [{}, { t: 0.4, r: -4 }, {}], fx: [{ type: 'hand', emoji: '🗡️', keys: [{ r: 70 }, { t: 0.6, r: 170, y: -6 }, { r: 180, y: -14, o: 0 }] }] },
    punch: { label: '꿀밤 주기', icon: '👊', ms: 550, hit: 0.5, keys: [{}, { t: 0.3, x: -4 }, { t: 0.5, x: 14 }, {}], fx: [{ type: 'hand', emoji: '👊', keys: [{ x: -4 }, { t: 0.3, x: -8 }, { t: 0.5, x: 24 }, { x: 0, o: 0 }] }, { type: 'burst', emoji: '💥' }] },
    shoot: { label: '빵 쏘기', icon: '🔫', ms: 750, hit: 0.5, keys: [{}, { t: 0.3, x: -6, r: -6 }, { t: 0.5 }, {}], fx: [{ type: 'hand', emoji: '🔫', keys: [{}, { t: 0.3, r: -18 }, { t: 0.6 }, { o: 0 }] }, { type: 'shot', emoji: '●', size: 9, from: 0.3, to: 0.5 }, { type: 'burst', emoji: '💥' }] },
    toss: { label: '던지기', icon: '🥎', ms: 900, hit: 0.8, keys: [{}, { t: 0.25, r: -12 }, { t: 0.4, r: 12, x: 6 }, {}], fx: [{ type: 'shot', emoji: '🥎', from: 0.4, to: 0.8, arc: 40 }, { type: 'burst', emoji: '💫' }] },
    magic: { label: '마법 쏘기', icon: '✨', ms: 950, hit: 0.75, keys: [{}, { t: 0.3, y: 8, sy: 1.06 }, { t: 0.45 }, {}], fx: [{ type: 'shot', emoji: '✨', from: 0.35, to: 0.75, arc: 16 }, { type: 'burst', emoji: '🌟' }] },
    heart: { label: '하트 날리기', icon: '💗', ms: 850, hit: 0.75, keys: [{}, { t: 0.3, r: -6, sy: 1.05 }, {}], fx: [{ type: 'shot', emoji: '💗', from: 0.3, to: 0.75, arc: 24 }] },
    give: { label: '간식 건네기', icon: '🍪', ms: 900, hit: 0.6, keys: [{}, { t: 0.6, x: 10, r: 8 }, {}], fx: [{ type: 'hand', emoji: '🍪', keys: [{}, { t: 0.6, x: 26 }, { x: 28, o: 0 }] }] },
    eat: { label: '냠냠 먹기', icon: '😋', ms: 1000, keys: [{}, { t: 0.25, sy: 0.92, sx: 1.06 }, { t: 0.5 }, { t: 0.75, sy: 0.92, sx: 1.06 }, {}], fx: [{ type: 'hand', emoji: '🍪', up: 0.6, keys: [{ x: -14 }, { t: 0.5, x: -16, s: 0.7 }, { x: -16, s: 0.3, o: 0 }] }] },
    hug: { label: '껴안기', icon: '🤗', ms: 1300, hit: 0.35, emote: '♥', keys: [{}, { t: 0.35, x: 22, sx: 1.08, sy: 0.94 }, { t: 0.8, x: 22, sx: 1.08, sy: 0.94 }, {}] },
    highfive: { label: '하이파이브', icon: '✋', ms: 750, hit: 0.5, keys: [{}, { t: 0.3, y: 6, sy: 0.92 }, { t: 0.5, x: 10, y: 14, r: 6 }, {}], fx: [{ type: 'hand', emoji: '✋', up: 0.95, keys: [{ o: 0 }, { t: 0.3, x: 4 }, { t: 0.5, x: 16, y: 10 }, { x: 8, o: 0 }] }, { type: 'burst', emoji: '✨', mid: true }] },
    dance: { label: '춤추기', icon: '💃', ms: 1600, keys: [{}, { t: 0.125, r: -10, y: 6 }, { t: 0.25 }, { t: 0.375, r: 10, y: 6 }, { t: 0.5 }, { t: 0.625, r: -10, y: 6 }, { t: 0.75 }, { t: 0.875, r: 10, y: 6 }, {}], emote: '♪' },
    spin: { label: '빙글 돌기', icon: '🌀', ms: 800, keys: [{}, { t: 0.25, sx: 0.1, y: 8 }, { t: 0.5, sx: -1, y: 12 }, { t: 0.75, sx: 0.1, y: 8 }, {}] },
    laugh: { label: '깔깔 웃기', icon: '😆', ms: 900, emote: '😆', keys: [{}, { t: 0.2, sy: 0.9, r: -4 }, { t: 0.4 }, { t: 0.6, sy: 0.9, r: -4 }, { t: 0.8 }, {}] },
    shake: { label: '부들부들', icon: '💢', ms: 900, emote: '💢', keys: [{}, { t: 0.1, x: -2 }, { t: 0.2, x: 2 }, { t: 0.3, x: -2 }, { t: 0.4, x: 2 }, { t: 0.5, x: -2 }, { t: 0.6, x: 2 }, { t: 0.7, x: -2 }, { t: 0.8, x: 2 }, {}] },
    sulk: { label: '홱 돌아서기', icon: '😤', ms: 600, emote: '💢', keys: [{}, { t: 0.5, sx: 0.1 }, { sx: -1 }], shift: { sx: -1 } },
    cry: { label: '엉엉 울기', icon: '😭', ms: 1100, emote: '💧', keys: [{}, { t: 0.2, sy: 0.9, sx: 1.05 }, { t: 0.4, sy: 0.94 }, { t: 0.6, sy: 0.9, sx: 1.05 }, { t: 0.8, sy: 0.94 }, {}] },
    flinch: { label: '맞고 움찔', icon: '😣', ms: 550, keys: [{}, { t: 0.25, x: -10, r: -14, sy: 0.92 }, { t: 0.6, x: -4, r: -4 }, {}] },
    knockback: { label: '날아가기', icon: '💫', ms: 750, keys: [{}, { t: 0.4, x: -40, y: 22, r: -20 }, { t: 0.8, x: -52, r: -6 }, { x: -52 }], shift: { x: -52 } },
    fall: { label: '쓰러지기', icon: '😵', ms: 800, abs: true, keys: [{}, { t: 0.3, r: 12, y: 4 }, { r: -90 }] },
    getup: { label: '일어나기', icon: '🙆', ms: 800, abs: true, keys: [{ r: -90 }, { t: 0.5, r: -30, y: 6 }, { t: 0.8, y: 10, sy: 1.04 }, {}] },
    flee: { label: '도망가기', icon: '🏃', ms: 900, keys: [{}, { t: 0.2, y: 10, sx: -1 }, { t: 0.5, x: -50, y: 0, sx: -1 }, { t: 0.7, x: -70, y: 8, sx: -1 }, { x: -90, sx: -1 }], shift: { x: -90, sx: -1 } },
  };
  const BEAT_WHEN = { with: '같이', hit: '맞는 순간', after: '끝나고' };
  const ACT_OFTEN = { often: { label: '자주', weight: 3 }, some: { label: '가끔', weight: 1 }, rare: { label: '드물게', weight: 0.3 } };
  const BUILTIN_WEIGHT = 1.2; // 상호작용 대신 원래 하던 간단한 반응(인사·껴안기 등)을 고를 무게

  // 동작 하나의 모든 값을 채운다 (빠진 값은 0, 배율은 1)
  const fullPose = (k = {}) => ({ x: k.x || 0, y: k.y || 0, r: k.r || 0, sx: k.sx === undefined ? 1 : k.sx, sy: k.sy === undefined ? 1 : k.sy });

  // 박자들의 시작·끝·맞는 순간을 계산한다. 첫 박자는 0에서 시작하고, 다음 박자는 앞 박자 기준(같이/맞는 순간/끝나고) + 기다림.
  // 기다림이 음수면 그만큼 앞당긴다(0초보다 앞으로는 못 간다). ms가 있으면 동작 길이를 그만큼으로 늘이거나 줄인다.
  // anchor: 이 박자의 기준 시각 (시간표에서 끌어 옮길 때 기다림을 거꾸로 계산하는 데 쓴다)
  function schedule(beats) {
    const out = [];
    for (const b of beats) {
      const mv = MOVES[b.move] || MOVES.stand;
      let anchor = 0;
      if (out.length) {
        const p = out[out.length - 1];
        anchor = b.when === 'with' ? p.start : b.when === 'hit' ? p.hit : p.end;
      }
      const start = Math.max(0, anchor + (Number(b.wait) || 0));
      const ms = b.ms > 0 ? b.ms : mv.ms;
      out.push({ ...b, anchor, start, end: start + ms, hit: start + ms * (mv.hit === undefined ? 1 : mv.hit) });
    }
    const total = out.reduce((t, b) => Math.max(t, b.end), 0);
    return { beats: out, total };
  }

  // 사이 value인 둘이 만났을 때 할 상호작용을 고른다. 고르지 않으면(원래 반응을 하면) null.
  // force: 원래 반응은 빼고 상호작용만 고른다 (사이 보기의 ▶)
  function pickAct(acts, value, rand = Math.random, force = false) {
    const tier = tierOf(value).key;
    const list = (acts || []).filter((a) => a.on !== false && a.beats && a.beats.length && (a.tiers || []).includes(tier));
    const weights = list.map((a) => (ACT_OFTEN[a.often] || ACT_OFTEN.some).weight);
    const sum = weights.reduce((s, w) => s + w, 0);
    let r = rand() * (sum + (force ? 0 : BUILTIN_WEIGHT));
    for (let i = 0; i < list.length; i += 1) {
      if ((r -= weights[i]) < 0) return list[i];
    }
    return null;
  }

  // 기본 상호작용 (테마에 따로 정하지 않으면 이걸 쓴다). 테마 만들기 화면의 "틀"이기도 하다.
  const ACT_TEMPLATES = [
    { name: '하이파이브', tiers: ['best', 'friend'], often: 'some', bond: 4, beats: [
      { who: 'a', move: 'approach', line: '야호!' },
      { who: 'both', move: 'highfive', when: 'after', line: '짝!' },
      { who: 'b', move: 'hop', when: 'after', line: '헤헤' },
    ] },
    { name: '같이 춤추기', tiers: ['best'], often: 'some', bond: 3, beats: [
      { who: 'a', move: 'dance', line: '♪ 랄라~' },
      { who: 'b', move: 'dance', when: 'with', wait: 200, line: '♪' },
      { who: 'both', move: 'spin', when: 'after' },
    ] },
    { name: '간식 나눠 먹기', tiers: ['friend', 'normal'], often: 'some', bond: 5, beats: [
      { who: 'a', move: 'give', line: '이거 먹을래?' },
      { who: 'b', move: 'eat', when: 'hit', line: '냠냠!' },
      { who: 'b', move: 'hop', when: 'after', line: '고마워!' },
    ] },
    { name: '하트 날리기', tiers: ['best', 'friend'], often: 'rare', bond: 3, beats: [
      { who: 'a', move: 'heart', line: '♥' },
      { who: 'b', move: 'hop', when: 'hit', line: '히히' },
    ] },
    { name: '수줍은 인사', tiers: ['normal'], often: 'some', bond: 2, beats: [
      { who: 'a', move: 'wave', line: '안녕…?' },
      { who: 'b', move: 'bow', when: 'after', line: '아, 안녕' },
    ] },
    { name: '꿀밤', tiers: ['cold'], often: 'some', bond: -2, beats: [
      { who: 'a', move: 'punch', line: '꿀밤!' },
      { who: 'b', move: 'flinch', when: 'hit', line: '아야!' },
      { who: 'b', move: 'cry', when: 'after', line: '흐엥' },
    ] },
    { name: '홱 토라지기', tiers: ['cold', 'rival'], often: 'some', bond: -2, beats: [
      { who: 'a', move: 'sulk', line: '흥!' },
      { who: 'b', move: 'shake', when: 'with', wait: 200, line: '뭐야!' },
    ] },
    { name: '칼싸움', tiers: ['rival'], often: 'some', bond: -4, beats: [
      { who: 'a', move: 'swing', line: '에잇!', layer: 'front' },
      { who: 'b', move: 'fall', when: 'hit', line: '으윽…' },
      { who: 'a', move: 'sheathe', when: 'after', line: '흥.' },
      { who: 'b', move: 'getup', when: 'after', wait: 500, line: '두고 보자!' },
    ] },
    { name: '빵!', tiers: ['rival'], often: 'rare', bond: -3, beats: [
      { who: 'a', move: 'shoot', line: '빵!' },
      { who: 'b', move: 'knockback', when: 'hit', line: '으악!' },
    ] },
  ];

  const bonds = {
    MIN, MAX, TIERS, DEFAULTS, KINDS, tierOf, clamp, typeKey, pairKey, baseValue, memberKeys, displayNames, syncBonds, planMeeting, applyDelta,
    MOVES, BEAT_WHEN, ACT_OFTEN, ACT_TEMPLATES, fullPose, schedule, pickAct,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = bonds;
  else root.HW40_BONDS = bonds;
})(typeof globalThis !== 'undefined' ? globalThis : this);

// ---- mascot.js ----
// 화면 하단을 돌아다니는 오리지널 캐릭터들. 외부 이미지 없이 SVG로 그린다.
(function () {
  const api = globalThis.HW40;
  const { mascotMood, formatDuration } = api;

  const WIDTH = 64;
  const HURRY_FACTOR = 2.7;
  const PANEL_CLEARANCE = 300; // 패널 폭 + 여백 + 말풍선 여유
  const MEET_COOLDOWN_MS = 25000;
  const BOND_MEET_COOLDOWN_MS = 14000; // 우호도가 있는 아이들끼리는 더 자주 만나 사이가 움직인다
  const CHASE_COOLDOWN_MS = 40000;
  const CHASE_GIVE_UP_MS = 7000;
  const FLEE_MS = 2600;
  const GRAVITY = 2600; // 떨어질 때 가속도 (px/초²)
  const DRAG_START_PX = 5; // 이만큼 끌어야 드래그로 본다 (그보다 작으면 클릭)
  const SCREAM_HEIGHT = 50; // 이보다 높은 데서 떨어지면 비명을 지른다
  const LAND_MS = 420;
  const MENU_IDLE_MS = 5000;
  // 종이: 캐릭터는 종이에서 빠져나와 돌아다니고, 가두면 종이에 붙어 왼쪽 벽으로 유배된다.
  const EXILE_KEY = 'hw40-exiled';
  const EXILE_SCALE = 0.55;
  const WALL_STAY_MS = 6000; // 방에서 나간 아바타가 벽에 붙어 있는 시간 (그 뒤 사라진다)
  const STORAGE_KEY = 'hw40-mascot-off';
  // 예전 "몽실이 그림 바꾸기"가 남긴 그림. 기능을 뺐으니 저장 공간만 비운다.
  const OLD_CUSTOM_KEY = 'hw40-custom-image';
  // 테마: 내가 추가한 테마 목록과 지금 고른 테마. 역시 이 브라우저에만 저장된다.
  const THEMES_KEY = 'hw40-themes';
  const ACTIVE_KEY = 'hw40-theme';
  // 내 캐릭터: 캐릭터 코드로 추가한 그림 캐릭터들. 이 브라우저에만 저장된다.
  const MY_CHARS_KEY = 'hw40-my-chars';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const { characters: BUILTINS, meetLines: MEET_LINES, artCss: ART_CSS, confetti: CONFETTI } = globalThis.HW40_BUILTINS;
  const { createSpriteRenderer } = globalThis.HW40_SPRITE;
  const THEME_RULES = globalThis.HW40_THEMES;
  const CHAR_RULES = globalThis.HW40_CHARS;
  const BONDS = globalThis.HW40_BONDS || null; // 우호도 규칙 (bonds.js)

  const STYLE = `
    :host { will-change: transform; }
    #flip { width: ${WIDTH}px; height: ${WIDTH}px; }
    svg { display: block; pointer-events: auto; cursor: pointer; overflow: visible; }
    .hop svg, .hop:not(.nobounce) #jump { animation: hop .6s cubic-bezier(.3,.7,.4,1); }
    .party svg, .party:not(.nobounce) #jump { animation: hop .6s cubic-bezier(.3,.7,.4,1) infinite; }
    /* 캐릭터 팩: 이미지 프레임을 그대로 보여준다 */
    #jump { width: 100%; height: 100%; }
    #sprite { width: 100%; height: 100%; pointer-events: auto; cursor: pointer;
      background-repeat: no-repeat; background-position: center bottom; background-size: contain;
      transform-box: fill-box; transform-origin: bottom center; }
    .motion-bob { animation: bob .25s ease-in-out infinite alternate; }
    .motion-breathe { animation: breathe 1.6s ease-in-out infinite alternate; }
    .motion-shake { animation: tremble .1s linear infinite alternate; }
    .motion-wobble { animation: wobble .8s ease-in-out infinite alternate; }
    @keyframes wobble { from { transform: rotate(-6deg); } to { transform: rotate(6deg); } }
    /* 잡혀서 대롱대롱 → 버둥거리며 떨어짐 → 착지할 때 납작 */
    svg, #sprite { touch-action: none; }
    .dragged svg, .dragged #jump { animation: dangle .45s ease-in-out infinite alternate; transform-origin: 50% 0; }
    .falling svg, .falling #jump { animation: flail .09s linear infinite alternate; transform-origin: 50% 50%; }
    .land svg, .land #jump { animation: squash ${LAND_MS}ms cubic-bezier(.3,1.5,.5,1); transform-origin: 50% 100%; }
    @keyframes dangle { from { transform: rotate(-14deg); } to { transform: rotate(14deg); } }
    @keyframes flail { from { transform: rotate(-9deg) scaleY(1.06); } to { transform: rotate(9deg) scaleY(1.06); } }
    @keyframes squash { 0% { transform: scale(1.35, .62); } 45% { transform: scale(.88, 1.14); } 75% { transform: scale(1.06, .95); } 100% { transform: none; } }
    /* 클릭 메뉴: 캐릭터 둘레에 동그란 말풍선 버튼 */
    /* 종이: 캐릭터 뒤에 깔리는 공책 종이 */
    #card { position: relative; transform-origin: 50% 100%; }
    #paper { position: absolute; left: 50%; bottom: -5px; border-radius: 3px; opacity: 0; pointer-events: none;
      background: #fffdf5 repeating-linear-gradient(to bottom, transparent 0 13px, rgba(110,140,200,.28) 13px 14px);
      border: 1px solid #e3dccb; box-shadow: 0 3px 9px rgba(0,0,0,.2); transform-origin: 50% 100%; }
    #paper::before { content: ''; position: absolute; top: 0; bottom: 0; left: 14%; width: 1px; background: rgba(220,110,110,.45); }
    #paper.on { opacity: 1; }
    #paper.show { animation: paperIn .34s cubic-bezier(.2,.9,.3,1.25) both; }
    #paper.away { animation: paperAway .75s ease-in both; }
    #paper.exiled { opacity: 1; pointer-events: auto; cursor: pointer; }
    @keyframes paperIn { from { opacity: 0; transform: translateY(24px) scaleY(.08); } to { opacity: 1; transform: none; } }
    @keyframes paperAway { from { opacity: 1; transform: none; } to { opacity: 0; transform: translate(-26px, 46px) rotate(-38deg) scale(.7); } }
    /* 종이 위의 그림이 된 모습 → 촥 붙기 → 톡 튀어나오기 */
    .flat { filter: sepia(.5) saturate(.7) contrast(.95); }
    .flat svg, .flat #jump { transform: scale(.88); transform-origin: 50% 100%; }
    .stuck svg, .stuck #jump { animation: splat .36s cubic-bezier(.3,1.4,.5,1) both; transform-origin: 50% 100%; }
    @keyframes splat { 0% { transform: none; } 35% { transform: scale(1.3, .68); } 100% { transform: scale(.88); } }
    .popout svg, .popout #jump { animation: popout .55s cubic-bezier(.3,1.5,.5,1); transform-origin: 50% 100%; }
    @keyframes popout { 0% { transform: scale(.88); } 40% { transform: translateY(-20px) scale(1.12); } 100% { transform: none; } }
    .sway { animation: sway 2.6s ease-in-out infinite alternate; transform-origin: 50% 0; }
    @keyframes sway { from { transform: rotate(-3deg); } to { transform: rotate(3deg); } }
    #ring { position: absolute; left: 50%; width: 0; height: 0; }
    /* 방 아바타의 주인 닉네임: 머리 위에 종이 쪽지처럼 */
    #tag { position: absolute; left: 50%; transform: translateX(-50%) rotate(-2deg); padding: 0 7px; border-radius: 7px 3px 7px 3px;
      background: #3b5ba9; color: #fff; font: 700 11px/17px 'Malgun Gothic', sans-serif; white-space: nowrap; pointer-events: none;
      box-shadow: 1px 2px 0 rgba(0,0,0,.15); }
    #tag.self { background: #ffe58a; color: #3b3226; border: 1.5px solid #3b3226; }
    #ring button { position: absolute; width: 38px; height: 38px; margin: -19px 0 0 -19px; padding: 0; border-radius: 50%;
      display: grid; place-items: center; background: #fff; border: 1.5px solid #6b4a2b; color: #4a3520;
      box-shadow: 0 2px 6px rgba(0,0,0,.2); font: 17px/1 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif;
      cursor: pointer; pointer-events: auto; animation: pop .26s cubic-bezier(.3,1.6,.5,1) backwards; }
    #ring button:hover, #ring button:focus-visible { background: #fff4dc; transform: scale(1.15); outline: none; }
    #ring button::after { content: attr(data-label); position: absolute; top: 100%; margin-top: 3px; white-space: nowrap;
      padding: 1px 6px; border-radius: 8px; background: #4a3520; color: #fff; font: 600 11px 'Malgun Gothic', sans-serif;
      opacity: 0; transition: opacity .12s; pointer-events: none; }
    #ring button:hover::after, #ring button:focus-visible::after { opacity: 1; }
    @keyframes pop { from { transform: translate(var(--fx), var(--fy)) scale(.2); opacity: 0; } }
    /* 우호도: 머리 옆에 떠오르는 마음 표시(♥ 💢 💧 …)와, "사이 보기" 때 머리 위에 뜨는 이름표 */
    #emote { position: absolute; right: -6px; font: 18px/1 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif; color: #e0577a;
      pointer-events: none; opacity: 0; text-shadow: 0 1px 0 #fff, 0 0 3px #fff; }
    #emote.show { animation: emote 1.9s ease-out; }
    #emote.zz { opacity: 1; animation: zz 2.6s ease-in-out infinite; }
    @keyframes zz { 0%, 100% { transform: translateY(0) rotate(-6deg); } 50% { transform: translateY(-6px) rotate(6deg); } }
    @keyframes emote { 0% { opacity: 0; transform: translateY(6px) scale(.4); } 15% { opacity: 1; transform: translateY(0) scale(1.15); }
      30% { transform: translateY(-2px) scale(1); } 80% { opacity: 1; } 100% { opacity: 0; transform: translateY(-16px) scale(.95); } }
    #bondtag { position: absolute; left: 50%; transform: translateX(-50%); padding: 1px 8px; border-radius: 9px; white-space: nowrap;
      background: #fff; border: 2px solid var(--tc, #8a7d68); color: #3b3226; font: 700 11px/16px 'Malgun Gothic', sans-serif;
      box-shadow: 1px 2px 0 rgba(0,0,0,.12); pointer-events: none; animation: tagIn .3s cubic-bezier(.3,1.5,.5,1); }
    #bondtag b { color: var(--tc, #8a7d68); margin-left: 3px; }
    #bondtag.me { background: #ffe58a; border-color: #3b3226; }
    #bondtag i { display: inline-block; min-width: 16px; height: 16px; margin: 0 4px 0 -5px; border-radius: 8px; background: var(--tc, #8a7d68);
      color: #fff; font: 800 11px/16px 'Malgun Gothic', sans-serif; text-align: center; font-style: normal; vertical-align: top; }
    #bondtag.num { padding-right: 6px; }
    #bondtag { transition: transform .18s, box-shadow .18s; }
    #bondtag.hl { transform: translateX(-50%) scale(1.25); box-shadow: 0 0 0 3px #ffd84a, 1px 2px 0 rgba(0,0,0,.12); }
    #card { transition: filter .18s; }
    #card.hl { filter: drop-shadow(0 0 3px #ffd84a) drop-shadow(0 0 7px #ffb000); }
    @keyframes tagIn { from { opacity: 0; transform: translate(-50%, 6px) scale(.7); } }
    /* 앙숙과 마주쳐 부들부들 */
    .angry svg, .angry #jump { animation: tremble .07s linear infinite alternate; }
    ${ART_CSS}
    #bubble { position: absolute; bottom: ${WIDTH + 6}px; padding: 4px 9px; white-space: nowrap;
      background: #fff; color: #4a3520; border: 1.5px solid #6b4a2b; border-radius: 10px;
      font: 600 12px 'Malgun Gothic', sans-serif; }`;

  // characters/ 폴더의 팩을 캐릭터 정의로 바꾼다. "special" 애니메이션은 그 캐릭터만의 장면이 된다.
  function packDef(pack) {
    const skits = {};
    for (const [name, anim] of Object.entries(pack.animations)) {
      if (anim.special) skits[name] = anim.special;
    }
    return {
      id: pack.id,
      label: pack.label,
      speed: pack.speed,
      pauseChance: pack.pauseChance,
      chaser: pack.chaser,
      partyLine: pack.lines.celebrate,
      restLine: pack.lines.rest,
      meet: pack.lines.meet,
      skits,
      pack,
    };
  }

  // 팩 id가 기본 캐릭터와 같으면 팩이 그 캐릭터를 대신한다. config.json의 builtin으로 기본 캐릭터를 고른다.
  const PACKS = globalThis.HW40_PACKS || { builtin: null, packs: [] };
  const packDefs = PACKS.packs.map(packDef);
  const packIds = new Set(packDefs.map((d) => d.id));
  const allowedBuiltins = Array.isArray(PACKS.builtin) ? new Set(PACKS.builtin) : null;
  const CHARACTERS = [
    ...BUILTINS.filter((d) => (!allowedBuiltins || allowedBuiltins.has(d.id)) && !packIds.has(d.id)),
    ...packDefs,
  ];
  // 테마에서 고를 수 있는 모든 캐릭터 (config.json으로 기본 목록에서 뺀 캐릭터와 내 캐릭터도 포함)
  const BASE_CATALOG = [...BUILTINS.filter((d) => !packIds.has(d.id)), ...packDefs];
  let myDefs = [];
  let CATALOG = new Map();
  let knownIds = new Set();


  function readOff() {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }
  function writeOff(off) {
    try {
      if (off) localStorage.setItem(STORAGE_KEY, '1');
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // 저장이 막혀 있으면 이번 페이지에서만 적용된다.
    }
  }

  function readJson(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v === null ? fallback : v;
    } catch {
      return fallback;
    }
  }
  function writeValue(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  const maxX = (w = WIDTH) => Math.max(0, window.innerWidth - w);
  // 패널에 가리지 않고 멈춰 있을 수 있는 오른쪽 한계
  const clearMaxX = (w = WIDTH) => Math.max(0, window.innerWidth - w - PANEL_CLEARANCE);

  try {
    localStorage.removeItem(OLD_CUSTOM_KEY);
  } catch {
    // 저장소를 못 쓰면 지울 것도 없다.
  }

  const pickOne = (list) => list[Math.floor(Math.random() * list.length)];

  // look: 테마가 정한 이름(name)과 크기(size)
  // look.guest: 놀러 온 동료의 캐릭터일 때 { nick, pet(), leave() }
  function createMascot(def, index, count, look = {}) {
    const guest = look.guest || null;
    // 패널보다 낮은 층에 두어 패널을 가리지 않게 한다. 빈 영역 클릭은 페이지로 통과시킨다.
    const W = look.size || (def.pack ? def.pack.size : WIDTH);
    const host = document.createElement('div');
    host.style.cssText = `position:fixed;left:0;bottom:0;width:${W}px;height:${W}px;z-index:${2147483640 + index};pointer-events:none;`;
    host.dataset.hw40 = 'mascot';
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const label = String(look.name || def.label).replace(/[<>&"]/g, '');
    const figure = def.pack
      ? `<div id="jump"><div id="sprite" role="img" aria-label="${label}" title="${label}"></div></div>`
      : `<svg viewBox="0 0 64 64" width="${W}" height="${W}" role="img" aria-label="${label}"><title>${label}</title>${def.art}${CONFETTI}</svg>`;
    shadow.innerHTML = `
      <style>${STYLE}</style>
      <div id="bubble" hidden style="bottom:${W + (guest ? 26 : 6)}px${guest ? ';white-space:normal;width:max-content;max-width:220px' : ''}"></div>
      <div id="card" style="width:${W}px;height:${W}px">
        <div id="paper" style="width:${Math.round(W * 1.25)}px;height:${Math.round(W * 1.4)}px;margin-left:${-Math.round(W * 0.625)}px" title="눌러서 풀어 주기"></div>
        <div id="flip" style="width:${W}px;height:${W}px;position:relative">${figure}</div>
      </div>
      ${guest ? `<div id="tag" class="${guest.self ? 'self' : ''}" style="bottom:${W + 2}px">${String(guest.nick).replace(/[<>&"]/g, '')}</div>` : ''}
      <div id="emote" style="bottom:${W - 10}px"></div>
      <div id="bondtag" hidden style="bottom:${W + 4}px"></div>
      <div id="ring" hidden style="bottom:${Math.round(W / 2)}px"></div>`;
    const flip = shadow.getElementById('flip');
    const card = shadow.getElementById('card');
    const paper = shadow.getElementById('paper');
    const bubble = shadow.getElementById('bubble');
    const svg = shadow.querySelector('svg');
    const sprite = shadow.getElementById('sprite');
    const ring = shadow.getElementById('ring');
    const emoteEl = shadow.getElementById('emote');
    const bondTag = shadow.getElementById('bondtag');
    const figureEl = svg || sprite;
    const render = def.pack ? createSpriteRenderer(def.pack, sprite) : null;
    if (def.pack && !def.pack.bounce) flip.classList.add('nobounce');

    const m = {
      id: def.id,
      guest,
      name: label,
      w: W,
      def,
      chaser: Boolean(def.chaser),
      host,
      x: (maxX(W) * (index + Math.random())) / count,
      dir: Math.random() < 0.5 ? 1 : -1,
      action: 'walk',
      actionUntil: 0,
      skit: null,
      spokenUntil: 0,
      bubbleAlign: null,
      bubbleOffset: 0,
      hopping: false,
      fleeUntil: 0,
      chase: null,
      chaseUntil: 0,
      meetUntil: 0,
      hopKind: 'hop',
      y: 0, // 바닥에서 떠 있는 높이 (잡혀 있거나 떨어질 때)
      vy: 0,
      dragging: false,
      falling: false,
      landUntil: 0,
      menuOpen: false,
    };
    // 지금 땅에서 평소처럼 움직일 수 있는지 (만남·쫓기 판정에 쓴다)
    m.free = () => !m.dragging && !m.falling && m.y === 0 && !m.menuOpen && !m.phase;
    m.phase = null; // 종이 연출 중: escape(빠져나옴) · trap(갇힘) · fly(날아감) · exiled(유배) · return(돌아옴)
    m.exiledAt = 0;

    // ---------- 종이 ----------
    const timers = [];
    const later = (ms, fn) => timers.push(setTimeout(fn, ms));
    const setPaper = (...names) => {
      paper.className = '';
      if (names.length) {
        void paper.offsetWidth; // 같은 애니메이션을 다시 시작하게 한다
        paper.classList.add(...names);
      }
    };
    const setFlat = (name) => {
      flip.classList.remove('flat', 'stuck', 'popout');
      if (name) {
        void flip.offsetWidth;
        flip.classList.add(...name.split(' '));
      }
    };
    // 종이에서 톡 튀어나온다 (처음 나올 때, 풀려날 때).
    m.escape = (delay = 0, line = null) => {
      m.phase = 'escape';
      setPaper('on');
      setFlat('flat');
      later(delay + 450, () => {
        setPaper('away');
        setFlat('popout');
        if (line) m.say(line, 1400);
      });
      later(delay + 1050, () => {
        setPaper();
        setFlat(null);
        m.phase = null;
        m.action = 'idle';
        m.actionUntil = performance.now() + 600;
      });
    };
    // 가두기: 종이가 스르륵 → 촥 붙고 → 왼쪽 벽으로 날아가 유배
    m.trap = () => {
      m.closeMenu();
      m.skit = null;
      m.chase = null;
      m.phase = 'trap';
      m.say('어?', 700);
      setPaper('show');
      later(380, () => {
        setFlat('flat stuck');
        m.say('촥!', 900);
      });
      later(1000, () => {
        bubble.hidden = true;
        m.spokenUntil = 0;
        m.phase = 'fly';
        m.exiledAt = Date.now();
        setPaper('on');
        exiled.add(m);
        layoutExile(m);
        saveExiled();
      });
      later(1950, () => {
        m.phase = 'exiled';
        // 날아오며 한 바퀴 돈 각도를 같은 모양의 각도로 되돌린다 (다음 자리 이동 때 거꾸로 돌지 않게).
        host.style.transition = 'none';
        host.style.transform = host.style.transform.replace(/rotate\((-?[\d.]+)deg\)/, (_, a) => `rotate(${Number(a) + 360}deg)`);
        setPaper('exiled');
        card.classList.add('sway');
      });
    };
    // 유배된 채로 바로 놓기 (새로고침 뒤)
    m.placeExiled = () => {
      m.phase = 'exiled';
      m.exiledAt = m.exiledAt || Date.now();
      setPaper('exiled');
      setFlat('flat');
      card.classList.add('sway');
    };
    // 풀어 주기: 바닥으로 내려와서 탈출
    m.releaseFromExile = () => {
      if (m.phase !== 'exiled') return;
      m.phase = 'return';
      card.classList.remove('sway');
      exiled.delete(m);
      saveExiled();
      m.x = Math.random() * clearMaxX(W);
      m.y = 0;
      host.style.transition = 'transform .6s cubic-bezier(.4,0,.3,1.2)';
      host.style.transform = `translate(${m.x}px, 0) rotate(0deg) scale(1)`;
      layoutExile();
      later(650, () => {
        host.style.transition = '';
        m.escape(0, '탈출!');
      });
    };
    // 손님이 돌아갈 때: 종이에 촥 붙어서 화면 밖으로 날아간다.
    m.goHome = (line, done) => {
      if (m.departing) return;
      m.departing = true;
      // 아직 끝나지 않은 등장 연출이 나중에 끼어들지 않게 멈춘다.
      timers.forEach(clearTimeout);
      timers.length = 0;
      m.chatUntil = 0;
      m.closeMenu();
      m.skit = null;
      m.chase = null;
      m.dragging = false;
      m.falling = false;
      m.y = 0;
      m.phase = 'trap';
      m.say(line || '안녕~', 900);
      setPaper('show');
      later(380, () => setFlat('flat stuck'));
      later(950, () => {
        m.phase = 'home';
        bubble.hidden = true;
        setPaper('on');
        m.exiledAt = Date.now();
        exiled.add(m);
        layoutExile(m);
      });
      later(1950, () => card.classList.add('sway'));
      later(1950 + WALL_STAY_MS, () => {
        exiled.delete(m);
        host.style.transition = 'opacity .6s ease-in';
        host.style.opacity = '0';
        layoutExile();
      });
      later(1950 + WALL_STAY_MS + 650, () => {
        m.cleanup();
        host.remove();
        if (done) done();
      });
    };
    m.cleanup = () => timers.forEach(clearTimeout);
    // 유배된 종이 어디를 눌러도 풀려난다.
    paper.addEventListener('pointerdown', (e) => {
      if (m.phase !== 'exiled' || e.button !== 0) return;
      e.preventDefault();
      m.releaseFromExile();
    });

    m.hop = (kind = 'hop') => {
      if (m.hopping) return;
      m.hopping = true;
      m.hopKind = kind;
      flip.classList.add('hop');
      setTimeout(() => {
        flip.classList.remove('hop');
        m.hopping = false;
      }, 600);
    };

    // ---------- 상호작용 연기 ----------
    // actBase: 지금 자세(쓰러져 있음·자리 옮김 등). 동작은 이 자세에서 시작한다. toward: 상대 쪽 방향(1 오른쪽, -1 왼쪽)
    m.actBase = BONDS ? BONDS.fullPose() : null;
    m.actAnim = null;
    // 옆으로 누우면 바닥 아래로 파묻히지 않게 기운 만큼 들어 올린다
    const poseCss = (p, toward) => `translate(${p.x * toward}px, ${-(p.y + Math.abs(Math.sin((p.r * Math.PI) / 180)) * W * 0.42)}px) rotate(${p.r * toward}deg) scale(${p.sx}, ${p.sy})`;
    // still: 이 아이의 동작 그림에 몸 움직임까지 담겨 있어서 자리(x·y)만 옮기고 기울이거나 늘이지 않는다
    m.actMove = (mv, toward, ms = mv.ms, still = false) => {
      const base = m.actBase;
      const n = mv.keys.length;
      const poses = mv.keys.map((k, i) => {
        if (mv.abs) return i === 0 ? base : BONDS.fullPose(k);
        const p = BONDS.fullPose(k);
        return { x: base.x + p.x, y: base.y + p.y, r: base.r + p.r, sx: base.sx * p.sx, sy: base.sy * p.sy };
      });
      if (still) for (const p of poses) Object.assign(p, { r: base.r, sx: base.sx, sy: base.sy });
      if (mv.shift && !mv.abs) {
        const sh = BONDS.fullPose(mv.shift);
        poses[n - 1] = { x: base.x + sh.x, y: base.y + sh.y, r: base.r + sh.r, sx: base.sx * sh.sx, sy: base.sy * sh.sy };
      }
      const frames = poses.map((p, i) => ({
        offset: i === 0 ? 0 : i === n - 1 ? 1 : mv.keys[i].t !== undefined ? mv.keys[i].t : i / (n - 1),
        transform: poseCss(p, toward),
        easing: 'ease-in-out',
      }));
      if (m.actAnim) m.actAnim.cancel();
      m.actAnim = card.animate(frames, { duration: ms, fill: 'forwards' });
      if (mv.abs || mv.shift) m.actBase = poses[n - 1];
    };
    // 이 아이만의 동작 그림: 팩에 act_<동작> 그림이 있으면 그 박자 동안 그 그림을 보여준다
    m.artOf = (move, kind = 'act') => (def.pack && def.pack.animations[`${kind}_${move}`]) || null;
    m.artState = null;
    m.artUntil = 0;
    m.playArt = (move, ms) => {
      if (!render || !m.artOf(move)) return false;
      render('idle', performance.now(), m.dir); // 같은 그림이 이어져도 처음부터 다시
      m.artState = `act_${move}`;
      m.artUntil = performance.now() + ms;
      return true;
    };
    // 합동 그림이 나오는 동안 몸을 숨긴다
    m.hideBody = (hide) => { flip.style.visibility = hide ? 'hidden' : ''; };
    // 연기를 마친다: 옮긴 자리는 실제 자리로 바꾸고 몸은 원래대로
    m.actEnd = (toward) => {
      if (m.actAnim) m.actAnim.cancel();
      m.actAnim = null;
      card.style.transform = '';
      if (m.actBase) {
        m.x = Math.min(Math.max(m.x + m.actBase.x * toward, 0), maxX(W));
        if (m.actBase.sx < 0) m.dir = -toward;
      }
      m.actBase = BONDS ? BONDS.fullPose() : null;
      m.artState = null;
      m.hideBody(false);
    };

    // ---------- 우호도 표현 ----------
    // 머리 옆에 마음 표시가 톡 떠올랐다 사라진다.
    m.emote = (mark) => {
      if (!mark || m.isAway) return;
      emoteEl.textContent = mark;
      emoteEl.classList.remove('show');
      void emoteEl.offsetWidth; // 같은 애니메이션을 다시 시작하게 한다
      emoteEl.classList.add('show');
    };
    // "사이 보기": 머리 위에 이름표와 사이를 잠깐 띄운다. 이름표가 떠 있는 동안 말풍선은 숨긴다.
    let tagTimer = 0;
    m.showTag = ({ name, mark = '', label = '', color = '#8a7d68', ms = 6000, me = false, num = 0 }) => {
      bondTag.textContent = name;
      if (num) {
        const i = document.createElement('i');
        i.textContent = num;
        bondTag.prepend(i);
      }
      bondTag.classList.toggle('num', Boolean(num));
      if (label) {
        const b = document.createElement('b');
        b.textContent = `${mark} ${label}`;
        bondTag.appendChild(b);
      }
      bondTag.style.setProperty('--tc', color);
      bondTag.classList.toggle('me', me);
      bondTag.hidden = false;
      m.spokenUntil = 0;
      clearTimeout(tagTimer);
      tagTimer = setTimeout(() => { bondTag.hidden = true; }, ms);
    };
    m.tagShown = () => !bondTag.hidden;
    m.hideTag = () => {
      clearTimeout(tagTimer);
      bondTag.hidden = true;
      m.highlight(false);
    };
    // 사이 팝업에서 고른 아이를 반짝이게 한다.
    m.highlight = (on) => {
      card.classList.toggle('hl', on);
      bondTag.classList.toggle('hl', on);
    };
    m.size = W;
    // 팝업에 넣을 작은 그림: 지금 모습을 그대로 복사한다.
    m.thumb = () => {
      const c = figureEl.cloneNode(true);
      for (const k of [...c.classList]) if (k.startsWith('motion-')) c.classList.remove(k);
      c.removeAttribute('title');
      c.style.pointerEvents = 'none';
      c.style.cursor = 'default';
      if (c.tagName.toLowerCase() === 'svg') {
        c.setAttribute('width', '100%');
        c.setAttribute('height', '100%');
      }
      return c;
    };
    // 자리 비움(모이기 방): 연결이 끊겨 서버가 자리를 비워 둔 동안 💤를 띄우고 흐리게 한다.
    // 잠깐 끊겼다 바로 붙는 경우에는 깜빡이지 않게 4초 뒤에야 띄운다.
    let awayTimer = 0;
    m.isAway = false;
    m.setAway = (on) => {
      clearTimeout(awayTimer);
      if (!on) {
        m.isAway = false;
        emoteEl.classList.remove('zz');
        card.style.opacity = '';
        return;
      }
      awayTimer = setTimeout(() => {
        m.isAway = true;
        emoteEl.textContent = '💤';
        emoteEl.classList.remove('show');
        emoteEl.classList.add('zz');
        card.style.opacity = '.55';
      }, 4000);
    };
    // 이름표가 떠 있는 동안 말풍선을 이름표 위로 올린다 (사이 보기에서 고른 아이가 말할 때).
    let liftTimer = 0;
    const bubbleBottom = bubble.style.bottom;
    m.liftBubble = (ms) => {
      bubble.style.bottom = `${parseFloat(bubbleBottom) + 22}px`;
      clearTimeout(liftTimer);
      liftTimer = setTimeout(() => { bubble.style.bottom = bubbleBottom; }, ms);
    };
    m.fumeUntil = 0; // 이때까지 부들부들 (앙숙과 싸울 때)
    m.follow = null; // 단짝을 따라 걷기 { leader, from, until }
    m.walkAway = (dir, ms, now) => {
      m.skit = null;
      m.action = 'walk';
      m.actionUntil = now + ms;
      m.dir = dir;
    };

    function showBubble(text) {
      if (bubble.textContent !== text) bubble.textContent = text;
      bubble.hidden = false;
      // 말풍선이 화면 밖으로 나가지 않도록 화면 중앙 기준으로 정렬 방향을 정한다.
      const leftAligned = m.bubbleAlign ? m.bubbleAlign === 'left' : m.x < window.innerWidth / 2;
      bubble.style.left = leftAligned ? `${m.bubbleOffset}px` : 'auto';
      bubble.style.right = leftAligned ? 'auto' : `${m.bubbleOffset}px`;
    }

    m.chatUntil = 0;
    m.say = (text, ms, align = null, offset = 0) => {
      // 사람이 직접 한 말(채팅)이 떠 있는 동안은 다른 대사로 덮지 않는다.
      if (performance.now() < m.chatUntil) return;
      m.bubbleAlign = align;
      m.bubbleOffset = offset;
      showBubble(text);
      m.spokenUntil = performance.now() + ms;
    };

    // 놀러 가기에서 사람이 적은 말
    m.chat = (text) => {
      const ms = Math.max(3000, text.length * 180);
      m.chatUntil = 0;
      m.say(text, ms);
      m.chatUntil = performance.now() + ms;
    };

    m.playSkit = (name, now = performance.now()) => {
      const { ms, text, sayAt } = def.skits[name];
      m.skit = name;
      m.action = 'skit';
      m.actionUntil = now + ms;
      setTimeout(() => {
        if (m.skit === name) m.say(text, ms - sayAt);
      }, sayAt);
    };

    m.pause = (ms, now) => {
      m.skit = null;
      m.action = 'idle';
      m.actionUntil = now + ms;
    };

    // 괴물에게 쫓길 때. 반대쪽으로 빠르게 도망간다.
    m.flee = (from, now) => {
      m.skit = null;
      m.action = 'walk';
      m.actionUntil = now + FLEE_MS;
      m.fleeUntil = now + FLEE_MS;
      m.dir = m.x < from.x ? -1 : 1;
      if ((m.dir < 0 && m.x <= 0) || (m.dir > 0 && m.x >= maxX(W))) m.dir = -m.dir;
      m.say('으악!', 1500);
      m.hop();
    };

    m.startChase = (target, now) => {
      m.skit = null;
      m.action = 'walk';
      m.chase = target;
      m.chaseUntil = now + CHASE_GIVE_UP_MS;
      m.say('어흥!', 1500);
    };

    function nextAction(now) {
      if (m.chase) {
        m.actionUntil = now + 500;
        return;
      }
      m.skit = null;
      if (m.action === 'walk' && Math.random() < def.pauseChance) {
        const names = Object.keys(def.skits);
        if (names.length && m.x <= clearMaxX(W) && Math.random() < 0.6) {
          m.playSkit(names[Math.floor(Math.random() * names.length)], now);
          return;
        }
        m.action = 'idle';
        m.actionUntil = now + 1500 + Math.random() * 2000;
        if (Math.random() < 0.3) m.hop();
      } else {
        m.action = 'walk';
        m.actionUntil = now + 4000 + Math.random() * 6000;
        if (Math.random() < 0.25) m.dir = -m.dir;
      }
    }

    const remainingText = () => {
      const r = api.latest;
      const left = r && typeof r.remaining === 'number' ? Math.max(0, r.remaining) : null;
      return left === null ? '안녕!' : left === 0 ? '40시간 달성!' : `${formatDuration(left)} 남았어`;
    };
    const pick = (list) => list[Math.floor(Math.random() * list.length)];

    // ---------- 클릭 메뉴 ----------
    // 캐릭터를 누르면 위쪽 반원으로 동그란 말풍선 버튼이 펼쳐진다.
    let menuTimer = 0;
    function menuActions() {
      const skitNames = Object.keys(def.skits);
      if (guest) {
        return [
          ...(guest.pet ? [{ icon: '💗', label: '쓰다듬기', run: () => { m.say(pick(['헤헤', '좋아~', '♥']), 1800); m.hop('hop'); guest.pet(); } }] : []),
          { icon: '🤸', label: '점프', run: () => { m.hop('click'); m.say(pick(['얍!', '홉!', '뿅!']), 1200); } },
          ...(skitNames.length ? [{ icon: '⭐', label: '특기', run: () => m.playSkit(pick(skitNames)) }] : []),
          ...(guest.change ? [{ icon: '👕', label: '갈아입기', run: () => guest.change() }] : []),
          ...(guest.leave ? [{ icon: '👋', label: '내보내기', run: () => guest.leave() }] : []),
        ];
      }
      return [
        { icon: '⏱', label: '남은 시간', run: () => m.say(remainingText(), 3000) },
        { icon: '📄', label: '가두기', run: () => m.trap() },
        { icon: '🤸', label: '점프', run: () => { m.hop('click'); m.say(pick(['얍!', '홉!', '뿅!']), 1200); } },
        { icon: '💗', label: '쓰다듬기', run: () => { m.say(pick(['헤헤', '좋아~', '♥', '기분 좋다']), 1800); m.hop('hop'); } },
        {
          icon: '🍪',
          label: '간식 주기',
          run: () => {
            if (def.skits.eat) m.playSkit('eat');
            else m.say(pick(['냠냠!', '맛있다!', '고마워!']), 1800);
          },
        },
        ...(skitNames.length ? [{ icon: '⭐', label: '특기', run: () => m.playSkit(pick(skitNames)) }] : []),
        ...(m.bondKey ? [{ icon: '💞', label: '사이 보기', run: () => showBonds(m) }] : []),
      ];
    }
    m.closeMenu = () => {
      if (!m.menuOpen) return;
      m.menuOpen = false;
      ring.hidden = true;
      ring.replaceChildren();
      clearTimeout(menuTimer);
    };
    function openMenu() {
      m.menuOpen = true;
      m.skit = null;
      m.chase = null;
      bubble.hidden = true;
      m.spokenUntil = 0;
      const actions = menuActions();
      const radius = Math.max(46, W / 2 + 26);
      // 위쪽 반원(왼쪽 → 오른쪽)에 고르게 놓는다. 화면 가장자리에서는 버튼을 안쪽으로 당긴다.
      const centerX = m.x + W / 2;
      ring.replaceChildren(
        ...actions.map((a, i) => {
          const angle = Math.PI - (Math.PI * (i + 0.5)) / actions.length;
          let dx = Math.cos(angle) * radius;
          const dy = -Math.sin(angle) * radius;
          dx = Math.min(Math.max(dx, 24 - centerX), window.innerWidth - 24 - centerX);
          const b = document.createElement('button');
          b.textContent = a.icon;
          b.dataset.label = a.label;
          b.setAttribute('aria-label', a.label);
          b.style.left = `${dx}px`;
          b.style.top = `${dy}px`;
          b.style.setProperty('--fx', `${-dx}px`);
          b.style.setProperty('--fy', `${-dy}px`);
          b.style.animationDelay = `${i * 30}ms`;
          b.onclick = (e) => {
            e.stopPropagation();
            m.closeMenu();
            a.run();
          };
          return b;
        })
      );
      ring.hidden = false;
      clearTimeout(menuTimer);
      menuTimer = setTimeout(m.closeMenu, MENU_IDLE_MS);
    }
    m.openMenu = openMenu;

    // ---------- 드래그 ----------
    // 누른 채 끌면 마우스를 따라오고, 놓으면 "으아아아" 떨어져서 "콩" 착지한다. 조금만 움직였으면 클릭으로 본다.
    let press = null;
    figureEl.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      // 종이 연출 중에는 잡을 수 없다. 유배된 종이는 누르면 풀려난다.
      if (m.phase) {
        e.preventDefault();
        if (m.phase === 'exiled') m.releaseFromExile();
        return;
      }
      e.preventDefault();
      press = { id: e.pointerId, sx: e.clientX, sy: e.clientY, gx: e.clientX - m.x, gy: window.innerHeight - e.clientY - m.y };
      try {
        figureEl.setPointerCapture(e.pointerId);
      } catch {
        // 포인터 캡처를 못 해도 같은 요소 위에서는 동작한다.
      }
    });
    figureEl.addEventListener('pointermove', (e) => {
      if (!press || e.pointerId !== press.id) return;
      if (!m.dragging) {
        if (Math.hypot(e.clientX - press.sx, e.clientY - press.sy) < DRAG_START_PX) return;
        m.closeMenu();
        m.dragging = true;
        m.falling = false;
        m.skit = null;
        m.chase = null;
        m.fleeUntil = 0;
        m.say(pick(['어어?!', '앗!', '놔줘~', '어디 가?']), 1500);
      }
      m.x = Math.min(Math.max(e.clientX - press.gx, 0), maxX(W));
      m.y = Math.min(Math.max(window.innerHeight - e.clientY - press.gy, 0), window.innerHeight - W);
    });
    const release = (e) => {
      if (!press || e.pointerId !== press.id) return;
      const wasDrag = m.dragging;
      press = null;
      if (!wasDrag) {
        if (e.type === 'pointercancel') return;
        if (m.menuOpen) m.closeMenu();
        else openMenu();
        return;
      }
      m.drop();
    };
    // 놓으면 떨어진다. 이미 땅이면 바로 착지한다.
    m.drop = () => {
      m.dragging = false;
      m.falling = true;
      m.vy = 0;
      if (m.y > SCREAM_HEIGHT) m.say('으아아아!', 5000);
    };
    figureEl.addEventListener('pointerup', release);
    figureEl.addEventListener('pointercancel', release);

    // 축하·휴식 때 서는 자리. 겹치지 않게 패널 왼쪽 공간을 나눠 쓴다.
    const slot = () => (clearMaxX(W) * (index + 1)) / (count + 1);

    // 지금 상황에 맞는 애니메이션 트리거 이름
    function stateFor(now, mood, moving) {
      if (m.dragging) return 'drag';
      if (m.falling) return 'fall';
      if (now < m.landUntil) return 'land';
      if (m.menuOpen) return 'idle';
      if (mood === 'celebrate' || mood === 'rest') return m.hopping ? m.hopKind : moving ? 'hurry' : mood;
      if (mood === 'hurry') return 'hurry';
      if (now < m.fleeUntil) return 'flee';
      if (m.chase) return 'chase';
      if (m.hopping) return m.hopKind;
      if (m.skit) return m.skit;
      if (now < m.meetUntil) return 'meet';
      return moving ? 'walk' : 'idle';
    }

    // 잡혀 있거나 떨어지는 중이거나 막 착지했을 때: 평소 움직임 대신 이것만 한다.
    function updateAir(now, dt) {
      if (m.falling) {
        m.vy += GRAVITY * dt;
        m.y = Math.max(0, m.y - m.vy * dt);
        if (m.y === 0) {
          m.falling = false;
          m.landUntil = now + LAND_MS;
          m.say('콩!', 1300);
          flip.classList.remove('land');
          void flip.offsetWidth; // 같은 애니메이션을 다시 시작하게 한다
          flip.classList.add('land');
          setTimeout(() => flip.classList.remove('land'), LAND_MS);
          m.action = 'idle';
          m.actionUntil = now + LAND_MS + 600;
        }
      }
      flip.classList.toggle('dragged', m.dragging);
      flip.classList.toggle('falling', m.falling);
      flip.classList.toggle('walk', m.falling);
      flip.classList.toggle('fast', m.falling);
      flip.classList.toggle('idle', !m.falling);
      flip.classList.remove('party', 'hop');
      for (const name of Object.keys(def.skits)) flip.classList.remove(`skit-${name}`);
      host.style.transform = `translate(${m.x}px, ${-m.y}px)`;
      const facing = render ? render(stateFor(now, 'normal', false), now, m.dir) : m.dir;
      flip.style.transform = `scaleX(${facing})`;
      if (now < m.spokenUntil) showBubble(bubble.textContent);
      else bubble.hidden = true;
    }

    m.update = (now, dt, mood) => {
      if (m.phase) {
        // 종이 연출 중: 위치는 연출이 정하고, 그림만 넘긴다.
        if (m.phase === 'escape' || m.phase === 'act') host.style.transform = `translate(${m.x}px, 0)`;
        const stepping = m.phase === 'act' && now < m.actWalkUntil;
        flip.classList.remove('party', 'hop', 'fast', 'angry');
        flip.classList.toggle('walk', stepping);
        flip.classList.toggle('idle', !stepping);
        const art = m.phase === 'act' && m.artState && now < m.artUntil ? m.artState : null;
        const facing = render ? render(art || (stepping ? 'walk' : 'idle'), now, m.dir) : m.dir;
        flip.style.transform = `scaleX(${facing})`;
        if (m.phase === 'escape' || m.phase === 'trap' || m.phase === 'act') {
          if (now < m.spokenUntil) showBubble(bubble.textContent);
          else bubble.hidden = true;
        } else bubble.hidden = true;
        return;
      }
      if (m.dragging || m.falling || now < m.landUntil) {
        updateAir(now, dt);
        return;
      }
      if (m.menuOpen) {
        // 메뉴가 열려 있는 동안은 제자리에 서 있는다.
        m.action = 'idle';
        m.actionUntil = now + 1000;
      }
      let moving = false;
      let speed = def.speed;
      let target = null;

      if (mood !== 'normal') {
        m.chase = null;
        m.fleeUntil = 0;
      }
      if (mood !== 'normal' && m.skit) {
        m.skit = null;
        m.action = 'walk';
        m.actionUntil = 0;
      }

      if (mood === 'hurry') {
        moving = true;
        speed = def.speed * HURRY_FACTOR;
      } else if (mood === 'normal') {
        if (now >= m.actionUntil) nextAction(now);
        const skitMoves = m.skit && def.skits[m.skit].moving;
        moving = m.action === 'walk' || Boolean(skitMoves);
        if (skitMoves) speed = def.speed * HURRY_FACTOR;
        if (now < m.fleeUntil) {
          moving = true;
          speed = def.speed * HURRY_FACTOR;
        }
        if (m.chase) {
          if (now > m.chaseUntil || m.chase.host.hidden) {
            m.chase = null;
            m.say('칫…', 1500);
            m.pause(1500, now);
          } else if (!m.chase.free()) {
            // 잡으려던 상대가 들려 올라갔다.
            m.chase = null;
            m.say('어라?', 1500);
            m.pause(1500, now);
          } else if (Math.abs(m.chase.x - m.x) < ((W + m.chase.w) / 2) * 0.7) {
            m.chase.flee(m, now);
            bondCatch(m, m.chase, now);
            m.chase = null;
            m.say('헤헤', 1500);
            m.pause(1800, now);
            moving = false;
          } else {
            moving = true;
            speed = def.speed * 2;
            target = m.chase.x;
          }
        }
        // 단짝 따라 걷기: 단짝 옆자리로 가서 같이 움직이고, 다다르면 단짝 쪽을 본다.
        if (m.follow && !m.chase) {
          const f = m.follow;
          if (now > f.until || !f.leader.free() || f.leader.host.hidden || exiled.has(f.leader)) m.follow = null;
          else if (now >= f.from) {
            const gap = ((W + f.leader.w) / 2) * 0.85;
            const spot = Math.min(Math.max(f.leader.x + (m.x < f.leader.x ? -gap : gap), 0), maxX(W));
            m.skit = null;
            if (Math.abs(spot - m.x) > 3) {
              moving = true;
              target = spot;
              speed = Math.max(def.speed, f.leader.def.speed) * 1.3;
            } else {
              moving = false;
              m.dir = f.leader.x > m.x ? 1 : -1;
            }
          }
        }
      } else if (Math.abs(m.x - slot()) > 1) {
        moving = true;
        speed = def.speed * HURRY_FACTOR;
        target = slot();
      }

      if (moving && !reducedMotion) {
        const step = speed * dt;
        if (target !== null) {
          m.dir = target > m.x ? 1 : -1;
          m.x += m.dir * Math.min(step, Math.abs(target - m.x));
        } else {
          m.x += m.dir * step;
          if (m.x <= 0) m.dir = 1;
          if (m.x >= maxX(W)) m.dir = -1;
        }
      }
      m.x = Math.min(Math.max(m.x, 0), maxX(W));

      flip.classList.toggle('walk', moving);
      flip.classList.toggle('fast', mood !== 'normal' && moving);
      flip.classList.toggle('idle', !moving);
      flip.classList.toggle('party', mood === 'celebrate');
      flip.classList.toggle('angry', now < m.fumeUntil);
      for (const name of Object.keys(def.skits)) {
        flip.classList.toggle(`skit-${name}`, m.skit === name);
      }
      host.style.transform = `translate(${m.x}px, 0)`;
      const facing = render ? render(stateFor(now, mood, moving), now, m.dir) : m.dir;
      flip.style.transform = `scaleX(${facing})`;

      if (now < m.spokenUntil) {
        showBubble(bubble.textContent);
      } else {
        m.bubbleAlign = null;
        m.bubbleOffset = 0;
        if (mood === 'celebrate') showBubble(def.partyLine);
        else if (mood === 'rest') showBubble(def.restLine);
        else bubble.hidden = true;
      }
    };

    return m;
  }

  // ---------- 테마 ----------
  // 기본: 지금 배포된 캐릭터 그대로. 공용: 저장소 themes/ 폴더. 내 테마: 공유 코드로 추가한 것.
  // 저장된 내 캐릭터를 읽어 캐릭터 목록을 다시 만든다. 이 버전에서 읽을 수 없는 캐릭터는 건너뛴다.
  function loadMyChars() {
    const saved = readJson(MY_CHARS_KEY, []);
    myDefs = [];
    for (const spec of Array.isArray(saved) ? saved : []) {
      try {
        myDefs.push({ ...packDef(CHAR_RULES.normalizeCharacter(spec)), mine: true });
      } catch {
        // 깨진 캐릭터는 목록에서 숨긴다 (지우지는 않는다).
      }
    }
    CATALOG = new Map([...BASE_CATALOG, ...myDefs].map((d) => [d.id, d]));
    knownIds = new Set(CATALOG.keys());
  }
  if (CHAR_RULES) loadMyChars();
  else {
    CATALOG = new Map(BASE_CATALOG.map((d) => [d.id, d]));
    knownIds = new Set(CATALOG.keys());
  }

  // 기본 테마: 배포된 기본 캐릭터 그대로 (내 캐릭터는 테마를 고쳐서 넣는다)
  const defaultTheme = () => ({ key: 'default', name: '기본', source: 'default', cast: CHARACTERS.map((d) => ({ id: d.id })) });
  const sharedThemes = (PACKS.themes || []).map((t) => ({ key: `shared:${t.id}`, name: t.name, source: 'shared', cast: t.cast, bonds: t.bonds, acts: t.acts }));

  function myThemes() {
    const saved = readJson(THEMES_KEY, []);
    if (!Array.isArray(saved)) return [];
    const out = [];
    for (const t of saved) {
      try {
        const { theme } = THEME_RULES.normalizeTheme(t, knownIds);
        out.push({ key: `mine:${t.key}`, name: theme.name, source: 'mine', cast: theme.cast, bonds: theme.bonds, acts: theme.acts, savedKey: t.key });
      } catch {
        // 이 버전에서 쓸 수 없는 테마는 목록에서 숨긴다 (지우지는 않는다).
      }
    }
    return out;
  }
  const allThemes = () => [defaultTheme(), ...sharedThemes, ...myThemes()];
  const findTheme = (key) => allThemes().find((t) => t.key === key) || defaultTheme();

  const savedThemes = () => {
    const saved = readJson(THEMES_KEY, []);
    return Array.isArray(saved) ? saved.filter((t) => t && typeof t.key === 'string') : [];
  };

  let mascots = [];
  let off = readOff();
  const applyOff = () => [...mascots, ...guests].forEach((m) => { m.host.hidden = off; });

  // ---------- 유배 ----------
  // 가둔 캐릭터는 왼쪽 벽에 작은 종이로 쌓인다. 새로고침해도 그대로 남는다 (캐릭터 id로 기억).
  const exiled = new Set();
  function saveExiled() {
    // 방에서는 저장하지 않는다 (방장의 캐릭터를 가둔 것이 내 테마에 남지 않게). 아바타·떠나는 캐릭터도 뺀다.
    if (roomCast) return;
    writeValue(EXILE_KEY, [...exiled].filter((m) => !m.guest && !m.departing).sort((a, b) => a.exiledAt - b.exiledAt).map((m) => m.id));
  }
  // 유배된 종이들의 자리를 정한다. flying: 지금 막 날아가는 캐릭터 (한 바퀴 돌며 날아간다)
  function layoutExile(flying = null) {
    const list = [...exiled].sort((a, b) => a.exiledAt - b.exiledAt);
    let y = 96;
    let x = 10;
    list.forEach((m, i) => {
      const h = m.w * 1.4 * EXILE_SCALE;
      if (y + h > window.innerHeight - 20) {
        y = 96;
        x += m.w * 1.25 * EXILE_SCALE + 10;
      }
      // 크기를 줄이면 가운데를 기준으로 줄어드므로 그만큼 당겨 놓는다.
      const shrink = (m.w * (1 - EXILE_SCALE)) / 2;
      const angle = [-6, 4, -2, 6][i % 4];
      const spin = m === flying ? angle - 360 : angle;
      m.host.style.transition = m === flying ? 'transform .9s cubic-bezier(.5,-0.25,.35,1)' : 'transform .4s ease';
      m.host.style.transform = `translate(${x - shrink}px, ${-(y - shrink)}px) rotate(${spin}deg) scale(${EXILE_SCALE})`;
      if (m !== flying) setTimeout(() => { if (m.phase === 'exiled') m.host.style.transition = ''; }, 420);
      y += h + 8;
    });
  }

  // ---------- 우호도 ----------
  // 테마마다 그 테마 아이들끼리의 사이를 저장한다 { [테마 key]: { "아이1|아이2": 값 } }. 이 브라우저에만 남는다.
  // 미리 보기(테마 만들기 화면)처럼 key가 없는 테마는 저장하지 않고 그때만 쓴다.
  const BONDS_KEY = 'hw40-bonds';
  let bondTheme = null; // 지금 사이를 쓰는 테마 key (null: 저장 안 함)
  let bondMap = {};
  // 지금 테마의 상호작용 목록 (테마에 없으면 기본 틀)
  let actList = BONDS ? BONDS.ACT_TEMPLATES : [];
  function loadBonds(theme) {
    if (!BONDS) return;
    bondTheme = theme.key || null;
    const all = readJson(BONDS_KEY, {});
    const stored = bondTheme && all && typeof all === 'object' ? all[bondTheme] : null;
    const members = mascots.filter((m) => m.bondKey).map((m) => ({ key: m.bondKey, id: m.id }));
    // 새로 들어온 아이와의 사이는 처음 값으로 생기고, 빠진 아이의 사이는 지워진다.
    bondMap = BONDS.syncBonds(stored, members, theme.bonds);
    saveBonds();
  }
  function saveBonds() {
    if (!bondTheme) return;
    const all = readJson(BONDS_KEY, {});
    writeValue(BONDS_KEY, { ...(all && typeof all === 'object' && !Array.isArray(all) ? all : {}), [bondTheme]: bondMap });
  }
  const bondable = (m) => Boolean(BONDS && m.bondKey && !m.guest && mascots.includes(m));
  // "몽실이랑", "호두랑", "콩떡이 1이랑": 이름 끝 받침에 맞춰 랑/이랑을 붙인다 (숫자는 읽는 소리로).
  const rang = (name) => {
    const last = String(name).slice(-1);
    const code = last.charCodeAt(0) - 0xac00;
    const batchim = code >= 0 && code <= 11171 ? code % 28 !== 0 : '013678'.includes(last);
    return `${name}${batchim ? '이랑' : '랑'}`;
  };
  const bondOf = (a, b) => bondMap[BONDS.pairKey(a.bondKey, b.bondKey)];
  // 사이를 바꾸고, 단계가 바뀌면 둘 다 ✨(가까워짐)나 💔(멀어짐)를 띄운다.
  function changeBond(a, b, delta, now) {
    const k = BONDS.pairKey(a.bondKey, b.bondKey);
    if (!Number.isFinite(bondMap[k])) return;
    const r = BONDS.applyDelta(bondMap[k], delta);
    bondMap[k] = r.value;
    saveBonds();
    if (r.changed) {
      const tier = BONDS.TIERS.find((t) => t.key === r.after);
      setTimeout(() => {
        for (const m of [a, b]) m.emote(r.up ? '✨' : '💔');
        const [left, right] = a.x <= b.x ? [a, b] : [b, a];
        if (r.up && tier.key === 'best') left.say('우리 이제 단짝!', 2000);
        else if (!r.up && tier.key === 'rival') left.say('흥, 절교야!', 2000);
        else left.say(`${rang(right.displayName)} ${tier.label} 사이가 됐다`, 2200);
      }, 2400);
    }
    return r;
  }
  // 괴물이 잡았다: 단짝이면 장난으로 받아들여 더 친해지고, 아니면 사이가 조금 나빠진다.
  function bondCatch(chaser, prey, now) {
    if (!bondable(chaser) || !bondable(prey)) return;
    if (bondOf(chaser, prey) >= 60) {
      prey.say('꺄르르, 잡혔다!', 1500);
      prey.emote('♪');
      changeBond(chaser, prey, 2, now);
    } else {
      prey.emote('💦');
      changeBond(chaser, prey, -3, now);
    }
  }

  // "사이 보기": 고른 아이 위에 팝업을 띄워 다른 아이들과의 사이를 한눈에 보여 준다.
  // 팝업이 뜬 뒤 다른 아이들 머리 위에 같은 번호표가 차례로 떠서 누가 누군지 짝지을 수 있다.
  // 팝업의 줄에 마우스를 올리면 그 아이가 반짝이고, 누르면 반짝이며 폴짝 뛴다.
  const POP_CSS = `
    .pop { position: fixed; pointer-events: auto; width: 260px; max-height: calc(100vh - 16px); overflow: auto; box-sizing: border-box;
      background: #fffdf6; color: #3b3226; border: 2px solid #3b3226; border-radius: 14px; box-shadow: 3px 4px 0 rgba(0,0,0,.14);
      font: 12px/1.4 'Malgun Gothic', sans-serif; transform-origin: var(--ox, 50%) 100%; animation: popIn .32s cubic-bezier(.3,1.5,.5,1); }
    .pop.out { animation: popOut .16s ease-in forwards; }
    @keyframes popIn { from { opacity: 0; transform: translateY(10px) scale(.6); } }
    @keyframes popOut { to { opacity: 0; transform: translateY(6px) scale(.85); } }
    header { display: flex; align-items: center; gap: 6px; padding: 8px 8px 6px 10px; border-bottom: 1.5px dashed #d8ccb4; font-weight: 700; }
    header b { font-size: 13px; }
    header b + span { margin-left: -5px; }
    header .x { margin-left: auto; width: 22px; height: 22px; border: 0; border-radius: 11px; background: transparent; color: #8a7d68;
      font: 700 13px/22px sans-serif; cursor: pointer; padding: 0; }
    header .x:hover { background: #f0e8d8; color: #3b3226; }
    .sum { margin: 6px 10px 2px; color: #6b5d48; font-size: 11.5px; }
    ol { list-style: none; margin: 4px 0; padding: 0 4px; }
    li { display: grid; grid-template-columns: 18px 26px 1fr auto 24px; grid-template-rows: auto auto; column-gap: 6px; align-items: center;
      padding: 4px 6px; border-radius: 9px; cursor: pointer; }
    li:hover, li.on { background: #fff1c4; }
    li i { grid-row: 1 / 3; width: 18px; height: 18px; border-radius: 9px; color: #fff; font: 800 11px/18px 'Malgun Gothic', sans-serif;
      text-align: center; font-style: normal; }
    .thumb { grid-row: 1 / 3; width: 26px; height: 26px; display: block; position: relative; overflow: hidden; }
    header .thumb { flex: none; }
    .thumb > * { width: 100% !important; height: 100% !important; animation: none !important; transform: none !important; }
    .nm { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    em { font-style: normal; font-weight: 700; white-space: nowrap; font-size: 11.5px; }
    .bar { grid-column: 3 / 5; position: relative; height: 5px; border-radius: 3px; background: #efe6d4; margin-top: 2px; }
    .bar::after { content: ''; position: absolute; left: 50%; top: -1px; width: 1px; height: 7px; background: #bfb196; }
    .bar u { position: absolute; top: 0; height: 100%; border-radius: 3px; }
    small { display: block; padding: 2px 10px 8px; color: #a39478; font-size: 10.5px; }
    .go { grid-row: 1 / 3; grid-column: 5; width: 24px; height: 24px; border: 1.5px solid #3b3226; border-radius: 12px; background: #fff;
      color: #3b3226; font: 10px/1 sans-serif; padding: 0 0 0 2px; cursor: pointer; box-shadow: 1px 1px 0 rgba(0,0,0,.15); }
    .go:hover { background: #ffe58a; }`;
  let bondPop = null; // 열려 있는 사이 팝업
  function closeBondPop() {
    if (!bondPop) return;
    const p = bondPop;
    bondPop = null;
    p.off();
    for (const t of p.timers) clearTimeout(t);
    for (const o of p.tagged) if (mascots.includes(o)) o.hideTag();
    p.host.shadowRoot.querySelector('.pop').classList.add('out');
    setTimeout(() => p.host.remove(), 170);
  }
  function showBonds(me) {
    if (!bondable(me)) return;
    closeBondPop();
    const others = mascots.filter((o) => o !== me && bondable(o) && !o.phase);
    if (!others.length) {
      me.say('아직 같이 있는 친구가 없어', 2400);
      return;
    }
    const ranked = others.map((o) => ({ o, v: bondOf(me, o) })).sort((x, y) => y.v - x.v);
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    const parts = [];
    if (best.v >= 20) parts.push(`제일 친한 건 ${best.o.displayName} ♥`);
    if (worst.v <= -20 && worst !== best) parts.push(`${rang(worst.o.displayName)}은 별로…`);

    const host = document.createElement('div');
    host.dataset.hw40 = 'bondpop';
    host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483646;';
    const sh = host.attachShadow({ mode: 'open' });
    sh.innerHTML = `<style>${STYLE}${POP_CSS}</style><div class="pop" role="dialog"><header><span class="thumb"></span><b></b><span>의 사이</span>
      <button class="x" aria-label="닫기" title="닫기">✕</button></header>${parts.length ? '<p class="sum"></p>' : ''}<ol></ol>
      <small>누르면 반짝여요 · ▶ 누르면 둘이 만나요 · 머리 위 번호와 같아요</small></div>`;
    const box = sh.querySelector('.pop');
    sh.querySelector('header .thumb').appendChild(me.thumb());
    sh.querySelector('header b').textContent = me.displayName;
    if (parts.length) sh.querySelector('.sum').textContent = parts.join(' / ');
    const ol = sh.querySelector('ol');
    const flashTimers = new Map();
    ranked.forEach(({ o, v }, n) => {
      const t = BONDS.tierOf(v);
      const li = document.createElement('li');
      li.innerHTML = '<i></i><span class="thumb"></span><span class="nm"></span><em></em><button class="go" title="지금 만나게 하기" aria-label="지금 만나게 하기">▶</button><span class="bar"><u></u></span>';
      li.querySelector('.go').addEventListener('click', (e) => {
        e.stopPropagation();
        closeBondPop();
        if (!meetNow(me, o)) me.say('지금은 바빠~', 1400);
      });
      const num = li.querySelector('i');
      num.textContent = n + 1;
      num.style.background = t.color;
      li.querySelector('.thumb').appendChild(o.thumb());
      li.querySelector('.nm').textContent = o.displayName;
      const em = li.querySelector('em');
      em.textContent = `${t.mark} ${t.label} ${v}`;
      em.style.color = t.color;
      const u = li.querySelector('u');
      const half = Math.abs(v) / 2;
      u.style.left = `${v >= 0 ? 50 : 50 - half}%`;
      u.style.width = `${half}%`;
      u.style.background = t.color;
      const lit = (on) => {
        if (!mascots.includes(o)) return;
        li.classList.toggle('on', on);
        o.highlight(on);
      };
      li.addEventListener('pointerenter', () => lit(true));
      li.addEventListener('pointerleave', () => { if (!flashTimers.has(o)) lit(false); });
      li.addEventListener('click', () => {
        if (!mascots.includes(o)) return;
        lit(true);
        if (o.free()) o.hop('hop');
        clearTimeout(flashTimers.get(o));
        flashTimers.set(o, setTimeout(() => { flashTimers.delete(o); lit(false); }, 1600));
      });
      ol.appendChild(li);
    });
    document.documentElement.appendChild(host);

    // 고른 아이 바로 위, 다른 아이들 번호표보다 높게 띄운다. 화면 밖으로 나가지 않게 당긴다.
    const r = me.host.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const tallest = Math.max(...mascots.map((o) => o.size || WIDTH));
    const left = Math.min(Math.max(8, cx - 130), window.innerWidth - 268);
    box.style.left = `${left}px`;
    box.style.bottom = `${Math.min(window.innerHeight - 120, (me.y || 0) + tallest + 30)}px`;
    box.style.setProperty('--ox', `${Math.min(252, Math.max(8, cx - left))}px`);

    // 팝업이 뜬 다음 번호표가 하나씩 톡톡 떠오른다. 팝업을 닫을 때까지 떠 있는다.
    const timers = [];
    me.showTag({ name: me.displayName, me: true, ms: 3600000 });
    ranked.forEach(({ o, v }, n) => {
      timers.push(setTimeout(() => {
        if (bondPop && bondPop.host === host && mascots.includes(o)) o.showTag({ name: o.displayName, num: n + 1, color: BONDS.tierOf(v).color, ms: 3600000 });
      }, 260 + n * 90));
    });
    me.emote('💞');

    // 닫기: ✕, Esc, 팝업 밖을 누르기
    const onDown = (e) => { if (!e.composedPath().includes(host)) closeBondPop(); };
    const onKey = (e) => { if (e.key === 'Escape') closeBondPop(); };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    sh.querySelector('.x').addEventListener('click', closeBondPop);
    bondPop = {
      host,
      tagged: [me, ...others],
      timers,
      off: () => {
        document.removeEventListener('pointerdown', onDown, true);
        document.removeEventListener('keydown', onKey, true);
        for (const t of flashTimers.values()) clearTimeout(t);
      },
    };
  }

  // 테마대로 캐릭터를 다시 만든다. 이 버전에 없는 캐릭터는 건너뛴다.
  // intro: 종이에서 차례로 빠져나오는 연출 (처음 열 때·테마를 바꿀 때)
  function spawn(theme, intro = true) {
    closeBondPop();
    for (const m of mascots) {
      m.cleanup();
      m.host.remove();
    }
    exiled.clear();
    const cast = theme.cast.filter((c) => CATALOG.has(c.id));
    const list = cast.length ? cast : defaultTheme().cast;
    // 같은 이름이 여럿이면 번호를 붙여 누가 누군지 알게 한다 (콩떡이 1, 콩떡이 2).
    const names = BONDS ? BONDS.displayNames(list, (id) => CATALOG.get(id).label) : list.map((c) => c.name);
    const keys = BONDS ? BONDS.memberKeys(list) : [];
    mascots = list.map((c, i) => {
      const m = createMascot(CATALOG.get(c.id), i, list.length, { ...c, name: names[i] });
      m.displayName = names[i] || m.name;
      if (BONDS) m.bondKey = keys[i];
      return m;
    });
    api.mascots = mascots;
    loadBonds(cast.length ? theme : defaultTheme());
    if (BONDS) actList = Array.isArray(theme.acts) ? theme.acts : BONDS.ACT_TEMPLATES;
    const saved = readJson(EXILE_KEY, []);
    const wanted = Array.isArray(saved) ? [...saved] : [];
    let order = 0;
    mascots.forEach((m) => {
      const at = wanted.indexOf(m.id);
      if (at >= 0) {
        wanted.splice(at, 1);
        m.exiledAt = (order += 1);
        exiled.add(m);
        m.placeExiled();
      }
    });
    layoutExile();
    if (intro) mascots.filter((m) => !m.phase).forEach((m, i) => m.escape(300 + i * 260, i === 0 ? '나왔다!' : null));
    applyOff();
  }
  window.addEventListener('resize', () => layoutExile());

  // ---------- 방 모드 ----------
  // 방에 있는 동안 화면의 캐릭터는 내 테마가 아니라 방 캐릭터(방장의 테마 + 데려온 캐릭터)다. 나가면 내 테마로 돌아온다.
  let roomCast = null;
  const roomDefs = new Map(); // 방 캐릭터 key → 그림이 함께 온 캐릭터 정의
  function roomDef(c) {
    const known = CATALOG.get(c.id);
    if (known && !known.mine) return known;
    if (c.spec && CHAR_RULES) {
      if (!roomDefs.has(c.key)) {
        try {
          roomDefs.set(c.key, packDef(CHAR_RULES.normalizeCharacter(c.spec)));
        } catch {
          roomDefs.set(c.key, null);
        }
      }
      if (roomDefs.get(c.key)) return roomDefs.get(c.key);
    }
    return known || null;
  }
  // 방 캐릭터를 맞춘다: 그대로인 캐릭터는 두고, 새로 온 캐릭터는 종이에서 나오고, 빠진 캐릭터는 벽으로 날아간다.
  function syncRoom(list, intro) {
    const want = list.map((c) => ({ c, def: roomDef(c) })).filter((w) => w.def);
    const rest = [...mascots];
    const next = want.map((w, i) => {
      const at = rest.findIndex((m) => m.roomKey === w.c.key);
      if (at >= 0) return rest.splice(at, 1)[0];
      const m = createMascot(w.def, i, want.length, { name: w.c.name, size: w.c.size });
      m.roomKey = w.c.key;
      m.escape(intro ? 300 + i * 220 : 150, intro ? null : '왔다!');
      return m;
    });
    for (const m of rest) {
      guests.push(m);
      m.goHome('안녕~', () => {
        guests = guests.filter((x) => x !== m);
      });
    }
    mascots = next;
    api.mascots = mascots;
    // 방 캐릭터끼리도 사이가 생긴다 (방 캐릭터 key로 구분, 이 브라우저에만 남는다).
    if (BONDS) {
      for (const m of mascots) m.bondKey = m.roomKey;
      loadBonds({ key: 'room' });
    }
    applyOff();
  }

  // ---------- 손님 (놀러 온 동료의 캐릭터) ----------
  // 테마를 바꿔도 그대로 남고, 유배되지 않는다. 연결이 끊기면 종이에 붙어 돌아간다.
  let guests = [];
  // 받은 캐릭터 정보로 그릴 캐릭터를 정한다. 내게도 있는 기본·팩 캐릭터면 그것을, 직접 만든 캐릭터면 함께 온 그림을 쓴다.
  function guestDef(info) {
    const known = CATALOG.get(info && info.id);
    if (known && !known.mine) return known;
    if (info && info.spec && CHAR_RULES) {
      try {
        return packDef(CHAR_RULES.normalizeCharacter(info.spec));
      } catch {
        // 그림이 깨졌으면 아래에서 다른 캐릭터로 대신한다.
      }
    }
    return known || CHARACTERS[0] || BASE_CATALOG[0];
  }
  // 지금 상대 화면에 놀러 갈 내 캐릭터: 유배되지 않은 첫 캐릭터
  // 아바타로 고를 수 있는 캐릭터: 내 테마의 캐릭터들 (방에 있어 화면이 방장 테마여도 내 테마에서 고른다)
  function myCast() {
    return findTheme(activeKey).cast.filter((c) => CATALOG.has(c.id));
  }
  // 캐릭터 하나를 다른 사람에게 보낼 정보로 만든다. 직접 만든 캐릭터면 그림 설정까지 담는다.
  function charInfo(id, look = {}) {
    const def = CATALOG.get(id);
    if (!def) return null;
    const spec = def.mine ? savedChars().find((c) => c.id === id) || null : null;
    const info = { id, name: look.name || def.label, size: look.size || (def.pack ? def.pack.size : WIDTH) };
    if (spec) info.spec = spec;
    return info;
  }
  api.guests = {
    onCast: null, // 내 테마가 바뀌면 불린다 (아바타 목록 다시 만들기)
    // 아바타로 고를 수 있는 내 캐릭터들
    cast: () => [...new Map(myCast().map((c) => [c.id, { id: c.id, name: c.name || CATALOG.get(c.id).label }])).values()],
    // 아바타로 고를 수 있는 모든 캐릭터: 내 테마 캐릭터 먼저, 그다음 나머지 (기본·공유·직접 만든 캐릭터)
    choices() {
      const theme = api.guests.cast().map((c) => ({ ...c, group: 'theme' }));
      const seen = new Set(theme.map((c) => c.id));
      const rest = [...CATALOG.values()].filter((d) => !seen.has(d.id)).map((d) => ({ id: d.id, name: d.label, mine: Boolean(d.mine), group: 'all' }));
      return [...theme, ...rest];
    },
    // 보낼 내 아바타 정보. id: 고른 캐릭터 (없으면 내 테마의 첫 캐릭터)
    me(id) {
      const cast = myCast();
      const c = cast.find((x) => x.id === id) || (CATALOG.has(id) ? { id } : null) || cast[0] || { id: CHARACTERS[0].id };
      return charInfo(c.id, c);
    },
    // 손님 캐릭터를 내 화면에 들인다. hooks: { nick, pet(), leave() }
    arrive(info, hooks) {
      const def = guestDef(info);
      const size = Math.min(Math.max(Number(info && info.size) || 0, 32), 160) || undefined;
      const name = String((info && info.name) || def.label).slice(0, 20);
      const g = createMascot(def, 9, 1, { name, size, guest: hooks });
      g.x = Math.random() * clearMaxX(g.w);
      g.host.title = `${hooks.nick}님의 ${name}`;
      g.host.hidden = off;
      guests.push(g);
      g.escape(200, hooks.quiet ? null : hooks.self ? '나왔다!' : `${hooks.nick}님 입장!`);
      return {
        say(text) {
          if (!g.phase) g.chat(text);
        },
        // 연결이 끊겨 자리를 비웠다(💤) / 돌아왔다
        away(on) {
          g.setAway(on);
        },
        // 다른 사람이 쓰다듬었다
        react(nick) {
          if (!g.phase) {
            g.say(`${nick}님이 쓰다듬었다! 헤헤`, 2200);
            g.hop('hop');
          }
        },
        leave(line) {
          g.goHome(line, () => {
            guests = guests.filter((x) => x !== g);
          });
        },
      };
    },
  };

  let activeKey = findTheme(readJson(ACTIVE_KEY, 'default')).key;
  spawn(findTheme(activeKey));

  // ---------- 내 캐릭터 저장소 ----------
  // 테마 만들기 화면에서 넣은 캐릭터, 또는 테마 코드에 담겨 온 캐릭터의 설정(그림 포함)
  const savedChars = () => {
    const saved = readJson(MY_CHARS_KEY, []);
    return Array.isArray(saved) ? saved.filter((c) => c && typeof c.id === 'string') : [];
  };
  // 캐릭터 설정들을 검사해 저장한다. 같은 id면 새 그림으로 바꾼다.
  function storeChars(specs) {
    const packs = specs.map((spec) => CHAR_RULES.normalizeCharacter(spec));
    const ids = new Set(packs.map((p) => p.id));
    const before = savedChars();
    const replaced = before.filter((c) => ids.has(c.id)).map((c) => c.id);
    if (!writeValue(MY_CHARS_KEY, [...before.filter((c) => !ids.has(c.id)), ...specs])) {
      throw new CHAR_RULES.CharError('브라우저 저장 공간이 모자라 저장하지 못했어요. 안 쓰는 테마나 캐릭터를 지워 주세요.');
    }
    loadMyChars();
    return { packs, replaced };
  }
  // 어느 내 테마에도 쓰이지 않는 캐릭터를 지운다 (하이웍스 화면에서 테마를 지울 때).
  function dropUnusedChars() {
    const used = new Set(savedThemes().flatMap((t) => (t.cast || []).map((c) => (typeof c === 'string' ? c : c && c.id))));
    writeValue(MY_CHARS_KEY, savedChars().filter((c) => used.has(c.id)));
    loadMyChars();
  }

  api.themes = {
    // 고를 수 있는 캐릭터 목록 (테마 만들기 화면에서 씀). mine: 직접 넣은 캐릭터
    catalog: () => [...CATALOG.values()].map((d) => ({ id: d.id, label: d.label, pack: d.pack || null, art: d.art || null, chaser: Boolean(d.chaser), mine: Boolean(d.mine) })),
    list: () => allThemes().map(({ key, name, source, cast, bonds, acts }) => ({ key, name, source, cast, ...(bonds ? { bonds } : {}), ...(acts ? { acts } : {}) })),
    active: () => activeKey,
    apply(key) {
      const theme = findTheme(key);
      activeKey = theme.key;
      writeValue(ACTIVE_KEY, activeKey === 'default' ? null : activeKey);
      // 방에 있는 동안은 화면을 바꾸지 않는다 (방을 나오면 이 테마로 돌아온다).
      if (!roomCast) spawn(theme);
      if (api.guests.onCast) api.guests.onCast();
      return theme.key;
    },
    // 저장하지 않고 잠깐 보여주기 (테마 만들기 화면의 미리 보기)
    preview(raw) {
      const { theme, warnings } = THEME_RULES.normalizeTheme(raw, knownIds);
      spawn(theme, false);
      return warnings;
    },
    // 테마 코드를 내 테마로 추가하고 바로 적용한다. 코드에 담긴 캐릭터도 함께 저장한다.
    async addCode(code) {
      const text = String(code || '').trim();
      if (text.startsWith(CHAR_RULES.CODE_PREFIX)) {
        throw new THEME_RULES.ThemeError('캐릭터 코드예요. 테마 만들기 화면에서 캐릭터를 넣고 테마를 만든 뒤, 테마 코드를 넣어 주세요.');
      }
      const { theme: raw, characters } = await THEME_RULES.decodeThemeCode(text);
      if (characters.length) storeChars(characters);
      const { theme, warnings } = THEME_RULES.normalizeTheme(raw, knownIds);
      const key = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      if (!writeValue(THEMES_KEY, [...savedThemes(), { key, ...theme }])) {
        throw new THEME_RULES.ThemeError('브라우저 저장소를 쓸 수 없어 테마를 저장하지 못했어요.');
      }
      api.themes.apply(`mine:${key}`);
      return { key: `mine:${key}`, name: theme.name, warnings, characters: characters.length };
    },
    // 내 테마를 지운다. 그 테마에만 쓰이던 캐릭터도 함께 지운다.
    remove(key) {
      const target = myThemes().find((t) => t.key === key);
      if (!target) return;
      writeValue(THEMES_KEY, savedThemes().filter((t) => t.key !== target.savedKey));
      dropUnusedChars();
      if (activeKey === key) api.themes.apply('default');
    },
    // 공유 코드. 내 캐릭터가 들어 있으면 그 그림까지 담는다.
    code(keyOrTheme) {
      const t = typeof keyOrTheme === 'string' ? findTheme(keyOrTheme) : keyOrTheme;
      const ids = new Set(t.cast.map((c) => c.id));
      return THEME_RULES.encodeThemeCode({ name: t.name, cast: t.cast, ...(t.bonds ? { bonds: t.bonds } : {}), ...(t.acts ? { acts: t.acts } : {}) }, savedChars().filter((c) => ids.has(c.id)));
    },
    site: PACKS.site || null,
    // 테마 만들기 화면의 "처음 사이" 칸이 쓰는 정보: 사이 단계와 종류끼리의 기본값
    bondInfo: BONDS ? { tiers: BONDS.TIERS, typeKey: BONDS.typeKey, base: (a, b) => BONDS.baseValue(a, b, null), min: BONDS.MIN, max: BONDS.MAX } : null,
  };
  // 지금 테마 아이들끼리의 사이 (읽기만)
  api.bonds = {
    snapshot: () => ({ theme: bondTheme, map: { ...bondMap } }),
    // 테마 만들기 화면의 ▶ 해 보기: 화면에 있는 아이 둘이 이 상호작용을 바로 연기한다 (사이는 바꾸지 않는다).
    playAct(raw, onStart) {
      const acts = THEME_RULES.normalizeActs([raw]);
      if (!acts || !acts.length) return '동작을 하나 이상 넣어 주세요.';
      const ready = mascots.filter((m) => m.free() && !actors.has(m));
      if (ready.length < 2) return mascots.length < 2 ? '캐릭터가 둘 이상 있어야 해요.' : '캐릭터들이 바빠요. 잠깐 뒤에 다시 눌러 주세요.';
      const [a, b] = ready.sort((p, q) => p.x - q.x);
      const startIn = playAct(acts[0], a, b);
      if (onStart && startIn) onStart(startIn, BONDS.schedule(acts[0].beats).total);
      return '';
    },
  };

  // 테마 만들기 화면에서 쓰는 내 캐릭터 관리 (하이웍스 패널에서는 쓰지 않는다)
  api.characters = {
    list: () => myDefs.map((d) => ({ id: d.id, label: d.label })),
    async addCode(code) {
      const spec = await CHAR_RULES.decodeCharacter(code);
      const { packs, replaced } = storeChars([spec]);
      return { id: packs[0].id, name: packs[0].label, replaced: replaced.length > 0 };
    },
    remove(id) {
      writeValue(MY_CHARS_KEY, savedChars().filter((c) => c.id !== id));
      loadMyChars();
    },
    // 테마 코드에 담겨 온 캐릭터 설정을 넣는다.
    addSpecs: (specs) => storeChars(specs),
    // 다른 탭(캐릭터 만들기)에서 넣은 캐릭터를 다시 읽는다.
    reload: () => loadMyChars(),
    // 저장된 캐릭터 설정 그대로 (팝업으로 연 테마 만들기에 건네준다)
    specs: () => savedChars(),
  };
  api.room = {
    // 방장이 방을 열 때 쓰는 처음 방 캐릭터 = 내 지금 테마
    themeCast: () => myCast().map((c) => charInfo(c.id, c)).filter(Boolean),
    // 데려올 수 있는 내 캐릭터들 (기본·팩·직접 만든 캐릭터)
    bringable: () => [...CATALOG.values()].map((d) => ({ id: d.id, name: d.label, mine: Boolean(d.mine) })),
    entryFor: (id) => charInfo(id),
    get active() { return Boolean(roomCast); },
    // 방 캐릭터를 맞춘다. 처음이면 화면을 방으로 바꾼다.
    setCast(list) {
      const first = !roomCast;
      if (first) {
        for (const m of mascots) {
          m.cleanup();
          m.host.remove();
        }
        exiled.clear();
        mascots = [];
      }
      roomCast = list;
      syncRoom(list, first);
      layoutExile();
    },
    // 방에서 나왔다: 내 테마로 돌아온다.
    exit() {
      if (!roomCast) return;
      roomCast = null;
      roomDefs.clear();
      spawn(findTheme(activeKey));
    },
  };
  api.toggleMascot = () => {
    off = !off;
    applyOff();
    writeOff(off);
    return !off;
  };
  api.mascotOn = () => !off;

  // 메뉴 바깥을 누르면 열린 메뉴를 닫는다.
  window.addEventListener('pointerdown', (e) => {
    for (const m of [...mascots, ...guests]) if (m.menuOpen && !e.composedPath().includes(m.host)) m.closeMenu();
  }, true);

  let nextMeetAt = 0;
  function checkMeetings(now) {
    if (now < nextMeetAt) return;
    const mascots = everyone();
    for (let i = 0; i < mascots.length; i++) {
      for (let j = i + 1; j < mascots.length; j++) {
        const [a, b] = [mascots[i], mascots[j]];
        const reach = (a.w + b.w) / 2;
        const bonded = bondable(a) && bondable(b);
        // 우호도가 있는 둘은 괴물도 쫓는 중이 아니면 만난다. 같이 걷는 단짝끼리는 다시 만나지 않는다.
        const busy = bonded ? a.chase || b.chase || (a.follow && a.follow.leader === b) || (b.follow && b.follow.leader === a) : a.chaser || b.chaser;
        if (a.skit || b.skit || busy || !a.free() || !b.free() || Math.abs(a.x - b.x) > reach * 0.8) continue;
        const pair = MEET_LINES[[a.id, b.id].sort().join('+')] || {};
        // 정해진 짝 대사가 없으면 팩의 lines.meet (상대 id 또는 default)를 쓴다.
        // 손님과 만나면 따로 정한 대사가 없어도 인사한다.
        const lineOf = (me, other) => pair[me.id] || (me.def.meet && (me.def.meet[other.id] || me.def.meet.default))
          || (me.guest || other.guest ? pickOne(['안녕!', '반가워!', '어디서 왔어?', '놀러 왔구나!']) : null);
        const [left, right] = a.x <= b.x ? [a, b] : [b, a];
        if (bonded) {
          bondMeet(left, right, now, lineOf);
          nextMeetAt = now + BOND_MEET_COOLDOWN_MS;
          return;
        }
        const [leftLine, rightLine] = [lineOf(left, right), lineOf(right, left)];
        if (!leftLine && !rightLine) continue;
        // 둘 사이 가운데를 기준으로 말풍선을 바깥쪽으로 펼쳐 겹치지 않게 한다.
        const leftOffset = left.w / 2 + 2 - (right.x - left.x) / 2;
        const rightOffset = right.w / 2 + 2 - (right.x - left.x) / 2;
        if (leftLine) left.say(leftLine, 2200, 'right', leftOffset);
        if (rightLine) right.say(rightLine, 2200, 'left', rightOffset);
        for (const m of [left, right]) {
          m.pause(2200, now);
          m.meetUntil = now + 2200;
        }
        right.hop();
        nextMeetAt = now + MEET_COOLDOWN_MS;
        return;
      }
    }
  }

  // ---------- 상호작용 재생 ----------
  const Z_BASE = 2147483640;
  // 효과 그림(칼·총알·💥) 하나. 캐릭터들보다 앞(맨 앞) 층에 뜬다.
  function fxEl(emoji, size) {
    const host = document.createElement('div');
    host.dataset.hw40 = 'actfx';
    host.style.cssText = `position:fixed;left:0;bottom:0;width:${size}px;height:${size}px;z-index:${Z_BASE + 14};pointer-events:none;`;
    const sh = host.attachShadow({ mode: 'open' });
    sh.innerHTML = `<span style="display:block;width:100%;height:100%;font:${size}px/1 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif;text-align:center;color:#3b3226">${emoji}</span>`;
    document.documentElement.appendChild(host);
    return host;
  }
  // 캐릭터 몸 가운데(화면 x)와 바닥에서의 높이
  const bodyAt = (m, toward) => m.x + m.w / 2 + (m.actBase ? m.actBase.x * toward : 0);
  function playFx(fx, me, other, toward, mv, beatMs) {
    const size = fx.size || Math.round(Math.max(18, me.w * 0.42));
    const tf = (cx, cy, r = 0, s = 1) => `translate(${cx - size / 2}px, ${-(cy - size / 2)}px) rotate(${r * toward}deg) scale(${s * toward}, ${s})`;
    const done = (el, anim) => anim.finished.catch(() => {}).then(() => el.remove());
    if (fx.type === 'hand') {
      const el = fxEl(fx.emoji, size);
      const cx = bodyAt(me, toward) + toward * me.w * 0.42;
      const cy = me.w * (fx.up || 0.45);
      const n = fx.keys.length;
      const frames = fx.keys.map((k, i) => ({
        offset: i === 0 ? 0 : i === n - 1 ? 1 : k.t !== undefined ? k.t : i / (n - 1),
        transform: tf(cx + (k.x || 0) * toward, cy + (k.y || 0), k.r || 0, k.s === undefined ? 1 : k.s),
        opacity: k.o === undefined ? 1 : k.o,
      }));
      done(el, el.animate(frames, { duration: beatMs, fill: 'forwards', easing: 'ease-in-out' }));
    } else if (fx.type === 'shot') {
      const el = fxEl(fx.emoji, size);
      const x0 = bodyAt(me, toward) + toward * me.w * 0.4;
      const y0 = me.w * 0.5;
      const x1 = bodyAt(other, -toward);
      const y1 = other.w * 0.5;
      const arc = fx.arc || 0;
      const steps = 6;
      const frames = [];
      for (let i = 0; i <= steps; i += 1) {
        const p = i / steps;
        frames.push({ offset: p, transform: tf(x0 + (x1 - x0) * p, y0 + (y1 - y0) * p + Math.sin(Math.PI * p) * arc, p * 200) });
      }
      el.style.opacity = '0';
      const t0 = beatMs * fx.from;
      const len = Math.max(60, beatMs * (fx.to - fx.from));
      setTimeout(() => {
        el.style.opacity = '1';
        const anim = el.animate(frames, { duration: len, easing: 'linear', fill: 'forwards' });
        anim.finished.catch(() => {}).then(() => el.remove());
      }, t0);
    } else if (fx.type === 'burst') {
      const at = beatMs * (mv.hit === undefined ? 1 : mv.hit);
      setTimeout(() => {
        const big = Math.round(size * 1.2);
        const el = fxEl(fx.emoji, big);
        const cx = fx.mid ? (bodyAt(me, toward) + bodyAt(other, -toward)) / 2 : bodyAt(other, -toward);
        const cy = (fx.mid ? me.w * 0.95 : other.w * 0.55);
        const t = (s, o) => ({ transform: `translate(${cx - big / 2}px, ${-(cy - big / 2)}px) scale(${s})`, opacity: o });
        done(el, el.animate([t(0.3, 1), t(1.3, 1), t(1.5, 0)], { duration: 550, easing: 'ease-out', fill: 'forwards' }));
      }, at);
    }
  }
  // 합동 그림: 한 아이 팩의 duo_<동작> 그림 하나로 둘을 함께 그린다 (가로가 세로의 두 배인 그림).
  // 그 박자 동안 두 아이 몸은 숨기고, 둘 사이 가운데에 그림을 띄운다. 그림은 "건 쪽이 왼쪽"으로 그린다.
  function playDuo(anim, owner, me, other, toward, ms) {
    const H = Math.max(me.w, other.w);
    const Wd = H * 2;
    const host = document.createElement('div');
    host.dataset.hw40 = 'actfx';
    const cx = (bodyAt(me, toward) + bodyAt(other, -toward)) / 2;
    host.style.cssText = `position:fixed;left:0;bottom:0;width:${Wd}px;height:${H}px;z-index:${Z_BASE + 13};pointer-events:none;transform:translate(${cx - Wd / 2}px,0)`;
    const sh = host.attachShadow({ mode: 'open' });
    sh.innerHTML = '<div style="width:100%;height:100%;background-repeat:no-repeat;background-position:center bottom;background-size:contain"></div>';
    document.documentElement.appendChild(host);
    const el = sh.firstChild;
    const draw = createSpriteRenderer({ animations: { idle: anim }, facing: owner.def.pack.facing }, el);
    for (const m of [me, other]) m.hideBody(true);
    const t0 = performance.now();
    const step = (now) => {
      if (now - t0 >= ms || me.phase !== 'act' || other.phase !== 'act') {
        host.remove();
        for (const m of [me, other]) m.hideBody(false);
        return;
      }
      el.style.transform = `scaleX(${draw('idle', now, toward)})`;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const actors = new Set(); // 지금 연기 중인 아이들
  // 상호작용 act를 a(건 쪽)와 b(받는 쪽)가 연기한다. 다 끝나면 then()을 부른다.
  function playAct(act, a, b, then) {
    if (!BONDS || a === b || actors.has(a) || actors.has(b)) return false;
    const pair = [a, b];
    for (const m of pair) {
      m.closeMenu();
      m.skit = null;
      m.chase = null;
      m.follow = null;
      m.phase = 'act';
      m.actBase = BONDS.fullPose();
      actors.add(m);
    }
    // 서로 가까이 다가가 마주 본다
    const [left, right] = a.x <= b.x ? [a, b] : [b, a];
    const mid = (left.x + left.w / 2 + right.x + right.w / 2) / 2;
    const gap = (left.w + right.w) / 2 * 0.82;
    const goal = new Map([[left, mid - gap / 2 - left.w / 2], [right, mid + gap / 2 - right.w / 2]]);
    for (const m of pair) goal.set(m, Math.min(Math.max(goal.get(m), 0), maxX(m.w)));
    const toward = (m) => (m === left ? 1 : -1);
    const walkMs = Math.min(1400, Math.max(...pair.map((m) => Math.abs(goal.get(m) - m.x))) * 9);
    const from = new Map(pair.map((m) => [m, m.x]));
    const t0 = performance.now();
    for (const m of pair) {
      m.dir = goal.get(m) > m.x ? 1 : -1;
      m.actWalkUntil = t0 + walkMs;
    }
    const stepWalk = (now) => {
      const p = Math.min(1, (now - t0) / Math.max(1, walkMs));
      for (const m of pair) if (m.phase === 'act') m.x = from.get(m) + (goal.get(m) - from.get(m)) * p;
      if (p < 1) requestAnimationFrame(stepWalk);
    };
    requestAnimationFrame(stepWalk);
    const zs = new Map(pair.map((m) => [m, m.host.style.zIndex]));
    const timers = [];
    const alive = () => pair.every((m) => m.phase === 'act');
    const plan = BONDS.schedule(act.beats);
    const startAt = walkMs + 150;
    let duoUntil = 0;
    setTimeout(() => {
      if (!alive()) return;
      for (const m of pair) m.dir = toward(m);
    }, walkMs);
    for (const beat of plan.beats) {
      timers.push(setTimeout(() => {
        if (!alive()) return;
        const mv = BONDS.MOVES[beat.move] || BONDS.MOVES.stand;
        const who = beat.who === 'both' ? pair : [beat.who === 'b' ? b : a];
        // 층: 동작하는 아이가 앞(기본·앞에) 또는 뒤. 효과 그림은 늘 맨 앞이라, 뒤에 서도 칼이 상대를 뚫고 나온다.
        const front = beat.layer === 'back' ? pair.find((m) => !who.includes(m)) || who[0] : who[0];
        for (const m of pair) m.host.style.zIndex = String(Z_BASE + (m === front ? 13 : 12));
        const dur = beat.end - beat.start;
        // 합동 그림이 있으면 (하는 쪽 → 받는 쪽 순서로 찾는다) 둘을 그 그림 하나로 그린다
        const doer = who[0];
        const duoOwner = [doer, doer === a ? b : a].find((m) => m.artOf(beat.move, 'duo'));
        // 같은 때 둘 다 같은 동작을 하면 (하이파이브처럼) 합동 그림은 한 번만 띄운다
        if (duoOwner && performance.now() >= duoUntil) {
          duoUntil = performance.now() + dur - 30;
          playDuo(duoOwner.artOf(beat.move, 'duo'), duoOwner, doer, doer === a ? b : a, toward(doer), dur);
        }
        for (const m of who) {
          const other = m === a ? b : a;
          const art = !duoOwner && m.artOf(beat.move);
          if (art) m.playArt(beat.move, dur);
          if (!duoOwner) m.actMove(mv, toward(m), dur, Boolean(art && art.still));
          if (beat.line) m.say(beat.line, Math.max(1300, dur + 700), toward(m) === 1 ? 'right' : 'left', m.w / 2);
          if (mv.emote) setTimeout(() => m.emote(mv.emote), dur * (mv.hit === undefined ? 0.3 : mv.hit));
          for (const fx of mv.fx || []) {
            if (fx.type === 'burst' && fx.mid && m !== who[0]) continue;
            playFx(fx, m, other, toward(m), mv, dur);
          }
        }
      }, startAt + beat.start));
    }
    // 끝: 쓰러져 있으면 일어나고, 자리를 정리한 뒤 평소로 돌아간다
    timers.push(setTimeout(() => {
      let wait = 250;
      for (const m of pair) {
        if (m.phase === 'act' && m.actBase && Math.abs(m.actBase.r) > 30) {
          m.actMove(BONDS.MOVES.getup, toward(m));
          wait = BONDS.MOVES.getup.ms + 150;
        }
      }
      timers.push(setTimeout(() => {
        const now = performance.now();
        for (const m of pair) {
          actors.delete(m);
          m.host.style.zIndex = zs.get(m);
          if (m.phase !== 'act') continue;
          m.actEnd(toward(m));
          m.phase = null;
          m.pause(700, now);
          m.meetUntil = now + 700;
        }
        if (then) then();
      }, wait));
    }, startAt + plan.total + 300));
    return startAt; // 첫 박자까지 남은 시간 (시간표의 재생 줄을 맞추는 데 쓴다)
  }
  // 지금 둘을 바로 만나게 한다 (사이 보기의 ▶). 연기 중이거나 붙잡혀 있으면 하지 않는다.
  function meetNow(a, b) {
    if (!bondable(a) || !bondable(b) || !a.free() || !b.free()) return false;
    const act = BONDS.pickAct(actList, bondOf(a, b), Math.random, true);
    if (act) return playAct(act, a, b, () => changeBond(a, b, act.bond || 0, performance.now()));
    const [left, right] = a.x <= b.x ? [a, b] : [b, a];
    bondMeet(left, right, performance.now(), () => null);
    return true;
  }

  // 우호도가 있는 둘이 만났다: 사이에 따라 할 일을 고르고(bonds.js), 그대로 움직인 뒤 사이를 바꾼다.
  const BOND_MEET_MS = 2400;
  function bondMeet(left, right, now, lineOf) {
    const act = BONDS.pickAct(actList, bondOf(left, right));
    if (act) {
      const [a, b] = Math.random() < 0.5 ? [left, right] : [right, left];
      playAct(act, a, b, () => changeBond(left, right, act.bond || 0, performance.now()));
      return;
    }
    const plan = BONDS.planMeeting(bondOf(left, right));
    const pickLine = (who, other, side) => (plan.pairLines && lineOf(who, other)) || pickOne(plan.lines[side]);
    const leftOffset = left.w / 2 + 2 - (right.x - left.x) / 2;
    const rightOffset = right.w / 2 + 2 - (right.x - left.x) / 2;
    left.say(pickLine(left, right, 0), BOND_MEET_MS, 'right', leftOffset);
    right.say(pickLine(right, left, 1), BOND_MEET_MS, 'left', rightOffset);
    left.emote(plan.emote[0]);
    setTimeout(() => right.emote(plan.emote[1]), 250);
    // 기본은 서로 마주 보고 잠깐 멈춘다.
    for (const m of [left, right]) {
      m.follow = null;
      m.pause(BOND_MEET_MS, now);
      m.meetUntil = now + BOND_MEET_MS;
    }
    left.dir = 1;
    right.dir = -1;
    switch (plan.kind) {
      case 'hug':
      case 'reconcile':
        left.hop();
        setTimeout(() => right.hop(), 180);
        break;
      case 'together': {
        // 왼쪽이 앞장서고 오른쪽이 따라 걷는다.
        const ms = 6000 + Math.random() * 3000;
        left.pause(1200, now);
        right.pause(1200, now);
        left.meetUntil = right.meetUntil = now + 1200;
        setTimeout(() => {
          if (!left.free() || !right.free()) return;
          const t = performance.now();
          left.walkAway(Math.random() < 0.5 ? -1 : 1, ms, t);
          right.follow = { leader: left, from: t, until: t + ms };
        }, 1200);
        right.hop();
        break;
      }
      case 'ignore':
        // 서로 등 돌리고 반대쪽으로 간다.
        left.walkAway(-1, 2600, now + 600);
        right.walkAway(1, 2600, now + 600);
        left.meetUntil = right.meetUntil = now + 600;
        break;
      case 'quarrel':
        // 마주 보고 부들부들 → 흥 하고 반대쪽으로
        left.fumeUntil = right.fumeUntil = now + 1700;
        setTimeout(() => {
          const t = performance.now();
          if (left.free()) left.walkAway(-1, 2200, t);
          if (right.free()) right.walkAway(1, 2200, t);
        }, 1800);
        break;
      case 'spat':
        left.fumeUntil = now + 700;
        break;
      default:
        right.hop();
    }
    changeBond(left, right, plan.delta, now);
  }

  const everyone = () => (guests.length ? [...mascots, ...guests] : mascots);
  let nextChaseAt = performance.now() + 15000;
  function checkChase(now) {
    const mascots = everyone();
    if (now < nextChaseAt) return;
    nextChaseAt = now + CHASE_COOLDOWN_MS * (0.7 + Math.random() * 0.6);
    for (const chaser of mascots.filter((m) => m.chaser && !m.chase && m.free())) {
      const others = mascots.filter((m) => !m.chaser && now >= m.fleeUntil && m.free());
      if (!others.length) return;
      const prey = others.reduce((a, b) => (Math.abs(a.x - chaser.x) <= Math.abs(b.x - chaser.x) ? a : b));
      chaser.startChase(prey, now);
    }
  }

  let last = 0;
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!off) {
      const mood = mascotMood(api.latest);
      if (mood === 'normal') {
        checkMeetings(now);
        checkChase(now);
      }
      everyone().forEach((m) => m.update(now, dt, mood));
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame((now) => {
    last = now;
    frame(now);
  });
})();

// ---- visit.js ----
// 놀러 가기: 동료와 초대 코드를 주고받아 브라우저끼리 직접 연결한다 (WebRTC). 우리 서버는 없다.
// 1) A가 초대 코드(HW40V1)를 만들어 보낸다 → 2) B가 넣고 답장 코드(HW40V2)를 돌려보낸다 → 3) A가 넣으면 연결.
// 연결되면 서로의 대표 캐릭터가 상대 화면에 놀러 가고, 적은 말이 그 캐릭터의 말풍선으로 뜬다.
// 대화는 두 브라우저 사이로만 오가고 어디에도 저장되지 않는다.
// 연결 주소를 알아낼 때만 공개 STUN 서버(구글)에 물어본다. 대화 내용은 거기로 가지 않는다.
// 회사 방화벽 등으로 직접 연결이 막히면 중계(TURN) 서버가 암호화된 채로 대신 전해 준다 (내용은 못 본다).
(function (root) {
  const INVITE_PREFIX = 'HW40V1.';
  const REPLY_PREFIX = 'HW40V2.';
  const NICK_MAX = 12;
  const TEXT_MAX = 100;
  const CHUNK = 16000; // 데이터 채널 한 번에 보내는 글자 수 (큰 캐릭터 그림은 나눠 보낸다)
  // 중계 서버 접속 정보. 비어 있으면 직접 연결만 한다.
  const TURN_SERVERS = [];
  const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }, ...TURN_SERVERS];
  // 중계 서버 주소는 받는 데 조금 더 걸린다.
  const GATHER_MS = TURN_SERVERS.length ? 6000 : 3000;

  class VisitError extends Error {}

  async function pipe(bytes, stream) {
    return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
  }
  const bytesToB64 = (bytes) => {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const b64ToBytes = (text) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

  const cleanNick = (nick) => String(nick || '').replace(/[<>&"]/g, '').trim().slice(0, NICK_MAX) || '동료';
  const cleanText = (text) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, TEXT_MAX);

  // 연결 정보(SDP)와 이름을 압축해 코드로 만든다.
  async function encodeSignal(prefix, payload) {
    const json = new TextEncoder().encode(JSON.stringify(payload));
    return prefix + bytesToB64(await pipe(json, new CompressionStream('deflate')));
  }

  // expect: 받아야 할 코드 종류. 다른 종류를 넣으면 무엇을 넣어야 하는지 알려준다.
  async function decodeSignal(code, expect) {
    const text = String(code || '').replace(/\s+/g, '');
    const other = expect === INVITE_PREFIX ? REPLY_PREFIX : INVITE_PREFIX;
    if (text.startsWith(other)) {
      throw new VisitError(expect === INVITE_PREFIX
        ? '답장 코드예요. 초대한 사람이 넣는 코드라서, 내가 받은 초대 코드를 넣어 주세요.'
        : '초대 코드예요. 상대가 그 코드를 넣고 돌려준 답장 코드(HW40V2…)를 넣어 주세요.');
    }
    if (!text.startsWith(expect)) {
      throw new VisitError(`${expect === INVITE_PREFIX ? '초대' : '답장'} 코드가 아니에요. "${expect}"로 시작하는 코드를 붙여 넣어 주세요.`);
    }
    let payload;
    try {
      payload = JSON.parse(new TextDecoder().decode(await pipe(b64ToBytes(text.slice(expect.length)), new DecompressionStream('deflate'))));
    } catch {
      throw new VisitError('코드가 깨졌어요. 처음부터 끝까지 다 복사했는지 확인해 주세요.');
    }
    if (!payload || typeof payload.sdp !== 'string') throw new VisitError('코드가 깨졌어요. 처음부터 끝까지 다 복사했는지 확인해 주세요.');
    return { sdp: payload.sdp, nick: cleanNick(payload.nick) };
  }

  // 큰 메시지를 조각내 보낸다. 받는 쪽은 createJoiner로 다시 붙인다.
  let nextId = 0;
  function splitMessage(obj, size = CHUNK) {
    const text = JSON.stringify(obj);
    if (text.length <= size) return [JSON.stringify({ t: 'msg', d: text })];
    const id = (nextId += 1);
    const n = Math.ceil(text.length / size);
    return Array.from({ length: n }, (_, i) => JSON.stringify({ t: 'part', id, i, n, d: text.slice(i * size, (i + 1) * size) }));
  }
  function createJoiner() {
    const pending = new Map();
    return (frame) => {
      if (!frame || typeof frame.d !== 'string') return null;
      if (frame.t === 'msg') return JSON.parse(frame.d);
      if (frame.t !== 'part') return null;
      const parts = pending.get(frame.id) || [];
      parts[frame.i] = frame.d;
      pending.set(frame.id, parts);
      if (parts.filter((p) => typeof p === 'string').length < frame.n) return null;
      pending.delete(frame.id);
      return JSON.parse(parts.join(''));
    };
  }

  // 브라우저끼리의 연결 하나. hooks: onOpen(), onMessage(msg), onClose(reason)
  function createLink(hooks) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const join = createJoiner();
    let channel = null;
    let closed = false;
    const finish = (reason) => {
      if (closed) return;
      closed = true;
      try {
        pc.close();
      } catch {
        // 이미 닫혔다.
      }
      hooks.onClose(reason);
    };
    const bind = (ch) => {
      channel = ch;
      ch.onopen = () => hooks.onOpen();
      ch.onmessage = (e) => {
        let msg = null;
        try {
          msg = join(JSON.parse(e.data));
        } catch {
          return; // 알 수 없는 메시지는 무시한다.
        }
        if (msg) hooks.onMessage(msg);
      };
      ch.onclose = () => finish('closed');
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') finish('failed');
    };
    // 연결 후보(주소)를 다 모을 때까지 기다린다. 오래 걸리면 모은 만큼만 쓴다.
    const gathered = () => new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') return resolve();
      const done = () => pc.iceGatheringState === 'complete' && resolve();
      pc.addEventListener('icegatheringstatechange', done);
      setTimeout(resolve, GATHER_MS);
    });
    return {
      // 초대하는 쪽
      async invite(nick) {
        bind(pc.createDataChannel('hw40'));
        await pc.setLocalDescription(await pc.createOffer());
        await gathered();
        return encodeSignal(INVITE_PREFIX, { sdp: pc.localDescription.sdp, nick: cleanNick(nick) });
      },
      // 초대받은 쪽: 초대 코드를 넣고 답장 코드를 만든다.
      async accept(code, nick) {
        const peer = await decodeSignal(code, INVITE_PREFIX);
        pc.ondatachannel = (e) => bind(e.channel);
        await pc.setRemoteDescription({ type: 'offer', sdp: peer.sdp });
        await pc.setLocalDescription(await pc.createAnswer());
        await gathered();
        return { reply: await encodeSignal(REPLY_PREFIX, { sdp: pc.localDescription.sdp, nick: cleanNick(nick) }), peer };
      },
      // 초대한 쪽: 답장 코드를 넣으면 연결된다.
      async finish(code) {
        const peer = await decodeSignal(code, REPLY_PREFIX);
        try {
          await pc.setRemoteDescription({ type: 'answer', sdp: peer.sdp });
        } catch {
          throw new VisitError('이 답장 코드는 지금 초대에 맞지 않아요. 방금 보낸 초대 코드로 만든 답장인지 확인해 주세요.');
        }
        return peer;
      },
      send(obj) {
        if (!channel || channel.readyState !== 'open') return false;
        for (const frame of splitMessage(obj)) channel.send(frame);
        return true;
      },
      close: () => finish('local'),
    };
  }

  const visit = {
    INVITE_PREFIX, REPLY_PREFIX, NICK_MAX, TEXT_MAX, VisitError,
    encodeSignal, decodeSignal, splitMessage, createJoiner, createLink, cleanNick, cleanText,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = visit;
  else root.HW40_VISIT = visit;
})(typeof globalThis !== 'undefined' ? globalThis : this);

// ---- relay.js ----
// 모이기 방의 중계 서버 연결. 방 코드 하나로 여러 명이 같은 방에 들어온다.
//
// 방 코드(예: K7Q2-M9XA)에서 두 가지를 만든다 (PBKDF2, 브라우저 안에서만).
//   roomId: 서버가 방을 구분하는 이름. 여기서 방 코드를 거꾸로 알아낼 수 없다.
//   key:    메시지를 잠그는 열쇠 (AES-GCM). 서버는 열쇠가 없어 내용을 읽지 못한다.
// 서버는 같은 방 사람들에게 잠긴 메시지를 전해 주기만 한다 (server/src/worker.js).
(function (root) {
  // 헷갈리는 글자(0 O 1 I)는 뺐다.
  const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const CODE_LEN = 8;
  const SALT = 'doodling-room-v1';
  const ROUNDS = 150000;
  const PART = 180000; // 서버가 받는 한 조각보다 작게 나눠 보낸다
  // 말이 없어도 연결이 끊기지 않게 보내는 신호. 창을 내려 두면 브라우저가 타이머를 1분에 한 번으로 늦출 수 있어 넉넉히 짧게.
  const PING_MS = 20000;
  // 배포한 중계 서버 주소. 확인용 화면에서는 globalThis.HW40_RELAY로 바꾼다.
  const DEFAULT_RELAY = 'wss://relay.doodling-app.workers.dev';

  const relayUrl = () => root.HW40_RELAY || DEFAULT_RELAY;

  class RelayError extends Error {}

  function newCode() {
    const bytes = new Uint8Array(CODE_LEN);
    crypto.getRandomValues(bytes);
    const s = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  }

  // 사람이 넣은 코드를 바로잡는다: 소문자·띄어쓰기·하이픈은 상관없다. 맞지 않으면 null.
  function cleanCode(input) {
    const s = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (s.length !== CODE_LEN || [...s].some((c) => !ALPHABET.includes(c))) return null;
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  }

  const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const toB64 = (bytes) => {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const fromB64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

  async function deriveRoom(code) {
    const subtle = crypto.subtle;
    const enc = new TextEncoder();
    const base = await subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(SALT), iterations: ROUNDS, hash: 'SHA-256' }, base, 384));
    const key = await subtle.importKey('raw', bits.slice(16), 'AES-GCM', false, ['encrypt', 'decrypt']);
    return { roomId: hex(bits.slice(0, 16)), key };
  }

  async function seal(key, obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(JSON.stringify(obj));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
    const out = new Uint8Array(12 + ct.length);
    out.set(iv);
    out.set(ct, 12);
    return toB64(out);
  }

  async function open(key, text) {
    const all = fromB64(text);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, key, all.slice(12));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  // 잠깐 끊기면 다시 붙어 보는 간격. 마지막 값으로 계속 해 보다가 GIVE_UP_MS가 지나면 그만둔다.
  // 서버는 끊긴 사람의 자리를 10시간 비워 둔다. 창을 내리거나 가리면 크롬이 타이머를 늦추므로,
  // 다시 보이거나 인터넷이 돌아오는 순간에는 기다리지 않고 바로 붙는다.
  const RETRY_MS = [700, 1500, 2500, 4000, 6000, 10000, 15000];
  const GIVE_UP_MS = 10 * 60 * 60 * 1000 - 60000;
  const CLOSING = 4001; // 탭을 닫거나 새로고침할 때의 닫기 코드 (서버가 1분만 자리를 비워 둔다)
  const CHECK_MS = 5000; // 다시 보일 때 연결이 살아 있는지 확인하는 시간 (pong이 안 오면 다시 붙는다)
  const LEFT = 4000; // 스스로 나갈 때의 닫기 코드 (서버가 자리를 비워 두지 않는다)

  // 방에 접속한다.
  // role: 'host' | 'member'
  // on: { open(myId), join(id), leave(id), message(from, msg), close(reason), wobble(state) }
  //   reason: 'full' | 'taken' | 'no-host' | 'host-away' | 'host-left' | 'busy' | 'big'
  //           | 'lost'(끊겨서 다시 붙지 못함) | 'unreachable'(처음부터 못 붙음) | 'left'(내가 나감)
  //   wobble: 'retrying'(잠깐 끊겨 다시 붙는 중) | 'back'(다시 붙음)
  //   away(id, on): 누가 자리를 비웠다(true) / 돌아왔다(false) (방장에게는 동료들, 동료에게는 방장)
  // prev: 전에 쓰던 번호 (새로고침한 뒤 같은 자리로 돌아갈 때)
  // 돌려주는 값: { send(to, msg), close() }  to: 'h' | 'p3' | '*'
  async function connect({ code, role, on, prev = null, url = relayUrl(), WebSocketImpl = typeof WebSocket !== 'undefined' ? WebSocket : null }) {
    if (!url) throw new RelayError('중계 서버 주소가 없어요.');
    const { roomId, key } = await deriveRoom(code);
    const base = `${url.replace(/\/$/, '')}/r/${roomId}?as=${role}`;
    let ws = null;
    let ended = false;
    let myId = null;
    let retry = -1; // 다시 붙는 중이면 몇 번째인지
    let retryTimer = 0;
    let checkTimer = 0; // 다시 보일 때 연결 확인
    let unlisten = () => {};
    let nextPart = 0;
    const parts = new Map(); // `${from}:${id}` → [조각...]
    const waiting = []; // 다시 붙는 동안 못 보낸 조각들
    const ping = setInterval(() => {
      if (ws && ws.readyState === 1) ws.send('ping');
    }, PING_MS);
    const end = (reason) => {
      if (ended) return;
      ended = true;
      clearInterval(ping);
      clearTimeout(retryTimer);
      clearTimeout(checkTimer);
      unlisten();
      try {
        if (ws) ws.close(reason === 'left' ? LEFT : 1000);
      } catch {
        // 이미 닫혔다.
      }
      if (on.close) on.close(reason);
    };
    // 받은 메시지는 순서대로 푼다 (풀기가 비동기라 순서가 섞이지 않게).
    let queue = Promise.resolve();
    const deliver = (from, d) => {
      queue = queue.then(async () => {
        let msg;
        try {
          msg = await open(key, d);
        } catch {
          return; // 다른 열쇠로 잠긴 것은 버린다.
        }
        if (!ended && on.message) on.message(from, msg);
      });
    };
    const flush = () => {
      while (waiting.length && ws && ws.readyState === 1) ws.send(waiting.shift());
    };
    function attach(sock) {
      sock.onmessage = (e) => {
        if (sock !== ws || e.data === 'pong') return;
        let m;
        try {
          m = JSON.parse(e.data);
        } catch {
          return;
        }
        if (m.s === 'hi') {
          if (myId === null) {
            myId = m.id;
            if (on.open) on.open(m.id);
          } else if (m.id === myId && m.resumed) {
            retry = -1;
            parts.clear();
            flush();
            if (on.wobble) on.wobble('back');
          } else {
            end('lost'); // 자리를 지키지 못했다
          }
        } else if (m.s === 'join') {
          if (on.join) on.join(m.id);
        } else if (m.s === 'leave') {
          if (on.leave) on.leave(m.id);
        } else if (m.s === 'away' || m.s === 'back') {
          if (on.away) on.away(m.id, m.s === 'away');
        } else if (m.s === 'end') {
          // 다시 붙으려다 자리가 없어졌으면 그냥 끊긴 것으로 본다.
          end(retry >= 0 && (m.reason === 'no-host' || m.reason === 'taken' || m.reason === 'host-away') ? 'lost' : m.reason);
        } else if (m.s === 'msg' && typeof m.d === 'string') {
          if (!m.p) return deliver(m.from, m.d);
          // 나눠 보낸 큰 메시지
          const k = `${m.from}:${m.p.id}`;
          const list = parts.get(k) || [];
          list[m.p.i] = m.d;
          parts.set(k, list);
          if (list.filter((x) => x !== undefined).length === m.p.n) {
            parts.delete(k);
            deliver(m.from, list.join(''));
          }
        }
      };
      sock.onclose = () => {
        if (sock !== ws || ended) return;
        if (myId === null) return end('unreachable');
        // 잠깐 끊겼다: 같은 번호로 다시 붙어 본다.
        retry += 1;
        if (retry === 0) {
          droppedAt = Date.now();
          if (on.wobble) on.wobble('retrying');
        }
        if (Date.now() - droppedAt > GIVE_UP_MS) return end('lost');
        retryTimer = setTimeout(reconnect, RETRY_MS[Math.min(retry, RETRY_MS.length - 1)]);
      };
      sock.onerror = () => {};
    }
    let droppedAt = 0;
    function reconnect() {
      clearTimeout(retryTimer);
      if (ended || (ws && ws.readyState === 0)) return; // 이미 붙는 중
      ws = new WebSocketImpl(`${base}&prev=${encodeURIComponent(myId)}`);
      attach(ws);
    }
    ws = new WebSocketImpl(prev ? `${base}&prev=${encodeURIComponent(prev)}` : base);
    attach(ws);

    // 창이 다시 보이거나 인터넷이 돌아왔다: 끊겨 있으면 바로 붙고, 붙어 있어도 정말 살아 있는지 확인한다
    // (노트북을 덮었다 열면 끊긴 줄 모르고 열려 있는 것처럼 보일 때가 있다).

    const wake = () => {
      if (ended || myId === null || (typeof document !== 'undefined' && document.hidden)) return;
      if (retry >= 0) return reconnect();
      if (!ws || ws.readyState !== 1 || checkTimer) return;
      const sock = ws;
      const prevOnMessage = sock.onmessage;
      sock.onmessage = (e) => {
        if (e.data === 'pong') {
          clearTimeout(checkTimer);
          checkTimer = 0;
          sock.onmessage = prevOnMessage;
          return;
        }
        prevOnMessage(e);
      };
      checkTimer = setTimeout(() => {
        checkTimer = 0;
        sock.onmessage = prevOnMessage;
        if (sock === ws && !ended) sock.close(); // 답이 없다: 끊긴 것으로 보고 다시 붙는다
      }, CHECK_MS);
      sock.send('ping');
    };
    // 탭을 닫거나 새로고침할 때: 서버에 알려 1분만 자리를 비워 두게 한다 (새로고침이면 그 안에 돌아온다).
    // 방을 나간 것은 아니므로 close 알림은 보내지 않는다 (방 정보를 지우지 않게).
    const bye = () => {
      if (ended) return;
      ended = true;
      clearInterval(ping);
      clearTimeout(retryTimer);
      clearTimeout(checkTimer);
      unlisten();
      try {
        if (ws) ws.close(CLOSING);
      } catch {
        // 이미 닫혔다.
      }
    };
    const listen = typeof window !== 'undefined' && window.addEventListener;
    if (listen) {
      document.addEventListener('visibilitychange', wake);
      window.addEventListener('online', wake);
      window.addEventListener('focus', wake);
      window.addEventListener('pagehide', bye);
    }
    unlisten = () => {
      if (!listen) return;
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('pagehide', bye);
    };

    // 보내는 메시지도 순서대로 잠가서 보낸다. 다시 붙는 중이면 모아 두었다가 붙으면 보낸다.
    let sending = Promise.resolve();
    const put = (frame) => {
      if (ws && ws.readyState === 1 && retry < 0) ws.send(frame);
      else if (waiting.length < 200) waiting.push(frame);
    };
    const link = {
      send(to, msg) {
        sending = sending.then(async () => {
          if (ended) return;
          const d = await seal(key, msg);
          if (ended) return;
          if (d.length <= PART) return put(JSON.stringify({ to, d }));
          nextPart += 1;
          const n = Math.ceil(d.length / PART);
          for (let i = 0; i < n; i += 1) put(JSON.stringify({ to, d: d.slice(i * PART, (i + 1) * PART), p: { id: nextPart, i, n } }));
        }).catch(() => {});
        return sending;
      },
      close() {
        end('left');
      },
    };
    return link;
  }

  const api = { connect, newCode, cleanCode, deriveRoom, seal, open, RelayError, relayUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HW40_RELAY_LINK = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

// ---- room.js ----
// 여러 명이 모이는 방. 서버가 없으므로 방을 연 사람(방장)이 가운데에서 말을 전해 준다.
//   방장 ─┬─ 동료1      동료끼리는 직접 연결하지 않고, 방장이 받은 말을 나머지에게 넘긴다.
//         ├─ 동료2      그래서 초대 코드는 들어오는 사람마다 한 번씩만 주고받으면 된다.
//         └─ 동료3      방장이 나가면 방이 닫힌다.
// 방은 방장의 방이다: 모두의 화면에 방장의 테마 캐릭터들(방 캐릭터)이 돌아다니고, 그 위로 각자의 아바타가 나온다.
// 방장이 꾸미기 권한을 준 사람은 자기 캐릭터를 방에 데려오거나 방 캐릭터를 뺄 수 있다.
// 연결은 두 가지다.
//   중계 서버(relay.js, 기본): 방 코드 하나로 여럿이 들어온다. 서버는 잠긴 메시지를 방장↔동료 사이에 전해 주기만 한다.
//   직접 연결(visit.js의 createLink): 초대·답장 코드를 한 사람씩 주고받는다 (WebRTC).
// 어느 쪽이든 방장이 가운데에 있다. 여기서는 누가 있고 누가 무슨 말을 했는지만 다룬다.
(function (root) {
  const HOST_ID = 'h';
  const MAX_PEOPLE = 8;
  const MAX_CAST = 12; // 방 캐릭터 수 (아바타 제외)

  const V = () => root.HW40_VISIT || (typeof require === 'function' ? require('./visit.js') : null);

  // makeLink(hooks): visit.createLink 와 같은 모양의 연결을 만든다.
  // makeHub(opts): relay.connect 와 같은 모양의 중계 서버 연결을 만든다 (방 코드 방식).
  // me(): { nick, avatar } 지금 내 이름과 아바타
  // on: { people(list), join(p), leave(p), say(p, text), petted(p), closed(reason),
  //        cast(list, change), perm(canEdit), wobble(state) }  wobble: 'retrying' | 'back' 연결이 잠깐 끊김 / 다시 붙음  change: { nick, added | removed } 누가 무엇을 바꿨는지
  function createRoom({ makeLink, makeHub, me, on }) {
    const { cleanNick, cleanText } = V();
    const emit = (name, ...args) => on[name] && on[name](...args);
    const people = new Map(); // pid → { pid, nick, avatar }
    let role = null; // 'host' | 'member'
    let myId = null;
    let closed = false;
    let leaving = false; // 내가 나가는 중 (그 사이 연결이 끊겨도 "나왔어요"로 본다)
    // 방장: 들어온 동료마다의 연결. 멤버: 방장과의 연결 하나.
    const links = new Map(); // pid → link
    let pending = null; // 방장: 아직 답장을 기다리는 초대 { pid, link }
    let hostLink = null;
    let hub = null; // 중계 서버 연결
    let relayId = null; // 중계 서버에서의 내 번호 (새로고침한 뒤 같은 자리로 돌아갈 때 쓴다)
    let nextMember = 0;
    // 방 캐릭터: [{ key, id, name?, size?, spec?, by }] (spec: 직접 만든 캐릭터의 그림 설정)
    let cast = [];
    let nextCast = 0;
    const editors = new Set(); // 꾸미기 권한을 받은 사람 (방장은 언제나 된다)
    let canEdit = false;

    const castItem = (item, by) => {
      nextCast += 1;
      const out = { key: `c${nextCast}`, id: String(item.id || ''), by };
      if (item.name) out.name = String(item.name).slice(0, 20);
      if (item.size) out.size = Number(item.size);
      if (item.spec && typeof item.spec === 'object') out.spec = item.spec;
      return out;
    };
    const nickOf = (pid) => (pid === myId ? self().nick : (people.get(pid) || {}).nick || '누군가');
    const setPerm = (value) => {
      if (value === canEdit) return;
      canEdit = value;
      emit('perm', canEdit);
    };

    const list = () => [...people.values()];
    const self = () => ({ pid: myId, nick: cleanNick(me().nick), avatar: me().avatar || null, me: true });
    const changed = () => emit('people', room.people());

    function addPerson(pid, nick, avatar) {
      const p = { pid, nick: cleanNick(nick), avatar: avatar || null };
      const had = people.has(pid);
      people.set(pid, p);
      emit('join', p, had);
      changed();
      return p;
    }
    // 자리 비움(💤): 연결이 끊겨 서버가 자리를 비워 둔 동안
    function markAway(p, on) {
      p.away = on;
      emit('away', p, on);
    }
    // 동료: 방장에게 인사한다 (처음 들어올 때, 다시 붙었을 때, 방장이 다시 물을 때)
    function sayHello() {
      if (!hostLink) return;
      const m = me();
      hostLink.send({ t: 'hello', nick: cleanNick(m.nick), avatar: m.avatar || null });
    }
    function removePerson(pid) {
      const p = people.get(pid);
      if (!p) return;
      people.delete(pid);
      editors.delete(pid);
      emit('leave', p);
      changed();
    }

    // ---------- 방장 ----------
    const sendTo = (pid, msg) => {
      const l = links.get(pid);
      if (l) l.send(msg);
    };
    const broadcast = (msg, except = null) => {
      for (const [pid, l] of links) if (pid !== except) l.send(msg);
    };
    function hostMessage(pid, msg) {
      const p = people.get(pid);
      if (msg.t === 'hello') {
        if (!p && people.size + 1 >= MAX_PEOPLE) {
          sendTo(pid, { t: 'bye', reason: 'full' });
          return;
        }
        const joined = addPerson(pid, msg.nick, msg.avatar);
        // 새로 온 사람에게: 내 번호, 방장과 먼저 와 있던 사람들
        sendTo(pid, { t: 'welcome', you: pid });
        const host = self();
        sendTo(pid, { t: 'join', pid: HOST_ID, nick: host.nick, avatar: host.avatar });
        for (const other of people.values()) if (other.pid !== pid) sendTo(pid, { t: 'join', ...other });
        sendTo(pid, { t: 'cast', cast });
        sendTo(pid, { t: 'perm', editors: [...editors] });
        // 먼저 와 있던 사람들에게: 새로 온 사람
        broadcast({ t: 'join', ...joined }, pid);
        return;
      }
      if (!p) return; // 인사 전의 메시지는 무시한다.
      if (msg.t === 'say') {
        const text = cleanText(msg.text);
        if (!text) return;
        emit('say', p, text);
        broadcast({ t: 'say', from: pid, text }, pid);
      } else if (msg.t === 'avatar') {
        addPerson(pid, p.nick, msg.avatar);
        broadcast({ t: 'join', ...people.get(pid) }, pid);
      } else if (msg.t === 'pet') {
        if (msg.to === HOST_ID) emit('petted', p);
        else if (people.has(msg.to)) sendTo(msg.to, { t: 'pet', from: pid, to: msg.to });
      } else if (msg.t === 'castAdd' || msg.t === 'castRemove') {
        if (editors.has(pid)) editCast(pid, msg);
      } else if (msg.t === 'bye') {
        dropMember(pid);
      }
    }
    // 방장이 방 캐릭터를 바꾸고 모두에게 알린다.
    function editCast(pid, msg) {
      let change = null;
      if (msg.t === 'castAdd') {
        if (!msg.item || !msg.item.id || cast.length >= MAX_CAST) return;
        const item = castItem(msg.item, pid);
        cast = [...cast, item];
        change = { nick: nickOf(pid), added: item };
      } else {
        const item = cast.find((c) => c.key === msg.key);
        if (!item) return;
        cast = cast.filter((c) => c !== item);
        change = { nick: nickOf(pid), removed: item };
      }
      emit('cast', cast, change);
      broadcast({ t: 'cast', cast, change: { by: pid, added: change.added && change.added.key, removed: change.removed && change.removed.key } });
    }
    function dropMember(pid) {
      const l = links.get(pid);
      if (!l) return;
      links.delete(pid);
      l.close();
      removePerson(pid);
      broadcast({ t: 'leave', pid });
    }

    // ---------- 동료(멤버) ----------
    function memberMessage(msg) {
      if (msg.t === 'welcome') {
        myId = String(msg.you);
        changed();
      } else if (msg.t === 'join') {
        if (msg.pid === myId) return;
        const p = addPerson(String(msg.pid), msg.nick, msg.avatar);
        if (msg.away) markAway(p, true);
      } else if (msg.t === 'away') {
        const p = people.get(String(msg.pid));
        if (p) markAway(p, Boolean(msg.on));
      } else if (msg.t === 'who') {
        // 방장이 새로고침해서 누가 있는지 다시 묻는다
        sayHello();
      } else if (msg.t === 'leave') {
        removePerson(msg.pid);
      } else if (msg.t === 'say') {
        const p = people.get(msg.from);
        const text = cleanText(msg.text);
        if (p && text) emit('say', p, text);
      } else if (msg.t === 'pet') {
        const p = people.get(msg.from);
        if (p && msg.to === myId) emit('petted', p);
      } else if (msg.t === 'cast') {
        if (!Array.isArray(msg.cast)) return;
        const before = cast;
        cast = msg.cast.filter((c) => c && typeof c.id === 'string' && typeof c.key === 'string').slice(0, MAX_CAST);
        let change = null;
        if (msg.change) {
          const added = msg.change.added && cast.find((c) => c.key === msg.change.added);
          const removed = msg.change.removed && before.find((c) => c.key === msg.change.removed);
          if (added || removed) change = { nick: nickOf(msg.change.by), added: added || undefined, removed: removed || undefined };
        }
        emit('cast', cast, change);
      } else if (msg.t === 'perm') {
        editors.clear();
        for (const pid of Array.isArray(msg.editors) ? msg.editors : []) editors.add(String(pid));
        setPerm(editors.has(myId));
        changed();
      } else if (msg.t === 'bye') {
        finish(msg.reason === 'full' || msg.reason === 'kicked' ? msg.reason : 'host-left');
      }
    }

    function finish(reason) {
      if (closed) return;
      closed = true;
      if (leaving) reason = 'left';
      if (pending) pending.link.close();
      for (const l of links.values()) l.close();
      links.clear();
      if (hostLink) hostLink.close();
      if (hub) hub.close();
      for (const p of list()) removePerson(p.pid);
      emit('closed', reason);
    }

    const room = {
      get role() { return role; },
      get myId() { return myId; },
      get relayId() { return relayId; },
      // 방장: 꾸미기 권한을 준 사람들 (새로고침한 뒤 되살릴 때 쓴다)
      get editors() { return [...editors]; },
      get closed() { return closed; },
      people: () => [self(), ...list()].map((p) => ({ ...p, editor: p.pid === HOST_ID || editors.has(p.pid) })),
      cast: () => cast,
      get canEdit() { return canEdit; },
      MAX_CAST,

      // 방장: 방을 연다 (아직 아무도 없다).
      // startCast: 방장의 지금 테마 캐릭터들
      open(startCast = []) {
        role = 'host';
        myId = HOST_ID;
        canEdit = true;
        cast = startCast.slice(0, MAX_CAST).map((c) => castItem(c, HOST_ID));
        changed();
        emit('cast', cast, null);
        emit('perm', true);
      },
      // 방장: 꾸미기 권한을 주거나 거둔다.
      grant(pid, on) {
        if (role !== 'host' || !people.has(pid)) return;
        if (on) editors.add(pid);
        else editors.delete(pid);
        broadcast({ t: 'perm', editors: [...editors] });
        changed();
      },
      // 방 캐릭터 데려오기 / 빼기 (방장 또는 권한 받은 사람)
      addCast(item) {
        if (!canEdit || closed) return false;
        if (cast.length >= MAX_CAST) return false;
        if (role === 'host') editCast(HOST_ID, { t: 'castAdd', item });
        else hostLink.send({ t: 'castAdd', item });
        return true;
      },
      removeCast(key) {
        if (!canEdit || closed) return;
        if (role === 'host') editCast(HOST_ID, { t: 'castRemove', key });
        else hostLink.send({ t: 'castRemove', key });
      },
      // 방장: 한 사람을 위한 초대 코드. 답장을 받기 전에 다시 만들면 앞의 초대는 버린다.
      async invite() {
        if (pending) pending.link.close();
        if (people.size + 1 >= MAX_PEOPLE) throw new (V().VisitError)(`방에는 ${MAX_PEOPLE}명까지 들어올 수 있어요.`);
        nextMember += 1;
        const pid = `m${nextMember}`;
        const entry = { pid, link: null };
        entry.link = makeLink({
          onOpen: () => {
            if (pending === entry) pending = null;
            links.set(pid, entry.link);
          },
          onMessage: (msg) => hostMessage(pid, msg),
          onClose: () => {
            if (pending === entry) pending = null;
            if (!closed && links.has(pid)) dropMember(pid);
          },
        });
        pending = entry;
        return entry.link.invite(cleanNick(me().nick));
      },
      // 방장: 답장 코드를 넣으면 그 사람이 들어온다. 돌려주는 값: 상대 이름
      async accept(replyCode) {
        if (!pending) throw new (V().VisitError)('먼저 초대 코드를 만들어 주세요.');
        const peer = await pending.link.finish(replyCode);
        return peer.nick;
      },

      // ---------- 방 코드 방식 (중계 서버) ----------
      // 방장: 방 코드로 방을 연다. 서버에 자리를 잡으면 끝난다 (그 뒤로 같은 코드로 몇 명이든 들어온다).
      // opts.prev: 새로고침하기 전에 쓰던 자리('h')로 돌아간다. opts.editors: 그때 꾸미기 권한을 준 사람들
      async openOnline(code, startCast = [], opts = {}) {
        role = 'host';
        myId = HOST_ID;
        canEdit = true;
        cast = startCast.slice(0, MAX_CAST).map((c) => castItem(c, HOST_ID));
        const memberPid = (id) => `m${String(id).replace(/^p/, '')}`;
        for (const pid of opts.editors || []) editors.add(String(pid));
        // 새로고침해서 돌아온 방장: 서버가 알려 주는 동료들에게 다시 인사해 달라고 한다.
        let resuming = Boolean(opts.prev);
        const early = new Map(); // pid → 인사 전에 온 말들
        await new Promise((resolve, reject) => {
          let ready = false;
          makeHub({
            code,
            role: 'host',
            prev: opts.prev || null,
            on: {
              open(id) {
                ready = true;
                relayId = id;
                if (resuming) setTimeout(() => { resuming = false; }, 5000);
                changed();
                emit('cast', cast, null);
                emit('perm', true);
                resolve();
              },
              join(id) {
                const pid = memberPid(id);
                links.set(pid, { send: (msg) => hub && hub.send(id, msg), close: () => {} });
                if (resuming) sendTo(pid, { t: 'who' });
              },
              away(id, on) {
                const pid = memberPid(id);
                const p = people.get(pid);
                if (!p) return;
                markAway(p, on);
                broadcast({ t: 'away', pid, on }, pid);
              },
              leave(id) {
                const pid = memberPid(id);
                if (!links.has(pid)) return;
                links.delete(pid);
                removePerson(pid);
                broadcast({ t: 'leave', pid });
              },
              message(from, msg) {
                const pid = memberPid(from);
                // 새로고침해서 돌아온 직후: 아직 인사를 다시 받지 못한 동료의 말은 인사를 받은 뒤에 처리한다.
                if (resuming && msg && msg.t !== 'hello' && !people.has(pid)) {
                  if (!early.has(pid)) early.set(pid, []);
                  early.get(pid).push(msg);
                  return;
                }
                hostMessage(pid, msg);
                if (msg && msg.t === 'hello' && early.has(pid)) {
                  const list = early.get(pid);
                  early.delete(pid);
                  for (const m of list) hostMessage(pid, m);
                }
              },
              wobble(state) {
                emit('wobble', state);
              },
              close(reason) {
                if (!ready) return reject(new (V().VisitError)(closeNote(reason)));
                finish(reason === 'left' ? 'left' : 'lost');
              },
            },
          }).then((h) => { hub = h; }, reject);
        });
      },
      // 동료: 방 코드로 들어간다. 방장에게 인사가 닿으면 join 알림이 온다.
      // opts.prev: 새로고침하기 전에 쓰던 자리 번호로 돌아간다
      async enter(code, opts = {}) {
        role = 'member';
        await new Promise((resolve, reject) => {
          let ready = false;
          makeHub({
            code,
            role: 'member',
            prev: opts.prev || null,
            on: {
              open(id) {
                ready = true;
                relayId = id;
                hostLink = { send: (msg) => hub && hub.send('h', msg), close: () => {} };
                sayHello();
                resolve();
              },
              away(id, on) {
                // 방장이 자리를 비웠다/돌아왔다 (아직 방장을 모르면 이름 없이 알린다)
                if (id !== 'h') return;
                const p = people.get(HOST_ID);
                if (p) markAway(p, on);
                else emit('away', { pid: HOST_ID }, on);
              },
              message(from, msg) {
                if (from === 'h') memberMessage(msg);
              },
              wobble(state) {
                emit('wobble', state);
                // 다시 붙었다: 방장이 그사이 새로고침했을 수도 있으니 다시 인사한다 (같은 인사는 덮어쓸 뿐이다).
                if (state === 'back') sayHello();
              },
              close(reason) {
                if (!ready) return reject(new (V().VisitError)(closeNote(reason)));
                finish(reason === 'host-left' || reason === 'full' ? reason : reason === 'left' ? 'left' : 'lost');
              },
            },
          }).then((h) => { hub = h; }, reject);
        });
      },

      // 동료: 받은 초대 코드로 답장 코드를 만든다. 방장이 그 코드를 넣으면 들어간다.
      async join(inviteCode) {
        role = 'member';
        hostLink = makeLink({
          onOpen: () => {
            const m = me();
            hostLink.send({ t: 'hello', nick: cleanNick(m.nick), avatar: m.avatar || null });
          },
          onMessage: memberMessage,
          onClose: () => finish('lost'),
        });
        const { reply, peer } = await hostLink.accept(inviteCode, cleanNick(me().nick));
        return { reply, hostNick: peer.nick };
      },

      // 말하기: 내 말을 방 전체에 보낸다.
      say(text) {
        const t = cleanText(text);
        if (!t || closed) return null;
        if (role === 'host') broadcast({ t: 'say', from: HOST_ID, text: t });
        else if (hostLink) hostLink.send({ t: 'say', text: t });
        return t;
      },
      // 다른 사람의 아바타를 쓰다듬었다 → 그 사람 화면의 아바타가 반응한다.
      pet(pid) {
        if (role === 'host') sendTo(pid, { t: 'pet', from: HOST_ID, to: pid });
        else if (hostLink) hostLink.send({ t: 'pet', to: pid });
      },
      // 내 아바타를 바꿨다.
      avatarChanged() {
        const m = self();
        if (role === 'host') broadcast({ t: 'join', pid: HOST_ID, nick: m.nick, avatar: m.avatar });
        else if (hostLink) hostLink.send({ t: 'avatar', avatar: m.avatar });
        changed();
      },
      // 나가기. 방장이 나가면 방이 닫힌다.
      leave() {
        leaving = true;
        if (role === 'host') broadcast({ t: 'bye' });
        else if (hostLink) hostLink.send({ t: 'bye' });
        // 인사가 전해질 틈을 조금 준다.
        setTimeout(() => finish('left'), 200);
      },
      // 방장이 자기 쪽에서 동료를 내보낸다 (그 동료 아바타의 👋 돌려보내기).
      kick(pid) {
        if (role !== 'host') return;
        sendTo(pid, { t: 'bye', reason: 'kicked' });
        setTimeout(() => dropMember(pid), 200);
      },
    };
    return room;
  }

  const NOTES = {
    full: '방이 꽉 찼어요.',
    taken: '같은 코드의 방이 이미 있어요. 다시 만들어 주세요.',
    'no-host': '그 코드의 방이 없어요. 방장이 방을 열어 두었는지, 코드가 맞는지 확인해 주세요.',
    'host-away': '방장의 연결이 잠깐 끊겼어요. 몇 초 뒤 다시 해 주세요.',
    unreachable: '중계 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.',
  };
  const closeNote = (reason) => NOTES[reason] || '방에 연결하지 못했어요.';

  const api = { createRoom, HOST_ID, MAX_PEOPLE, MAX_CAST };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HW40_ROOM = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
})({});
