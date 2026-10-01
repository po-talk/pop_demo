// bubble.js — 無重力の泡の配置と動き（依存なし・ES module）
//
// 泡は 4 種類。どれも「要素 1 つ ＝ 泡 1 つ」で、要素の transform だけを書く（レイアウトは起こさない）。
//   float … 浮かぶ泡。ホーム（家）へ弱いばねで戻りつつ、ゆらぎ・引力（表面張力）・反発で漂う。指で弾ける
//   dock  … 吸着する泡。親の泡の外壁の決まった位置にばねでくっつき、ぷるっと揺れる。弾けない
//   slot  … 整列する泡。親からの決まった位置（ハニカム等）に**ぴたりと**置く。揺れない＝押し間違えない
//   inner … 内側の泡。親の泡の中で漂い、内壁で跳ね返る（部屋の中の参加者など）。要素は親の子に置く
//
// 座標は「ワールド」（カメラで平行移動・拡大する平面）の px。泡の中心で持つ。inner だけは親の中心からの相対。
// テキスト入力中など「動いては困る」ときは space.calm を立てる（ゆらぎを止め、速度を素早く殺す）。
// OS の「視差効果を減らす」が有効なら最初から calm（呼吸もしない）。

const SQ3 = Math.sqrt(3)
const clamp = (v, a, b) => v < a ? a : v > b ? b : v

// ── 並べ方 ────────────────────────────────────────────────────────────
// ハニカム（Apple Watch のホーム画面と同じ六角格子）。中心から外へ渦巻き状に n 個。step＝隣との中心距離
export const hexSpiral = (n, step) => {
  const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]
  const out = [[0, 0]]
  for (let ring = 1; out.length < n; ring++) {
    let q = dirs[4][0] * ring, r = dirs[4][1] * ring
    for (let side = 0; side < 6; side++) {
      for (let k = 0; k < ring; k++) {
        out.push([q, r])
        q += dirs[side][0]; r += dirs[side][1]
      }
    }
  }
  return out.slice(0, n).map(([q, r]) => ({ x: step * (q + r / 2), y: step * r * SQ3 / 2 }))
}

// 親の泡を真ん中に据えたハニカム。親の円にかかる格子点は飛ばし、近い順に n 個（＝親を取り囲む輪）。
// from（度）を指定すると、その向きから時計回りに埋める（例：-90＝真上から）
export const hexAround = (n, step, parentR, from = -90) => {
  const pts = hexSpiral(n * 4 + 40, step)
    .filter(p => Math.hypot(p.x, p.y) >= parentR + step * 0.5 - 0.5)
    .map(p => ({ ...p, d: Math.hypot(p.x, p.y), a: (Math.atan2(p.y, p.x) * 180 / Math.PI - from + 720) % 360 }))
  pts.sort((a, b) => (Math.round(a.d / step * 2) - Math.round(b.d / step * 2)) || a.a - b.a)
  return pts.slice(0, n).map(({ x, y }) => ({ x, y }))
}

// 外へ向けた塊：親の中心から角度 deg の方向、距離 dist の所を中心に、ハニカムで n 個（親基準の座標で返す）
export const hexOut = (n, step, deg, dist) => {
  const a = deg * Math.PI / 180, cx = dist * Math.cos(a), cy = dist * Math.sin(a)
  return hexSpiral(n, step).map(p => ({ x: cx + p.x, y: cy + p.y }))
}

// 親の外壁に沿った弧。中心角 from（度）から gap ずつ。dist＝親の中心からの距離
export const arc = (n, dist, from, gapDeg) =>
  Array.from({ length: n }, (_, i) => {
    const a = (from + gapDeg * i) * Math.PI / 180
    return { x: dist * Math.cos(a), y: dist * Math.sin(a) }
  })

