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

// ハニカムの並び（行を半個ずらして詰める）。cols 個ずつの行を作り、奇数行は半個右へ。
// 全体の中心が (0, 0) になるように返す。最後の行が短いときは、その行だけ中央に寄せる。
//   ⚪︎⚪︎⚪︎⚪︎
//    ⚪︎⚪︎⚪︎⚪︎
//   ⚪︎⚪︎⚪︎⚪︎
export const hexGrid = (n, cols, step) => {
  const rows = Math.ceil(n / cols), dy = step * SQ3 / 2
  const out = []
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols), col = i % cols
    const inRow = row === rows - 1 ? n - row * cols : cols
    const shift = row % 2 ? step / 2 : 0
    const lead = (cols - inRow) * step / 2          // 短い最後の行は中央へ
    out.push({ x: col * step + shift + lead - (cols - 1) * step / 2 - (rows > 1 ? step / 4 : 0), y: row * dy - (rows - 1) * dy / 2 })
  }
  return out
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

// 外へ向けた塊：親の中心から角度 deg の方向、距離 dist の所を中心に、ハニカム（半個ずらしの行・cols 個ずつ）で n 個
export const hexOut = (n, cols, step, deg, dist) => {
  const a = deg * Math.PI / 180, cx = dist * Math.cos(a), cy = dist * Math.sin(a)
  return hexGrid(n, cols, step).map(p => ({ x: cx + p.x, y: cy + p.y }))
}

// 親に寄り添う塊：ハニカム（hexGrid）を角度 deg の方向から親へ近づけ、いちばん近い泡が親の外壁に
// ちょうど接する所で止める（gap だけ離す）。塊の形は保ったまま、親とひと続きの泡に見える。
// r＝塊の泡の半径。親基準の座標で返す
export const hexBeside = (n, cols, step, deg, parentR, r, gap = 4) => {
  const g = hexGrid(n, cols, step), a = deg * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a)
  const need = parentR + r + gap
  let lo = 0, hi = parentR + step * (cols + n / cols) + need
  for (let k = 0; k < 40; k++) {   // 二分探索：近いほど小さい距離 d で、全部の泡が need 以上離れる最小の d
    const d = (lo + hi) / 2
    const ok = g.every(p => Math.hypot(p.x + ux * d, p.y + uy * d) >= need)
    if (ok) hi = d; else lo = d
  }
  return g.map(p => ({ x: p.x + ux * hi, y: p.y + uy * hi }))
}

// 親に抱きつく塊：同じハニカムの格子（半個ずらしの行）のうち、親の外壁の deg の方向に近い n マスを選ぶ。
// 親に食い込むマスは飛ばすので、塊の縁が親の円に沿って欠け、泡がひと続きに連なって見える。
// 並び順は上の行から左→右（読む順）。親基準の座標で返す
export const hexHug = (n, step, deg, parentR, r, gap = 4) => {
  const dy = step * SQ3 / 2, need = parentR + r + gap
  const a = deg * Math.PI / 180, fx = Math.cos(a) * (need + step * 0.7), fy = Math.sin(a) * (need + step * 0.7)
  const span = Math.ceil((need + step * 6) / step) + 2
  // 格子の原点を「deg の方向で外壁にちょうど接するマス」に置く＝そのマスは隙間なく親にくっつく
  const ox = Math.cos(a) * need, oy = Math.sin(a) * need
  const cells = []
  for (let k = -span; k <= span; k++) for (let j = -span; j <= span; j++) {
    const x = ox + (j + (Math.abs(k) % 2) / 2) * step, y = oy + k * dy
    if (Math.hypot(x, y) < need - 0.5) continue
    cells.push({ x, y, d: Math.hypot(x - fx, y - fy) })
  }
  cells.sort((p, q) => p.d - q.d)
  return cells.slice(0, n).sort((p, q) => p.y - q.y || p.x - q.x).map(({ x, y }) => ({ x, y }))
}

