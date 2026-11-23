// 부위로 만들기: 몸·머리·팔·다리를 따로 그린 그림(PNG 여러 장 또는 PSD 레이어)에 돌아갈 기준점(핀)을 꽂고,
// 서 있기·걷기·손 흔들기 같은 움직임을 부위마다 돌려서 프레임 그림으로 구워 낸다.
// 구운 그림은 보통 캐릭터 그림 칸(idle, walk, act_wave…)에 들어가므로 하이웍스 화면은 따로 바꿀 것이 없다.
// 캐릭터 만들기 화면(maker.html)이 쓴다. 그림 굽기 말고는 화면 없이 테스트할 수 있다.
(function (root) {
  class RigError extends Error {}

  // 부위 역할: 어떻게 움직일지 정한다
  const ROLES = [
    ['body', '몸'],
    ['head', '머리·얼굴'],
    ['arm-front', '앞팔'],
    ['arm-back', '뒷팔'],
    ['leg-front', '앞다리'],
    ['leg-back', '뒷다리'],
    ['ear', '귀·더듬이·새싹'],
    ['tail', '꼬리'],
    ['deco', '장식 (몸 따라감)'],
    ['fixed', '고정 (안 움직임)'],
  ];
  const ROLE_KEYS = ROLES.map((r) => r[0]);

  // 몸 틀: 다리를 얼마나 흔들고 몸을 얼마나 출렁일지
  const TEMPLATES = {
    round: { label: '동글이형 (짧은 다리)', leg: 24, arm: 1, bob: 0.03 },
    biped: { label: '팔다리형 (사람처럼)', leg: 30, arm: 1.4, bob: 0.025 },
    quad: { label: '네발형 (앞뒤 다리)', leg: 26, arm: 0.6, bob: 0.02 },
    float: { label: '둥둥형 (다리 없이 떠다님)', leg: 6, arm: 1, bob: 0.06 },
  };

  // 이름으로 역할 짐작 (레이어 이름·파일 이름). 순서가 중요하다: "앞다리"가 "다리"보다 먼저.
  const GUESS = [
    [/(leg|다리|발)[^a-z]*(back|뒤|뒷|left|왼|2)|(back|뒤|뒷|left|왼)[^a-z]*(leg|다리|발)/i, 'leg-back'],
    [/leg|다리|발|foot|feet/i, 'leg-front'],
    [/(arm|hand|팔|손)[^a-z]*(back|뒤|뒷|left|왼|2)|(back|뒤|뒷|left|왼)[^a-z]*(arm|hand|팔|손)/i, 'arm-back'],
    [/arm|hand|팔|손/i, 'arm-front'],
    [/ear|귀|antenna|더듬|sprout|새싹|horn|뿔|잎/i, 'ear'],
    [/tail|꼬리/i, 'tail'],
    [/head|face|얼굴|머리|눈|eye|mouth|입/i, 'head'],
    [/body|몸|torso|배/i, 'body'],
    [/shadow|그림자|bg|배경|fixed|고정/i, 'fixed'],
  ];
  const guessRole = (name) => {
    for (const [re, role] of GUESS) if (re.test(String(name || ''))) return role;
    return 'deco';
  };

  // 핀 자동 위치: 부위가 그려진 네모(box)와 몸 가운데(center)로 정한다.
  // 다리·팔은 윗끝(붙은 곳), 머리는 아랫끝(목), 몸은 발바닥, 귀·꼬리·장식은 몸 쪽으로 가장 가까운 점.
  function autoPivot(role, box, center) {
    const w = box.x1 - box.x0;
    const h = box.y1 - box.y0;
    const mid = box.x0 + w / 2;
    const near = () => [Math.min(Math.max(center[0], box.x0), box.x1), Math.min(Math.max(center[1], box.y0), box.y1)];
    switch (role) {
      case 'leg-front':
      case 'leg-back':
      case 'arm-front':
      case 'arm-back':
        return [mid, box.y0 + h * 0.12];
      case 'head':
        return [mid, box.y1 - h * 0.1];
      case 'body':
        return [mid, box.y1];
      case 'ear':
      case 'tail':
      case 'deco':
        return near();
      default:
        return [mid, box.y0 + h / 2];
    }
  }

  // 그림에서 칠해진 곳의 네모 (alpha가 있는 곳). 아무것도 없으면 null
  function alphaBox(rgba, width, height) {
    let x0 = width;
    let y0 = height;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (rgba[(y * width + x) * 4 + 3] > 16) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
  }

  // ---------- 움직임 ----------
  // 부위 하나의 자세: r(도, 시계 방향 +, 오른쪽을 보는 그림 기준), lift(몸이 떠오르는 정도, 그림 높이 대비)
  const TAU = Math.PI * 2;
  const bell = (t) => Math.sin(Math.PI * t); // 0 → 1 → 0
  const plateau = (t, edge = 0.15) => Math.max(0, Math.min(1, t / edge, (1 - t) / edge)); // 0 → 1 … 1 → 0
  function poseOf(name, role, t, tpl, has) {
    const S = Math.sin(TAU * t);
    const C = Math.cos(TAU * t);
    const leg = role === 'leg-front' ? 1 : role === 'leg-back' ? -1 : 0;
    const arm = role === 'arm-front' ? 1 : role === 'arm-back' ? -1 : 0;
    // 팔이 없는 캐릭터는 손짓을 귀·장식이 대신한다
    const hand = role === 'arm-front' || (!has['arm-front'] && (role === 'ear' || role === 'deco'));
    const p = { r: 0, lift: 0 };
    const idle = () => {
      p.lift = 0.012 * (1 + S) * 0.5;
      if (role === 'ear') p.r = 4 * S;
      if (role === 'tail') p.r = 6 * S;
      if (role === 'head') p.r = 1.5 * S;
      if (arm) p.r = 3 * S;
    };
    switch (name) {
      case 'still': // 핀 고치기: 움직이지 않는다
        break;
      case 'idle':
        idle();
        break;
      case 'walk':
        p.lift = tpl.bob * Math.abs(S);
        if (leg) p.r = tpl.leg * S * leg;
        if (arm) p.r = -18 * tpl.arm * S * arm;
        if (role === 'head') p.r = 2 * S;
        if (role === 'ear') p.r = 6 * C;
        if (role === 'tail') p.r = 12 * S;
        break;
      case 'celebrate':
        p.lift = 0.04 * Math.abs(S);
        if (arm) p.r = -140 + 20 * S * arm;
        if (role === 'ear') p.r = 10 * S;
        if (role === 'tail') p.r = 16 * S;
        if (leg) p.r = 8 * S * leg;
        break;
      case 'hop':
        if (leg) p.r = 18 * bell(t) * leg;
        if (arm) p.r = -100 * bell(t);
        if (role === 'ear' || role === 'tail') p.r = -12 * bell(t);
        break;
      case 'wave':
        idle();
        if (hand) {
          const env = plateau(t, 0.2); // 들었다가 마지막에 내린다
          p.r = env * (role === 'arm-front' ? -150 + 25 * Math.sin(TAU * 2 * t) : 18 * Math.sin(TAU * 2 * t));
        }
        break;
      case 'punch':
        idle();
        if (hand) p.r = t < 0.35 ? 25 * (t / 0.35) : t < 0.6 ? -95 : -95 * (1 - (t - 0.6) / 0.4);
        break;
      case 'swing':
        idle();
        if (hand) p.r = t < 0.35 ? -160 * (t / 0.35) : t < 0.6 ? -160 + 220 * ((t - 0.35) / 0.25) : 60 * (1 - (t - 0.6) / 0.4);
        break;
      case 'give':
        idle();
        if (hand) p.r = -85 * bell(t);
        break;
      case 'highfive':
        idle();
        if (hand) p.r = -165 * bell(t);
        break;
      case 'hug':
        idle();
        if (arm) p.r = -80 * bell(t);
        break;
      case 'throw':
        idle();
        if (hand) p.r = t < 0.4 ? 40 * (t / 0.4) : -130 * bell((t - 0.4) / 0.6) + 40 * (1 - (t - 0.4) / 0.6);
        break;
      case 'dance':
        p.lift = 0.03 * Math.abs(S);
        if (arm) p.r = -120 * (0.5 + 0.5 * S * arm) * plateau(t);
        if (leg) p.r = 12 * S * leg;
        if (role === 'head') p.r = 6 * S;
        if (role === 'ear' || role === 'tail') p.r = 14 * S;
        break;
      case 'laugh': {
        const q = Math.sin(TAU * 2 * t);
        p.lift = 0.015 * Math.abs(q);
        if (role === 'head') p.r = 6 * q;
        if (arm) p.r = -30 * Math.abs(q);
        if (role === 'ear') p.r = 8 * q;
        break;
      }
      case 'cry':
        if (role === 'head') p.r = 8;
        if (arm) p.r = (-110 + 10 * Math.sin(TAU * 3 * t)) * plateau(t);
        if (role === 'ear') p.r = 20;
        if (role === 'tail') p.r = 25;
        break;
      case 'eat':
        idle();
        if (role === 'arm-front') p.r = -100 * (0.5 + 0.5 * Math.sin(TAU * 2 * t)) * plateau(t);
        if (role === 'head') p.r = 4 * Math.sin(TAU * 2 * t);
        break;
      default:
        idle();
    }
    return p;
  }

  // 구울 움직임: 칸 이름(key), 쓰는 움직임(pose), 장 수, 빠르기. loop가 false면 끝 장(제자리)에서 멈춘다.
  // 상호작용 동작(act_…)은 그 동작 길이에 맞췄다 (장 수 ÷ 빠르기 ≈ 동작 시간).
  // 서두르기·도망·퇴근 후는 걷기·서 있기 그림으로 대신 나오므로 굽지 않는다 (코드를 짧게).
  const BAKE = [
    { key: 'idle', pose: 'idle', n: 6, fps: 6, label: '서 있기' },
    { key: 'walk', pose: 'walk', n: 8, fps: 10, label: '걷기' },
    { key: 'celebrate', pose: 'celebrate', n: 8, fps: 8, label: '축하' },
    { key: 'hop', pose: 'hop', n: 6, fps: 10, loop: false, label: '폴짝' },
    { key: 'meet', pose: 'wave', n: 8, fps: 10, label: '인사' },
    { key: 'act_wave', pose: 'wave', n: 8, fps: 8, loop: false, label: '손 흔들기' },
    { key: 'act_punch', pose: 'punch', n: 6, fps: 11, loop: false, label: '꿀밤' },
    { key: 'act_swing', pose: 'swing', n: 6, fps: 7, loop: false, label: '칼 휘두르기' },
    { key: 'act_give', pose: 'give', n: 6, fps: 7, loop: false, label: '건네기' },
    { key: 'act_highfive', pose: 'highfive', n: 6, fps: 8, loop: false, label: '하이파이브' },
    { key: 'act_hug', pose: 'hug', n: 6, fps: 5, loop: false, label: '껴안기' },
    { key: 'act_dance', pose: 'dance', n: 8, fps: 5, loop: false, label: '춤' },
    { key: 'act_laugh', pose: 'laugh', n: 6, fps: 7, loop: false, label: '웃기' },
    { key: 'act_cry', pose: 'cry', n: 6, fps: 6, loop: false, label: '울기' },
    { key: 'act_eat', pose: 'eat', n: 6, fps: 6, loop: false, label: '먹기' },
    { key: 'act_toss', pose: 'throw', n: 6, fps: 7, loop: false, label: '던지기' },
    { key: 'act_magic', pose: 'throw', n: 6, fps: 7, loop: false, label: '마법' },
    { key: 'act_heart', pose: 'throw', n: 6, fps: 7, loop: false, label: '하트' },
    { key: 'act_shoot', pose: 'throw', n: 6, fps: 8, loop: false, label: '쏘기' },
  ];
  // 한 움직임의 i번째 장이 가리키는 시간 (0~1). 되풀이하는 움직임은 끝과 처음이 겹치지 않게 나눈다.
  const timeOf = (b, i) => (b.loop === false ? i / (b.n - 1) : i / b.n);

  // 굽는 그림의 여백: 팔을 들면 머리 위로 나가므로 위·옆에 여백을 둔다. 바닥은 여백 없이 그대로 (뜨지 않게).
  const PAD = { top: 0.18, side: 0.12 };

  // 부위들을 한 장에 그린다. ctx: 2D 캔버스, imgs: 부위 그림(같은 크기 W×H), mirror: 왼쪽을 보는 그림이면 -1
  function drawPose(ctx, imgs, parts, poseName, t, opts) {
    const { W, H, scale, tpl, mirror = 1 } = opts;
    const has = {};
    for (const p of parts) has[p.role] = true;
    const ox = W * PAD.side;
    const oy = H * PAD.top;
    ctx.save();
    ctx.scale(scale, scale);
    parts.forEach((part, i) => {
      const pose = role0(part.role) ? { r: 0, lift: 0 } : poseOf(poseName, part.role, t, tpl, has);
      const lift = part.role.startsWith('leg') ? 0 : pose.lift * H;
      const [px, py] = part.pivot;
      ctx.save();
      ctx.translate(ox, oy - lift);
      ctx.translate(px, py);
      ctx.rotate((pose.r * mirror * Math.PI) / 180);
      ctx.translate(-px, -py);
      ctx.drawImage(imgs[i], 0, 0, W, H);
      ctx.restore();
    });
    ctx.restore();
  }
  const role0 = (role) => role === 'fixed';

  // 모든 움직임을 구워 그림 칸 설정으로 돌려준다. { key: { frames, fps, motion, loop? } }
  // makeCanvas(w, h)와 toUrl(canvas)는 화면이 준다 (테스트에서는 가짜를 넣는다).
  function bakeAll(rig, imgs, { facing = 'right', maxSide = 128, only, makeCanvas, toUrl }) {
    const tpl = TEMPLATES[rig.tpl] || TEMPLATES.round;
    const cw = rig.W * (1 + PAD.side * 2);
    const ch = rig.H * (1 + PAD.top);
    const scale = Math.min(1, maxSide / Math.max(cw, ch));
    const w = Math.max(1, Math.round(cw * scale));
    const h = Math.max(1, Math.round(ch * scale));
    const mirror = facing === 'left' ? -1 : 1;
    const out = {};
    for (const b of BAKE) {
      if (only && !only.includes(b.key)) continue;
      const frames = [];
      for (let i = 0; i < b.n; i += 1) {
        const c = makeCanvas(w, h);
        drawPose(c.getContext('2d'), imgs, rig.parts, b.pose, timeOf(b, i), { W: rig.W, H: rig.H, scale, tpl, mirror });
        frames.push(toUrl(c));
      }
      out[b.key] = { frames, fps: b.fps, motion: 'none', ...(b.loop === false ? { loop: false } : {}) };
    }
    return out;
  }

  // ---------- PSD 읽기 ----------
  // 8비트 RGB PSD의 레이어를 읽는다 (압축 없음·RLE). 그룹은 풀고, 숨긴 레이어와 빈 레이어는 뺀다.
  // 돌려주는 값: { width, height, layers: [{ name, left, top, width, height, rgba }] } (뒤 → 앞 순서)
  function parsePsd(buf) {
    const v = new DataView(buf);
    let o = 0;
    const need = (n) => {
      if (o + n > v.byteLength) throw new RigError('PSD 파일이 중간에 끊겼어요.');
    };
    const u8 = () => { need(1); return v.getUint8(o++); };
    const u16 = () => { need(2); const x = v.getUint16(o); o += 2; return x; };
    const i16 = () => { need(2); const x = v.getInt16(o); o += 2; return x; };
    const u32 = () => { need(4); const x = v.getUint32(o); o += 4; return x; };
    const i32 = () => { need(4); const x = v.getInt32(o); o += 4; return x; };
    const str = (n) => { let s = ''; for (let i = 0; i < n; i += 1) s += String.fromCharCode(u8()); return s; };

    if (v.byteLength < 26 || str(4) !== '8BPS') throw new RigError('PSD 파일이 아니에요.');
    if (u16() !== 1) throw new RigError('큰 문서(PSB)는 읽지 못해요. PSD로 저장해 주세요.');
    o += 6;
    u16(); // 전체 채널 수
    const height = u32();
    const width = u32();
    const depth = u16();
    const mode = u16();
    if (depth !== 8 || mode !== 3) throw new RigError('8비트 RGB PSD만 읽을 수 있어요. (이미지 → 모드 → RGB, 8비트)');
    const skip = () => { const n = u32(); o += n; };
    skip(); // 색상 모드 데이터
    skip(); // 이미지 리소스
    const lmLen = u32();
    if (!lmLen) throw new RigError('PSD에 레이어가 없어요. 부위마다 레이어를 나눠 저장해 주세요.');
    const liLen = u32();
    if (!liLen) throw new RigError('PSD에 레이어가 없어요. 부위마다 레이어를 나눠 저장해 주세요.');
    const count = Math.abs(i16());
    const recs = [];
    for (let i = 0; i < count; i += 1) {
      const top = i32();
      const left = i32();
      const bottom = i32();
      const right = i32();
      const nch = u16();
      const chans = [];
      for (let c = 0; c < nch; c += 1) chans.push({ id: i16(), len: u32() });
      str(4); // 8BIM
      str(4); // 섞기 방식
      const opacity = u8();
      u8();
      const flags = u8();
      u8();
      const extraLen = u32();
      const extraEnd = o + extraLen;
      const maskLen = u32();
      let mask = null;
      if (maskLen >= 16) {
        const mt = i32();
        const ml = i32();
        const mb = i32();
        const mr = i32();
        mask = { w: mr - ml, h: mb - mt };
        o += maskLen - 16;
      } else o += maskLen;
      skip(); // 섞기 범위
      const nlen = u8();
      const raw = [];
      for (let k = 0; k < nlen; k += 1) raw.push(u8());
      let name = String.fromCharCode(...raw);
      o += (4 - ((1 + nlen) % 4)) % 4;
      let group = false;
      while (o + 12 <= extraEnd) {
        const sig = str(4);
        if (sig !== '8BIM' && sig !== '8B64') break;
        const key = str(4);
        const len = u32();
        const end = o + len;
        if (key === 'luni' && len >= 4) {
          const n = u32();
          let s = '';
          for (let k = 0; k < n && o + 2 <= end; k += 1) s += String.fromCharCode(u16());
          name = s.replace(/\u0000+$/, '');
        } else if ((key === 'lsct' || key === 'lsdk') && len >= 4) {
          group = u32() !== 0; // 1·2: 그룹 열림·닫힘, 3: 그룹 끝 표시
        }
        o = end + (len % 2);
      }
      o = extraEnd;
      recs.push({ top, left, w: right - left, h: bottom - top, chans, mask, name, hidden: Boolean(flags & 2), opacity, group });
    }
    const layers = [];
    for (const L of recs) {
      const ok = L.w > 0 && L.h > 0 && !L.group;
      const rgba = ok ? new Uint8ClampedArray(L.w * L.h * 4).fill(255) : null;
      for (const ch of L.chans) {
        const start = o;
        const comp = u16();
        let cw = L.w;
        let chh = L.h;
        if (ch.id < -1) {
          cw = L.mask ? L.mask.w : 0;
          chh = L.mask ? L.mask.h : 0;
        }
        const target = ok && ch.id >= -1 && ch.id <= 2 ? (ch.id === -1 ? 3 : ch.id) : -1;
        const total = cw * chh;
        if (comp === 0) {
          if (target >= 0) for (let p = 0; p < total; p += 1) rgba[p * 4 + target] = v.getUint8(o + p);
        } else if (comp === 1) {
          const counts = [];
          for (let r = 0; r < chh; r += 1) counts.push(u16());
          let p = 0;
          for (let r = 0; r < chh; r += 1) {
            const rowEnd = o + counts[r];
            while (o < rowEnd) {
              const n = v.getInt8(o++);
              if (n >= 0) {
                for (let k = 0; k <= n; k += 1) {
                  if (target >= 0 && p < total) rgba[p * 4 + target] = v.getUint8(o);
                  o += 1;
                  p += 1;
                }
              } else if (n !== -128) {
                const val = v.getUint8(o++);
                for (let k = 0; k < 1 - n; k += 1) {
                  if (target >= 0 && p < total) rgba[p * 4 + target] = val;
                  p += 1;
                }
              }
            }
          }
        } else if (ch.len > 2 && target >= 0) {
          throw new RigError('ZIP으로 압축된 PSD는 읽지 못해요. 포토샵에서 "호환성 최대화"로 저장하거나 부위 PNG로 내보내 주세요.');
        }
        o = start + ch.len;
      }
      if (!ok || L.hidden) continue;
      if (L.opacity < 255) for (let p = 3; p < rgba.length; p += 4) rgba[p] = Math.round((rgba[p] * L.opacity) / 255);
      layers.push({ name: L.name || `레이어 ${layers.length + 1}`, left: L.left, top: L.top, width: L.w, height: L.h, rgba });
    }
    if (!layers.length) throw new RigError('PSD에서 보이는 레이어를 찾지 못했어요.');
    return { width, height, layers };
  }

  const rig = { RigError, ROLES, ROLE_KEYS, TEMPLATES, BAKE, PAD, guessRole, autoPivot, alphaBox, poseOf, timeOf, drawPose, bakeAll, parsePsd };
  if (typeof module !== 'undefined' && module.exports) module.exports = rig;
  else root.HW40_RIG = rig;
})(typeof globalThis !== 'undefined' ? globalThis : this);