// 親の外壁に「ひっつく」二段の泡（1 段目は壁に接し、2 段目はその谷間に嵌まる）。
// 並び順は 1 段目・2 段目・1 段目…と交互（よく使うものを先に渡せば壁ぎわ・手前に来る）。
// R＝親の半径、rs＝子の半径、from＝1 段目の最初の角度（度）、dir＝+1 時計回り／-1 反時計回り
export const foam = (n, R, rs, from = 20, gap = 3, dir = 1) => {
  const L = 2 * rs + gap
  const d1 = R + rs + gap
  const s = 2 * Math.asin(clamp(L / 2 / d1, 0, 1))                 // 1 段目の隣どうしの中心角
  const d2 = d1 * Math.cos(s / 2) + Math.sqrt(Math.max(0, L * L - d1 * d1 * Math.sin(s / 2) ** 2))
  const a0 = from * Math.PI / 180
  return Array.from({ length: n }, (_, i) => {
    const k = Math.floor(i / 2)
    const [d, a] = i % 2 === 0 ? [d1, a0 + dir * s * k] : [d2, a0 + dir * s * (k + 0.5)]
    return { x: d * Math.cos(a), y: d * Math.sin(a) }
  })
}

// ── 泡 ──────────────────────────────────────────────────────────────
class Body {
  constructor(space, el, o) {
    this.space = space
    this.el = el
    this.kind = o.kind || 'float'
    this.parent = o.parent || null
    this.r = o.r || 40
    this.ox = o.x || 0; this.oy = o.y || 0       // dock/slot/inner：親の中心からの位置。float：ホーム
    this.x = o.at ? o.at.x : this.ox; this.y = o.at ? o.at.y : this.oy
    this.vx = 0; this.vy = 0
    this.home = o.home ?? 0.0016                 // float：ホームへのばね
    this.mass = o.mass || this.r * this.r
    this.drift = o.drift ?? 1                     // ゆらぎの強さ（0＝揺れない）
    this.breath = o.breath ?? (this.kind === 'float' ? 0.018 : 0)
    this.solid = o.solid ?? true                  // 他の泡を押しのけるか
    this.draggable = o.drag ?? (this.kind === 'float' || this.kind === 'inner')
    this.pinned = false                           // true＝その場に留める（中の UI を開いている間など）
    this.phase = Math.random() * 100
    this.visible = true
    this.pop = 0                                  // 現れたときの膨らみ（0→1）
    this.dragging = false
    this.wasDragged = false
    this.sx = 1; this.sy = 1
    this.size(this.r)
    el.classList.add('bub', 'bub-' + this.kind)
    if (this.draggable) this.space._drag(this)
    this.place()
  }
  size(r) { this.r = r; this.el.style.width = this.el.style.height = (r * 2).toFixed(1) + 'px'; this.mass = r * r }
  set(x, y) { this.ox = x; this.oy = y; return this }
  // 中心のワールド座標（inner は親の分を足す）
  get wx() { return this.kind === 'inner' ? this.parent.wx + this.x : this.x }
  get wy() { return this.kind === 'inner' ? this.parent.wy + this.y : this.y }
  // 目標の位置（dock/slot）
  target() {
    const p = this.parent
    return p ? { x: p.x + this.ox, y: p.y + this.oy } : { x: this.ox, y: this.oy }
  }
  place() {
    if (this.kind === 'slot' || this.kind === 'dock') { const t = this.target(); this.x = t.x; this.y = t.y }
    this.vx = this.vy = 0
  }
  remove() { this.space.remove(this) }
}

export class Space {
  // viewport：画面いっぱいの枠（背景ドラッグでパン・ピンチで拡大）／world：その中で transform される平面
  constructor(viewport, world, opt = {}) {
    this.viewport = viewport
    this.world = world
    this.bodies = []
    this.t = 0
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    this.calm = this.reduce
    this.cam = { x: 0, y: 0, s: 1, tx: null, ty: null, ts: 1, vx: 0, vy: 0, user: false }
    this.minScale = opt.minScale ?? 0.35
    this.maxScale = opt.maxScale ?? 2
    this.onFrame = opt.onFrame || null
    this._visTick = 0
    this._pan()
    this._loop = this._loop.bind(this)
    requestAnimationFrame(this._loop)
  }

