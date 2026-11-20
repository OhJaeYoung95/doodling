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