// 親基準の座標 (x, y) を、半径 R の親の「外壁から」の置き方 { a, d } に直す（Body の wall に渡す）。
// cx, cy を渡すと、その点（塊の中心など）を基準に壁へ付け、(x, y) はそこからのずれとして持つ＝塊の形が崩れない
export const toWall = (p, R, c = null) => {
  const q = c || p, a = Math.atan2(q.y, q.x), d = Math.hypot(q.x, q.y) - R
  return c ? { a, d, dx: p.x - c.x, dy: p.y - c.y } : { a, d }
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
    // dock/slot の置き場所を「親の外壁から」で持つとき：{ a: 角度（ラジアン）, d: 壁からの距離, dx, dy: そこからのずれ }。
    // 親が膨らんだり縮んだりしても、壁にくっついたまま付いていく
    this.wall = o.wall || null
    this.targetR = null
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
    this.visible = el.isConnected && (el.checkVisibility ? el.checkVisibility() : !!el.offsetParent)
    this.shown = this.visible                     // 一度でも見えたか（最初から隠れている泡は、隠れても弾けさせない）
    this.shownAt = performance.now()              // 見え始めた時刻（出た直後に隠したもの＝初期化の都合は弾けさせない）
    this.burst = o.burst ?? true                  // 消えるときに弾けて小泡が散るか
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
    if (p && this.wall) {
      const w = this.wall, d = p.r + w.d
      return { x: p.x + Math.cos(w.a) * d + (w.dx || 0), y: p.y + Math.sin(w.a) * d + (w.dy || 0) }
    }
    return p ? { x: p.x + this.ox, y: p.y + this.oy } : { x: this.ox, y: this.oy }
  }
  // 半径を滑らかに変える（ひとことを開いて部屋を少し大きくする、など）
  grow(r) { this.targetR = r; return this }
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
    this.drops = []      // 弾けたあとに散る小泡
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
  // 要素ごとには pointerdown だけを付け、動かす・離すは Space 全体で 1 組（_dragGlobal）。
  // 要素が作り直されても（rebind）window にリスナーが溜まらない
  _drag(b) {
    if (b.el._zgDrag) return
    b.el._zgDrag = true
    b.el.addEventListener('pointerdown', e => {
      if (e.target.closest('input, textarea, select, .no-drag')) return
      if (e.button > 0) return
      const body = this.bodyOf(e.currentTarget)
      if (!body || !body.draggable) return
      // 内側の泡を掴んだら、外側の泡は掴まない
      if (e.target.closest('.bub') !== body.el) return
      this._dragSt = { b: body, id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, hist: [] }
      body.wasDragged = false
    })
    // ドラッグした直後の click は捨てる（弾いたつもりがボタンを押していた、を防ぐ）
    b.el.addEventListener('click', e => {
      const body = this.bodyOf(e.currentTarget)
      if (body && body.wasDragged) { e.stopPropagation(); e.preventDefault(); body.wasDragged = false }
    }, true)
    if (this._dragGlobal) return
    this._dragGlobal = true
    addEventListener('pointermove', e => {
      const st = this._dragSt
      if (!st || e.pointerId !== st.id) return
      const b = st.b, s = this.cam.s
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
      const st = this._dragSt
      if (!st || e.pointerId !== st.id) return
      const b = st.b
      if (b.dragging && st.hist.length) {
        const n = st.hist.length
        b.vx = clamp(st.hist.reduce((a, h) => a + h.dx, 0) / n * 0.8, -14, 14)
        b.vy = clamp(st.hist.reduce((a, h) => a + h.dy, 0) / n * 0.8, -14, 14)
      }
      b.dragging = false; b.el.classList.remove('dragging')
      this._dragSt = null
    }
    addEventListener('pointerup', end)
    addEventListener('pointercancel', end)
  }

  // 泡の要素を差し替える（元の画面が一覧を作り直すたびに呼ぶ）。位置・速度はそのまま引き継ぐ
  rebind(b, el) {
    if (b.el === el) return
    b.el = el
    el.classList.add('bub', 'bub-' + b.kind)
    b.size(b.r)
    if (b.draggable) this._drag(b)
    this._renderOne(b)
  }

  // ── 1 コマ ───────────────────────────────────────────────────────
  _loop(ts) {
    const dt = this._last ? clamp((ts - this._last) / 16.67, 0.25, 3) : 1
    this._last = ts
    this.t += 0.012 * dt
    if (++this._visTick % 6 === 0) this._checkVisible()
    this._camStep(dt)
    this._step(dt)
    this._drops(dt)
    this._render()
    if (this.onFrame) this.onFrame(this)
    requestAnimationFrame(this._loop)
  }

  _checkVisible() {
    const popping = []
    for (const b of this.bodies) {
      const v = b.el.isConnected && (b.el.checkVisibility ? b.el.checkVisibility() : !!b.el.offsetParent)
      if (v && !b.visible) { b.pop = 0; b.place(); b.shown = true; b.shownAt = performance.now(); if (b.kind === 'float' && b.spawn) b.spawn(b) }
      if (!v && b.visible && b.shown && b.burst && !this.reduce && performance.now() - b.shownAt > 400) popping.push(b)
      b.visible = v
    }
    // まとめて消えるとき（絵文字の並び 16 個など）は、1 つあたりの小泡を減らす＝散りすぎない
    const each = popping.length > 3 ? Math.max(2, Math.round(28 / popping.length)) : null
    popping.forEach(b => this.pop(b, each))
  }

  // ── 弾ける：リングが一瞬広がり、小さな泡が散って、やがて画面の外へ流れて消える ──────────
  // 隠れた（hidden）泡は描けないので、最後にいた位置に別の要素で描く
  pop(b, count = null) {
    const x = b.wx, y = b.wy, r = b.r
    const ring = document.createElement('div')
    ring.className = 'pop-ring'
    Object.assign(ring.style, { left: (x - r) + 'px', top: (y - r) + 'px', width: r * 2 + 'px', height: r * 2 + 'px' })
    this.world.appendChild(ring)
    setTimeout(() => ring.remove(), 420)
    const n = count ?? clamp(Math.round(r / 5), 6, 24)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5
      const d = r * (0.55 + Math.random() * 0.4)
      const sp = 1.2 + Math.random() * 2.2
      const dr = 2 + Math.random() * Math.max(3, r * 0.09)
      const el = document.createElement('div')
      el.className = 'drop'
      el.style.width = el.style.height = (dr * 2).toFixed(1) + 'px'
      this.world.appendChild(el)
      this.drops.push({ el, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.3, r: dr, t: 0, ph: Math.random() * 9 })
    }
  }
  _drops(dt) {
    if (!this.drops.length) return
    const c = this.cam, W = innerWidth, H = innerHeight
    this.drops = this.drops.filter(d => {
      d.t += dt
      // はじめは勢いよく散り、すぐにゆっくり漂う速さまで落ちる（止まりはしない＝そのうち画面の外へ）
      const sp = Math.hypot(d.vx, d.vy), floor = 0.9
      const damp = sp > floor ? Math.pow(0.95, dt) : 1
      d.vx = d.vx * damp + Math.sin(this.t * 1.3 + d.ph) * 0.006 * dt
      d.vy = d.vy * damp - 0.004 * dt                 // ほんの少し浮いていく
      d.x += d.vx * dt; d.y += d.vy * dt
      const sx = d.x * c.s + c.x, sy = d.y * c.s + c.y
      const off = sx < -40 || sy < -40 || sx > W + 40 || sy > H + 40
      if (off || d.t > 60 * 9) { d.el.remove(); return false }   // 画面の外に出たら（最長 9 秒で）消す
      d.el.style.transform = `translate3d(${(d.x - d.r).toFixed(1)}px,${(d.y - d.r).toFixed(1)}px,0)`
      if (d.t > 60 * 7) d.el.style.opacity = Math.max(0, 1 - (d.t - 60 * 7) / 120).toFixed(2)   // 最後の 2 秒で薄れる
      return true
    })
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
    // 0) 膨らむ・縮む
    for (const b of live) if (b.targetR != null) {
      const nr = b.r + (b.targetR - b.r) * (1 - Math.pow(0.84, dt))
      b.size(Math.abs(b.targetR - nr) < 0.3 ? b.targetR : nr)
      if (b.r === b.targetR) b.targetR = null
    }
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
        // 既定は親の中心へゆるく寄る。b.tx/b.ty（親の中心からの位置）があればそこへ寄る（輪に並べるときなど）
        const a = calm ? 0 : 0.05 * b.drift * (b.tx == null ? 1 : 0.12)
        const k = b.tx == null ? 0.0012 : 0.02
        b.vx += ((( b.tx ?? 0) - b.x) * k + Math.sin(t * 1.6 + ph) * a) * dt
        b.vy += ((( b.ty ?? 0) - b.y) * k + Math.cos(t * 1.3 + ph) * a) * dt
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
    for (const b of this.bodies) if (b.visible) this._renderOne(b)
  }
  _renderOne(b) {
    const t = this.t, calm = this.calm
    {
      // 現れるとき：ほぼ 0 から膨らみ、少し行き過ぎてから落ち着く（シャボン玉を吹いたときの「ぷくっ」）
      if (b.pop < 1) b.pop = Math.min(1, b.pop + (this.reduce ? 1 : 0.055))
      const pop = b.pop < 1 ? inflate(b.pop) : 1
      b.el.style.opacity = b.pop < 1 ? Math.min(1, b.pop * 4).toFixed(2) : ''
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

// 0→1 で 0.05 → 1.14 → 0.97 → 1 と揺れて落ち着く
const inflate = p => 1 - Math.cos(p * Math.PI * 1.5) * Math.exp(-p * 4.2) * 0.95

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
  root.addEventListener('click', e => { if (swallow) { e.stopPropagation(); e.preventDefault(); swallow = false } else hide() }, true)   // 押したら名前の小泡は引っ込める
  root.addEventListener('contextmenu', e => { if (target(e)) e.preventDefault() })   // 長押しのメニューを出さない
  addEventListener('scroll', hide, true)
}

// ── 円の中の読み物：行頭を円に沿わせる ────────────────────────────────
// box は円の中の、縦に流れる（スクロールする）入れ物。中の各ブロック（items）について、いま見えている高さで
// 円が切り取る幅を求め、左右の余白にする＝行頭と行末が円の縁に沿う。スクロール・追加のたびに呼ぶ。
// ブロックは短い（ひとことは 60 字まで＝1〜3 行）ので、1 ブロック内は同じ余白で十分に円らしく見える
export const fitCircle = (box, items, opt = {}) => {
  // ★ブロックの「中心の高さ」で幅を決める。縁で測ると、狭める→折り返して背が伸びる→さらに狭める、が
  //   繰り返されて 1 文字幅まで潰れる（試作で踏んだ）。最小幅も minW に留める
  // 円は既定で box に内接するもの。opt.circle = { cx, cy, R }（box の左上からの座標）で別の円にもできる。
  // opt.right は右の上限（box の左上からの x）。参加者を右に寄せて、左だけを読み物にするときに使う
  const pad = opt.pad ?? 8, st = box.scrollTop, W = box.clientWidth
  const c = opt.circle || { cx: W / 2, cy: box.clientHeight / 2, R: W / 2 }
  const right = opt.right ?? W, minW = opt.minW ?? W * 0.35
  for (const it of items) {
    const mid = it.offsetTop - st + it.offsetHeight / 2
    const dy = Math.min(c.R - 1, Math.abs(mid - c.cy))
    const half = Math.sqrt(Math.max(0, c.R * c.R - dy * dy))
    let l = c.cx - half + pad, r = Math.min(c.cx + half, right) - pad
    if (r - l < minW) { const m = (l + r) / 2; l = m - minW / 2; r = m + minW / 2 }
    it.style.paddingLeft = Math.max(0, l).toFixed(0) + 'px'
    it.style.paddingRight = Math.max(0, W - r).toFixed(0) + 'px'
  }
}