  add(el, o = {}) {
    const b = new Body(this, el, o)
    this.bodies.push(b)
    return b
  }
  remove(b) {
    const i = this.bodies.indexOf(b)
    if (i >= 0) this.bodies.splice(i, 1)
    this.bodies.filter(c => c.parent === b).forEach(c => this.remove(c))
  }
  bodyOf(el) { return this.bodies.find(b => b.el === el) }

  // ── カメラ ─────────────────────────────────────────────────────
  // ワールドの (x, y) が画面の中央（visualViewport の見えている範囲の中央）に来るよう、span px が収まる倍率で寄る。
  // ユーザーが背景をドラッグしている間は奪わない
  view(x, y, span = null, opt = {}) {
    const vw = this._vw()
    const s = span ? clamp(Math.min(vw.w, vw.h) / span, this.minScale, opt.maxScale ?? 1) : this.cam.ts
    this.cam.ts = s
    this.cam.tx = vw.cx - x * s
    this.cam.ty = vw.cy - y * s
    this.cam.user = false
    if (opt.now) { this.cam.x = this.cam.tx; this.cam.y = this.cam.ty; this.cam.s = s; this._applyCam() }
  }
  _vw() {
    const v = window.visualViewport
    const w = v ? v.width : innerWidth, h = v ? v.height : innerHeight
    const top = v ? v.offsetTop : 0
    return { w, h, cx: w / 2, cy: top + h / 2 }
  }
  // 画面座標 → ワールド座標
  toWorld(px, py) { return { x: (px - this.cam.x) / this.cam.s, y: (py - this.cam.y) / this.cam.s } }

  _applyCam() {
    const c = this.cam
    this.world.style.transform = `translate3d(${c.x.toFixed(2)}px,${c.y.toFixed(2)}px,0) scale(${c.s.toFixed(4)})`
  }

  _pan() {
    const vp = this.viewport, c = this.cam
    let pan = null, pinch = null
    const isBg = e => !e.target.closest('.bub, input, textarea, select, button, a, label, dialog')
    vp.addEventListener('pointerdown', e => {
      if (!isBg(e)) return
      if (pan && pan.id !== e.pointerId) {
        // 2 本目の指：ピンチ
        pinch = { a: pan, b: { id: e.pointerId, x: e.clientX, y: e.clientY }, d0: 0, s0: c.s }
        pinch.d0 = Math.hypot(pinch.a.x - pinch.b.x, pinch.a.y - pinch.b.y) || 1
        return
      }
      pan = { id: e.pointerId, x: e.clientX, y: e.clientY, hist: [] }
      c.vx = c.vy = 0; c.user = true; c.tx = c.ty = null
    })
    addEventListener('pointermove', e => {
      if (pinch && (e.pointerId === pinch.a.id || e.pointerId === pinch.b.id)) {
        const p = e.pointerId === pinch.a.id ? pinch.a : pinch.b
        p.x = e.clientX; p.y = e.clientY
        const d = Math.hypot(pinch.a.x - pinch.b.x, pinch.a.y - pinch.b.y)
        const mx = (pinch.a.x + pinch.b.x) / 2, my = (pinch.a.y + pinch.b.y) / 2
        this._zoomAt(mx, my, clamp(pinch.s0 * d / pinch.d0, this.minScale, this.maxScale))
        return
      }
      if (!pan || e.pointerId !== pan.id) return
      const dx = e.clientX - pan.x, dy = e.clientY - pan.y
      c.x += dx; c.y += dy
      pan.x = e.clientX; pan.y = e.clientY
      pan.hist.push({ dx, dy }); if (pan.hist.length > 5) pan.hist.shift()
      this._applyCam()
    })
    const end = e => {
      if (pinch && (e.pointerId === pinch.a.id || e.pointerId === pinch.b.id)) { pinch = null; pan = null; return }
      if (!pan || e.pointerId !== pan.id) return
      if (pan.hist.length) {
        const n = pan.hist.length
        c.vx = clamp(pan.hist.reduce((a, h) => a + h.dx, 0) / n, -30, 30)
        c.vy = clamp(pan.hist.reduce((a, h) => a + h.dy, 0) / n, -30, 30)
      }
      pan = null
    }
    addEventListener('pointerup', end)
    addEventListener('pointercancel', end)
    vp.addEventListener('wheel', e => {
      if (e.target.closest('.scroll-in')) return   // 泡の中の読み物はスクロールさせる
      e.preventDefault()
      c.user = true; c.tx = c.ty = null
      this._zoomAt(e.clientX, e.clientY, clamp(c.s * (e.deltaY < 0 ? 1.08 : 0.93), this.minScale, this.maxScale))
    }, { passive: false })
  }
  _zoomAt(px, py, s) {
    const c = this.cam, w = this.toWorld(px, py)
    c.s = c.ts = s
    c.x = px - w.x * s; c.y = py - w.y * s
    this._applyCam()
  }

