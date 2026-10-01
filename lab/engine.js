// 泡のエンジンの試作ページ。通話はしない（見た目と手触りだけ）
import { Space, hexGrid, hexOut, foam, calmWhileTyping, tips } from '../bubble.js'

const world = document.getElementById('world')
const space = new Space(document.getElementById('viewport'), world)
calmWhileTyping(space)
tips(document.getElementById('tip'))

const el = (tag, cls, html, attrs = {}) => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html != null) e.innerHTML = html
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  return e
}
const put = (e, parent = world) => (parent.appendChild(e), e)

// 背景の飾りの泡
for (let i = 0; i < 40; i++) {
  const m = el('div', 'mote'), s = Math.random() * 30 + 8
  Object.assign(m.style, { width: s + 'px', height: s + 'px', left: (Math.random() * 2400 - 1200) + 'px', top: (Math.random() * 2000 - 1000) + 'px', opacity: (Math.random() * .4 + .15).toFixed(2) })
  world.appendChild(m)
}

// ── 参加中の部屋（浮かぶ泡）＋中の参加者（内側の泡） ─────────────────────────
const ROOM_R = 210
const roomEl = put(el('div', 'tone-room', '<div class="room-name">ポッポの森<small>6人</small></div>'))
const room = space.add(roomEl, { kind: 'float', r: ROOM_R, x: 0, y: 0, home: 0.002, drift: 0.6, breath: 0.012 })
room.innerPad = 12
const people = [['🦊', 'あなた', true], ['🐱', 'Cat'], ['🐼', 'Panda'], ['🐻', 'Bear'], ['🐰', 'Bunny'], ['🦌', 'Deer']]
const memberB = []
people.forEach(([e, n, me], i) => {
  const m = put(el('button', 'member', `<span class="ico">${e}</span><span class="cap m-name">${n}</span>`, { 'aria-label': n + (me ? '（あなた）' : '') }), roomEl)
  const a = i / people.length * Math.PI * 2
  const b = space.add(m, { kind: 'inner', parent: room, r: me ? 46 : 38, x: Math.cos(a) * 80, y: Math.sin(a) * 80 })
  m.addEventListener('click', () => m.classList.toggle('speaking'))
  if (me) m.classList.add('speaking')
  b.drift = 1
  memberB.push(b)
})
const meB = memberB[0]

// ── 部屋の外壁に吸着する操作ボタン（ハニカムの二段） ─────────────────────────
const CTRL_R = 36
const controls = [
  ['mute', '🎙️', 'マイクをミュート'], ['react', '👏', 'リアクション'], ['chat', '💬', 'ひとこと'],
  ['share', '🔗', '招待リンク'], ['leave', '🚪', '退出'], ['set', '⚙️', '設定'],
]
const pos = foam(controls.length, ROOM_R, CTRL_R, 18, 4)
const ctrl = {}
controls.forEach(([k, ico, label], i) => {
  const b = put(el('button', k === 'leave' ? 'tone-red' : '', `<span class="ico">${ico}</span>`, { 'aria-label': label }))
  ctrl[k] = space.add(b, { kind: 'dock', parent: room, r: CTRL_R, x: pos[i].x, y: pos[i].y })
})
let muted = false
ctrl.mute.el.addEventListener('click', () => {
  muted = !muted
  ctrl.mute.el.classList.toggle('tone-off', muted)
  ctrl.mute.el.querySelector('.ico').textContent = muted ? '🔇' : '🎙️'
  ctrl.mute.el.setAttribute('aria-label', muted ? 'ミュートを解除' : 'マイクをミュート')
})

// リアクション：押すと 8 つの泡がハニカムで整列して開く（整列＝揺れない）。もう一度押すと閉じる
const REACT = ['👏', '😂', '✨', '👍', '🤔', '😮', '🎉', '🍵']
// 置き場所：👏 の向き（部屋の中心から見た角度）の外側。操作の泡の二段より外に、ハニカムの塊で出す
const reactIdx = controls.findIndex(c => c[0] === 'react')
const reactDeg = Math.atan2(pos[reactIdx].y, pos[reactIdx].x) * 180 / Math.PI
const reactSlots = hexOut(REACT.length, 4, 62, reactDeg, ROOM_R + CTRL_R * 4 + 140)   // 4 個ずつ 2 行
const reacts = REACT.map((e, i) => {
  const b = put(el('button', '', `<span class="ico">${e}</span>`, { 'aria-label': 'リアクション ' + e }))
  b.hidden = true
  b.addEventListener('click', () => fly(meB, e))   // 本番と同じく、送った人（自分）の泡から湧き上がる
  return space.add(b, { kind: 'slot', parent: room, r: 28, x: reactSlots[i].x, y: reactSlots[i].y })
})
ctrl.react.el.addEventListener('click', () => {
  const open = reacts[0].el.hidden
  reacts.forEach(r => { r.el.hidden = !open })
  ctrl.react.el.classList.toggle('tone-on', open)
  room.pinned = open   // 並べている間は親を留める＝押そうとした泡が逃げない
})
// リアクションは送った人の泡から湧き上がる（from＝その人の泡。位置は湧いた瞬間のもの）
const fly = (from, e) => {
  for (let i = 0; i < 6; i++) setTimeout(() => {
    const f = put(el('div', 'fly', e))
    f.style.left = from.wx + 'px'
    f.style.top = (from.wy - from.r * 0.4) + 'px'
    f.style.setProperty('--tx', ((Math.random() - .5) * 140).toFixed(0) + 'px')
    setTimeout(() => f.remove(), 2300)
  }, i * 70)
}

