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