  // ── 泡のドラッグ（弾く） ─────────────────────────────────────────
  _drag(b) {
    let st = null
    b.el.addEventListener('pointerdown', e => {
      if (e.target.closest('input, textarea, select, .no-drag')) return
      if (e.button > 0) return
      // 内側の泡を掴んだら、外側の泡は掴まない
      if (e.target.closest('.bub') !== b.el) return
      st = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, hist: [] }
      b.wasDragged = false
    })
    addEventListener('pointermove', e => {
      if (!st || e.pointerId !== st.id) return
      const s = this.cam.s
      if (!b.dragging && Math.hypot(e.clientX - st.x0, e.clientY - st.y0) > 8) {
        b.dragging = true; b.wasDragged = true
        b.el.classList.add('dragging')
        try { b.el.setPointerCapture(e.pointerId) } catch {}
      }
      if (!b.dragging) return
      const dx = (e.clientX - st.x) / s, dy = (e.clientY - st.y) / s
      b.x += dx; b.y += dy
      st.x = e.clientX; st.y = e.clientY
      st.hist.push({ dx, dy }); if (st.hist.length > 5) st.hist.shift()
    })
    const end = e => {
      if (!st || e.pointerId !== st.id) return
      if (b.dragging && st.hist.length) {
        const n = st.hist.length
        b.vx = clamp(st.hist.reduce((a, h) => a + h.dx, 0) / n * 0.8, -14, 14)
        b.vy = clamp(st.hist.reduce((a, h) => a + h.dy, 0) / n * 0.8, -14, 14)
      }
      b.dragging = false; b.el.classList.remove('dragging')
      st = null
    }
    addEventListener('pointerup', end)
    addEventListener('pointercancel', end)
    // ドラッグした直後の click は捨てる（弾いたつもりがボタンを押していた、を防ぐ）
    b.el.addEventListener('click', e => {
      if (b.wasDragged) { e.stopPropagation(); e.preventDefault(); b.wasDragged = false }
    }, true)
  }

  // ── 1 コマ ───────────────────────────────────────────────────────
  _loop(ts) {
    const dt = this._last ? clamp((ts - this._last) / 16.67, 0.25, 3) : 1
    this._last = ts
    this.t += 0.012 * dt
    if (++this._visTick % 6 === 0) this._checkVisible()
    this._camStep(dt)
    this._step(dt)
    this._render()
    if (this.onFrame) this.onFrame(this)
    requestAnimationFrame(this._loop)
  }

  _checkVisible() {
    for (const b of this.bodies) {
      const v = b.el.isConnected && (b.el.checkVisibility ? b.el.checkVisibility() : !!b.el.offsetParent)
      if (v && !b.visible) { b.pop = 0; b.place(); if (b.kind === 'float' && b.spawn) b.spawn(b) }
      b.visible = v
    }
  }

  _camStep(dt) {
    const c = this.cam
    let moved = false
    if (c.tx !== null && !c.user) {
      const k = 1 - Math.pow(1 - 0.1, dt)
      c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k; c.s += (c.ts - c.s) * k
      if (Math.abs(c.tx - c.x) < 0.3 && Math.abs(c.ty - c.y) < 0.3 && Math.abs(c.ts - c.s) < 0.0005) { c.x = c.tx; c.y = c.ty; c.s = c.ts; c.tx = c.ty = null }
      moved = true
    } else if (Math.abs(c.vx) > 0.02 || Math.abs(c.vy) > 0.02) {
      c.x += c.vx * dt; c.y += c.vy * dt
      c.vx *= Math.pow(0.92, dt); c.vy *= Math.pow(0.92, dt)
      moved = true
    }
    if (moved) this._applyCam()
  }

  _step(dt) {
    const t = this.t, calm = this.calm
    const live = this.bodies.filter(b => b.visible)
    const top = live.filter(b => b.kind !== 'inner')
    // 1) それぞれの力
    for (const b of live) {
      if (b.dragging) continue
      const ph = b.phase
      if (b.kind === 'float') {
        if (b.pinned) { b.vx *= 0.6; b.vy *= 0.6 }
        else {
          const a = calm ? 0 : 0.02 * b.drift
          b.vx += (Math.sin(t * 0.7 + ph) * a + (b.ox - b.x) * b.home) * dt
          b.vy += (Math.cos(t * 0.55 + ph * 1.3) * a + (b.oy - b.y) * b.home) * dt
          const damp = calm ? 0.8 : 0.975
          b.vx *= Math.pow(damp, dt); b.vy *= Math.pow(damp, dt)
        }
      } else if (b.kind === 'dock') {
        const tg = b.target()
        const k = calm ? 0.2 : 0.05
        b.vx += (tg.x - b.x) * k * dt
        b.vy += (tg.y - b.y) * k * dt
        if (!calm && b.drift) {
          b.vx += Math.sin(t * 2.1 + ph) * 0.03 * b.drift * dt
          b.vy += Math.cos(t * 1.7 + ph) * 0.03 * b.drift * dt
        }
        b.vx *= Math.pow(calm ? 0.6 : 0.86, dt); b.vy *= Math.pow(calm ? 0.6 : 0.86, dt)
      } else if (b.kind === 'slot') {
        // 整列：ぴたりと置く（現れた瞬間だけ素早く寄せる）
        const tg = b.target()
        b.x += (tg.x - b.x) * 0.5; b.y += (tg.y - b.y) * 0.5
        b.vx = b.vy = 0
      } else if (b.kind === 'inner') {
        const a = calm ? 0 : 0.05 * b.drift
        b.vx += (-b.x * 0.0012 + Math.sin(t * 1.6 + ph) * a) * dt
        b.vy += (-b.y * 0.0012 + Math.cos(t * 1.3 + ph) * a) * dt
        b.vx *= Math.pow(calm ? 0.7 : 0.97, dt); b.vy *= Math.pow(calm ? 0.7 : 0.97, dt)
      }
    }
    // 2) 浮かぶ泡どうし・浮かぶ泡と他の泡：反発と、近くでの弱い引力（表面張力で寄り添う）
    for (let i = 0; i < top.length; i++) {
      const a = top[i]
      if (!a.solid) continue
      for (let j = i + 1; j < top.length; j++) {
        const b = top[j]
        if (!b.solid) continue
        if (a.kind !== 'float' && b.kind !== 'float' && !(a.kind === 'dock' && b.kind === 'dock')) continue
        // 自分の子（dock/slot）とは押し合わない＝吸着の形を崩さない
        if (a.parent === b || b.parent === a) continue
        const dx = b.x - a.x, dy = b.y - a.y
        const d = Math.hypot(dx, dy) || 0.01
        const gap = a.kind === 'dock' && b.kind === 'dock' ? 2 : 14
        const min = a.r + b.r + gap
        const nx = dx / d, ny = dy / d
        const fa = a.kind === 'float' || a.kind === 'dock', fb = b.kind === 'float' || b.kind === 'dock'
        const ma = fa && !a.dragging && !a.pinned ? 1 / a.mass : 0
        const mb = fb && !b.dragging && !b.pinned ? 1 / b.mass : 0
        const sum = ma + mb
        if (!sum) continue
        if (d < min) {
          const push = (min - d) * 0.5
          a.x -= nx * push * ma / sum; a.y -= ny * push * ma / sum
          b.x += nx * push * mb / sum; b.y += ny * push * mb / sum
          a.vx -= nx * 0.04 * ma / sum; a.vy -= ny * 0.04 * ma / sum
          b.vx += nx * 0.04 * mb / sum; b.vy += ny * 0.04 * mb / sum
        } else if (!calm && a.kind === 'float' && b.kind === 'float' && d < min + 60) {
          // 表面張力：少し離れた泡どうしは、そっと引き合う
          const f = (min + 60 - d) * 0.00004 * dt
          a.vx += nx * f * (ma ? 1 : 0); a.vy += ny * f * (ma ? 1 : 0)
          b.vx -= nx * f * (mb ? 1 : 0); b.vy -= ny * f * (mb ? 1 : 0)
        }
      }
    }
    // 3) 内側の泡：兄弟と押し合い、親の内壁で跳ね返る
    const groups = new Map()
    for (const b of live) if (b.kind === 'inner') {
      if (!groups.has(b.parent)) groups.set(b.parent, [])
      groups.get(b.parent).push(b)
    }
    for (const [p, kids] of groups) {
      for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
        const a = kids[i], b = kids[j]
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01
        const min = a.r + b.r + 6
        if (d < min) {
          const nx = dx / d, ny = dy / d, push = (min - d) * 0.5
          if (!a.dragging) { a.x -= nx * push * 0.5; a.y -= ny * push * 0.5; a.vx -= nx * 0.05; a.vy -= ny * 0.05 }
          if (!b.dragging) { b.x += nx * push * 0.5; b.y += ny * push * 0.5; b.vx += nx * 0.05; b.vy += ny * 0.05 }
        }
      }
      for (const b of kids) {
        const max = p.r - b.r - (p.innerPad ?? 10)
        const d = Math.hypot(b.x, b.y)
        if (max <= 0) { b.x = b.y = 0; continue }
        if (d > max) {
          const nx = b.x / d, ny = b.y / d
          b.x = nx * max; b.y = ny * max
          const vn = b.vx * nx + b.vy * ny
          if (vn > 0) { b.vx -= 1.6 * vn * nx; b.vy -= 1.6 * vn * ny }
        }
      }
    }
    // 4) 動かす
    for (const b of live) {
      if (b.dragging || b.kind === 'slot') continue
      b.x += b.vx * dt; b.y += b.vy * dt
    }
  }

  _render() {
    const t = this.t, calm = this.calm
    for (const b of this.bodies) {
      if (!b.visible) continue
      if (b.pop < 1) b.pop = Math.min(1, b.pop + 0.08)
      const pop = b.pop < 1 ? 0.4 + 0.6 * easeOutBack(b.pop) : 1
      let sx = pop, sy = pop
      if (!calm && !b.dragging) {
        if (b.breath) { const br = 1 + Math.sin(t * 1.1 + b.phase) * b.breath; sx *= br; sy *= br }
        if (b.kind === 'dock') {
          const sq = Math.sin(t * 2.6 + b.phase) * 0.025
          const sp = clamp(b.vy * 0.012, -0.05, 0.05)
          sx *= 1 + sq - sp; sy *= 1 - sq + sp
        }
      }
      // inner の要素は親の要素の子（左上が原点）なので、親の半径ぶんずらす
      const x = b.kind === 'inner' ? b.x + b.parent.r : b.x, y = b.kind === 'inner' ? b.y + b.parent.r : b.y
      b.el.style.transform = `translate3d(${(x - b.r).toFixed(1)}px,${(y - b.r).toFixed(1)}px,0) scale(${sx.toFixed(3)},${sy.toFixed(3)})`
    }
  }
}