// 退出：確認は 2 つの泡（✓ と ✕）＋問いの泡
const ask = put(el('div', 'tone-violet', '<span class="q">「ポッポの森」から退出しますか？</span>', { id: 'ask' }))
ask.hidden = true
// 置き場所は親（部屋）の右上の外側に固定。中の参加者と重ならないので読みやすい。✓ ✕ は問いの泡の右の外壁に
const ASK_R = 84, ASK_DEG = -42, ASK_D = ROOM_R + ASK_R + 10
const askB = space.add(ask, { kind: 'slot', parent: room, r: ASK_R,
  x: ASK_D * Math.cos(ASK_DEG * Math.PI / 180), y: ASK_D * Math.sin(ASK_DEG * Math.PI / 180) })
const yes = put(el('button', 'tone-red', '<span class="ico">✓</span>', { 'aria-label': '退出する' }))
const no = put(el('button', '', '<span class="ico">✕</span>', { 'aria-label': 'やめる' }))
yes.hidden = no.hidden = true
const onAsk = (deg, r = 34) => { const d = ASK_R + r + 6, a = deg * Math.PI / 180; return { x: d * Math.cos(a), y: d * Math.sin(a) } }
space.add(yes, { kind: 'slot', parent: askB, r: 34, ...onAsk(-15) })
space.add(no, { kind: 'slot', parent: askB, r: 34, ...onAsk(35) })
let askTimer = 0
const showAsk = on => { ask.hidden = yes.hidden = no.hidden = !on; room.pinned = on; clearTimeout(askTimer); if (on) askTimer = setTimeout(() => showAsk(false), 8000) }
ctrl.leave.el.addEventListener('click', () => showAsk(ask.hidden))
no.addEventListener('click', () => showAsk(false))
yes.addEventListener('click', () => { showAsk(false); fly(meB, '👋') })
// 他の人のリアクションの見本：ときどき誰かの泡から湧く
setInterval(() => { if (space.calm) return; const b = memberB[1 + Math.floor(Math.random() * (memberB.length - 1))]; fly(b, REACT[Math.floor(Math.random() * REACT.length)]) }, 7000)

// ── 他の部屋（未参加・浮遊） ─────────────────────────────────────────
const lobby = [['アイデア会議', ['🦉', '🐭', '🐹'], -470, -260, 110], ['もくもく作業部屋 ☕', ['🦝', '🐨'], 470, -230, 96], ['夜のラジオ 📣', ['🎙'], 380, 330, 84]]
lobby.forEach(([name, kids, x, y, r]) => {
  const e = put(el('button', 'tone-faint lobby-room', `<div class="room-name">${name}<small>${kids.length}人</small></div>`, { 'aria-label': name + '（' + kids.length + '人）に参加' }))
  const b = space.add(e, { kind: 'float', r, x, y, home: 0.0009, drift: 1.2 })
  b.innerPad = 8
  kids.forEach((k, i) => {
    const c = put(el('div', '', `<span class="ico">${k}</span>`), e)
    space.add(c, { kind: 'inner', parent: b, r: r * 0.28, x: (i - 1) * 20, y: 10, drag: false })
  })
})

// ── プロフィール（浮かぶ泡）：絵文字を押すと、16 個の絵文字がハニカム（半個ずらしの行）で下に並ぶ ──────────
const AVATARS = ['🦞','🐱','🐶','🦊','🐻','🐼','🐸','🐧','🦉','🐙','🦄','🐝','🌸','⭐','🍎','🍣']   // 本番と同じ 16 個（index.html の AVATARS）
const pf = put(el('div', 'tone-violet', `<button class="ico no-drag" id="pfEmoji" aria-label="アバターを選ぶ" style="font-size:40cqmin;background:none;border:0;cursor:pointer;pointer-events:auto">🦊</button>
  <input id="pfName" value="あなた" maxlength="20" aria-label="あなたの名前">`))
const pfB = space.add(pf, { kind: 'float', r: 100, x: -360, y: 330, home: 0.002 })
// 4 個ずつ 4 行、奇数行を半個ずらす。プロフィールの泡のすぐ下に置く
const AV_STEP = 62, AV_COLS = 4
const avGrid = hexGrid(AVATARS.length, AV_COLS, AV_STEP)
const avTop = 100 + 14 + 28 - Math.min(...avGrid.map(p => p.y))
const avSlots = avGrid.map(p => ({ x: p.x, y: p.y + avTop }))
const avs = AVATARS.map((a, i) => {
  const b = put(el('button', '', `<span class="ico">${a}</span>`, { 'aria-label': 'アバター ' + a }))
  b.hidden = true
  b.addEventListener('click', () => {
    pf.querySelector('#pfEmoji').textContent = a
    roomEl.querySelector('.member .ico').textContent = a
    openAv(false)
  })
  return space.add(b, { kind: 'slot', parent: pfB, r: 28, x: avSlots[i].x, y: avSlots[i].y })
})
const openAv = on => { avs.forEach(b => { b.el.hidden = !on }); pfB.pinned = on; if (on) space.view(pfB.x, pfB.y + 120, 520) }
pf.querySelector('#pfEmoji').addEventListener('click', () => openAv(avs[0].el.hidden))
pf.querySelector('#pfName').addEventListener('input', e => { roomEl.querySelector('.member .m-name').textContent = e.target.value || 'あなた' })

// カメラ：全体が収まるように
const fit = () => space.view(0, 40, 1150, { now: !fit.done }); fit(); fit.done = true
addEventListener('resize', () => fit())
