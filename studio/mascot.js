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
    m.free = () => !m.dragging && !m.falling && m.y === 0 && !m.menuOpen && !m.phase && !m.showingWork;
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
  // ---------- 알려 줄 친구 ----------
  // 근무 상황(서두름·축하·퇴근 계획 알림)을 누가 표현할지: 'all'(모두, 기본) · 'off'(아무도) · 캐릭터 키(그 친구만).
  const PLATFORM = globalThis.HW40_PLATFORM;
  const ANNOUNCER_KEY = 'announcer';
  let announcer = (PLATFORM && PLATFORM.get(ANNOUNCER_KEY, 'all')) || 'all';
  const memberKey = (m) => m.bondKey || m.name;
  // 고른 친구가 지금 테마에 없으면 모두가 표현한다.
  const announcers = () => {
    if (announcer === 'off') return [];
    if (announcer === 'all') return mascots;
    const one = mascots.filter((m) => memberKey(m) === announcer);
    return one.length ? one : mascots;
  };
  api.announcer = {
    get: () => announcer,
    set(v) {
      announcer = v === 'off' || v === 'all' ? v : String(v || 'all');
      if (PLATFORM) PLATFORM.set(ANNOUNCER_KEY, announcer);
    },
    // 고를 수 있는 친구: [{ key, name }]
    list: () => mascots.map((m) => ({ key: memberKey(m), name: m.displayName || m.name })),
  };
  // 근무 알림 한마디. 모두일 때는 한 친구가 대표로 말한다.
  api.announce = (text, ms = 4000) => {
    if (off) return false;
    const list = announcers();
    if (!list.length) return false;
    const m = announcer === 'all' ? list[Math.floor(Math.random() * list.length)] : list[0];
    m.say(text, ms);
    return true;
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
      // 근무 상황은 알려 줄 친구만 표현한다. 나머지는 평소처럼 논다.
      const showing = mood === 'normal' ? [] : announcers();
      const all = mood !== 'normal' && showing.length === mascots.length;
      for (const m of mascots) m.showingWork = showing.includes(m); // 근무 상황을 표현 중이면 만남·쫓기에 끼지 않는다
      if (!all) {
        checkMeetings(now);
        checkChase(now);
      }
      everyone().forEach((m) => m.update(now, dt, showing.includes(m) ? mood : 'normal'));
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame((now) => {
    last = now;
    frame(now);
  });
})();