const easeOutBack = x => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2)

// ── テキスト入力中は泡を静める ─────────────────────────────────────────
// 入力欄にフォーカスがある間は calm。入力欄を含む泡をカメラの真ん中（キーボードを除いた見えている範囲）へ。
export const calmWhileTyping = (space, root = document) => {
  const isText = el => el && el.matches && el.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, [contenteditable]')
  let base = space.calm
  root.addEventListener('focusin', e => {
    if (!isText(e.target)) return
    base = space.reduce
    space.calm = true
    document.documentElement.classList.add('typing')
    const host = e.target.closest('.bub')
    const b = host && space.bodyOf(host)
    if (b) setTimeout(() => space.view(b.wx, b.wy - (b.r * 0.2)), 250)   // キーボードが出て visualViewport が縮むのを待つ
  })
  root.addEventListener('focusout', e => {
    if (!isText(e.target)) return
    setTimeout(() => {
      if (isText(document.activeElement)) return
      space.calm = base
      document.documentElement.classList.remove('typing')
    }, 60)
  })
}

// ── 長押し（指）・ホバー（マウス）で名前を出す ────────────────────────────
// 文字の代わりにアイコンだけを置いたボタンの「これは何？」。名前は aria-label（無ければ title）から取る。
// 長押しで名前を出したときは、指を離したときの click を捨てる（押すつもりではなかったので）
export const tips = (tipEl, root = document) => {
  let timer = 0, shownFor = null, swallow = false
  const labelOf = el => el.getAttribute('aria-label') || el.getAttribute('data-tip') || el.title || ''
  const show = el => {
    const label = labelOf(el)
    if (!label) return
    tipEl.textContent = label
    // 円の直径は文字数から（短い名前は小さな泡、長い説明は大きな泡。最大でも 3〜4 行に収まる大きさ）
    const n = [...label].length
    const d = clamp(Math.round(Math.sqrt(n) * 24 + 34), 64, 190)
    tipEl.style.width = tipEl.style.height = d + 'px'
    tipEl.hidden = false
    const r = el.getBoundingClientRect()
    const tw = d, th = d
    let x = r.left + r.width / 2 - tw / 2, y = r.top - th - 10
    if (y < 8) y = r.bottom + 10
    x = clamp(x, 8, innerWidth - tw - 8)
    tipEl.style.transform = `translate(${x.toFixed(0)}px,${y.toFixed(0)}px)`
    shownFor = el
  }
  const hide = () => { clearTimeout(timer); tipEl.hidden = true; shownFor = null }
  const target = e => e.target.closest && e.target.closest('[aria-label], [data-tip]')
  root.addEventListener('pointerdown', e => {
    const el = target(e)
    hide()
    if (!el || e.pointerType === 'mouse') return
    timer = setTimeout(() => { show(el); swallow = true; if (navigator.vibrate) try { navigator.vibrate(8) } catch {} }, 480)
  })
  root.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return
    const el = target(e)
    if (el === shownFor) return
    hide()
    if (el) timer = setTimeout(() => show(el), 450)
  })
  const up = () => { clearTimeout(timer); if (shownFor && !swallow) hide(); else if (shownFor) setTimeout(hide, 1400) }
  root.addEventListener('pointerup', up)
  root.addEventListener('pointercancel', () => { hide(); swallow = false })
  root.addEventListener('click', e => { if (swallow) { e.stopPropagation(); e.preventDefault(); swallow = false } }, true)
  root.addEventListener('contextmenu', e => { if (target(e)) e.preventDefault() })   // 長押しのメニューを出さない
  addEventListener('scroll', hide, true)
}
