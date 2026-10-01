// 泡のエンジンの試作ページ。通話はしない（見た目と手触りだけ）
import { Space, hexGrid, hexOut, hexHug, foam, toWall, calmWhileTyping, tips, fitCircle } from '../bubble.js?v=10021028'

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
  ctrl[k] = space.add(b, { kind: 'dock', parent: room, r: CTRL_R, wall: toWall(pos[i], ROOM_R) })   // 部屋が膨らんでも壁に付いていく
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
const REACT_D = ROOM_R + CTRL_R * 4 + 140
const reactSlots = hexOut(REACT.length, 4, 62, reactDeg, REACT_D)   // 4 個ずつ 2 行
const reactC = { x: REACT_D * Math.cos(reactDeg * Math.PI / 180), y: REACT_D * Math.sin(reactDeg * Math.PI / 180) }
const reacts = REACT.map((e, i) => {
  const b = put(el('button', '', `<span class="ico">${e}</span>`, { 'aria-label': 'リアクション ' + e }))
  b.hidden = true
  b.addEventListener('click', () => fly(meB, e))   // 本番と同じく、送った人（自分）の泡から湧き上がる
  return space.add(b, { kind: 'slot', parent: room, r: 28, wall: toWall(reactSlots[i], ROOM_R, reactC) })
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

// ── ひとこと：💬 で部屋の泡の中身を切り替える ─────────────────────────────
// 参加者は内壁に沿った輪へ退き（誰が話しているかは見えたまま）、真ん中の円が読み物になる。
// 行頭・行末は円の縁に沿わせる（fitCircle）。入力欄も円の下のほうに置く
const RING_W = 38 * 2 + 16
const chat = put(el('div', 'chatview', `<div class="chat-log scroll-in" aria-live="polite"></div>
  <div class="chat-row"><input id="chatText" maxlength="60" placeholder="ひとこと…" aria-label="ひとことを書く" enterkeyhint="send" autocomplete="off">
  <button class="bub chat-send" aria-label="送信"><span class="ico">➤</span></button></div>`), roomEl)
chat.hidden = true
const log = chat.querySelector('.chat-log')
const SAMPLE = [['🐱', 'Cat', 'こんばんは〜'], ['🐼', 'Panda', '今日はちょっと寒いですね'], ['🦊', 'あなた', 'こんばんは！はじめて来ました'],
  ['🐻', 'Bear', 'ようこそ〜。ゆっくりしていってね'], ['🐰', 'Bunny', 'さっきの話の続きなんだけど、駅前に新しくできたパン屋さんがすごく美味しかった'],
  ['🦌', 'Deer', 'どこどこ？'], ['🐰', 'Bunny', '北口の本屋さんの隣です'], ['🐼', 'Panda', '明日行ってみよう 🍞']]
const addMsg = (e, n, x, mine = false) => {
  const m = el('div', 'msg' + (mine ? ' mine' : ''))
  m.innerHTML = `<span class="who">${e} ${n}</span><span class="txt"></span>`
  m.querySelector('.txt').textContent = x
  log.appendChild(m)
  while (log.children.length > 30) log.firstChild.remove()
  log.scrollTop = log.scrollHeight
  refit()
}
// 読み物は部屋の泡の左側いっぱい。右の上限は、右に寄った参加者の塊の手前（chatMode が決める）
let chatRight = null
const refit = () => fitCircle(log, [...log.children], { pad: 14, right: chatRight, circle: { cx: log.clientWidth / 2, cy: log.clientHeight / 2 + log.offsetTop * 0, R: log.clientWidth / 2 - 6 } })
log.addEventListener('scroll', () => requestAnimationFrame(refit))
SAMPLE.forEach(([e, n, x]) => addMsg(e, n, x, n === 'あなた'))
const say = (b, text) => {   // 話した人の泡のそばに、ひとことの小泡（本番の吹き出しの代わり）
  const d = Math.max(70, Math.min(150, Math.sqrt([...text].length) * 26 + 30))
  const sv = put(el('div', 'say'))
  sv.textContent = text
  Object.assign(sv.style, { width: d + 'px', height: d + 'px', left: (b.wx - d / 2) + 'px', top: (b.wy - b.r - d - 6) + 'px' })
  setTimeout(() => sv.remove(), 4700)
}
const chatInput = chat.querySelector('#chatText')
const send = () => {
  const x = chatInput.value.trim()
  if (!x) return
  addMsg(pf.querySelector('#pfEmoji').textContent, 'あなた', x, true)
  say(meB, x)
  chatInput.value = ''
}
chat.querySelector('.chat-send').addEventListener('click', send)
chatInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) send() })
// ひとことを開くと部屋の泡は少し膨らみ（210→270）、参加者は右側にハニカムで寄り集まる。
// 左側は縁いっぱいまで読み物（行頭は円に沿う）
const CHAT_R = 270, MEM_R = 38
const chatMode = on => {
  chat.hidden = !on
  roomEl.classList.toggle('chat-mode', on)
  ctrl.chat.el.classList.toggle('tone-on', on)
  ctrl.chat.el.setAttribute('aria-label', on ? 'ひとことを閉じる' : 'ひとこと')
  room.grow(on ? CHAT_R : ROOM_R)
  const n = memberB.length, g = hexGrid(n, 2, MEM_R * 2 + 6)
  const maxX = Math.max(...g.map(p => p.x)), minX = Math.min(...g.map(p => p.x))
  const cx = CHAT_R - 18 - MEM_R - maxX
  memberB.forEach((b, i) => { b.tx = on ? cx + g[i].x : null; b.ty = on ? g[i].y : null })
  // 読み物の右端＝参加者の塊の左端の少し手前（部屋の要素の左上からの x）
  chatRight = CHAT_R + cx + minX - MEM_R - 10
  chat.style.setProperty('--chat-right', ((1 - chatRight / (CHAT_R * 2)) * 100).toFixed(1) + '%')
  room.pinned = on
  if (on) {
    space.view(room.x, room.y, CHAT_R * 2 + 40)
    // 膨らんでいる間も行頭を合わせ直す
    let k = 0; const tick = () => { log.scrollTop = log.scrollHeight; refit(); if (++k < 40) requestAnimationFrame(tick) }; requestAnimationFrame(tick)
  }
}
ctrl.chat.el.addEventListener('click', () => chatMode(chat.hidden))
// 他の人のひとことの見本
setInterval(() => {
  if (space.calm) return
  const i = 1 + Math.floor(Math.random() * (memberB.length - 1)), [e, n] = people[i]
  const x = ['なるほど〜', 'たしかに', 'それいいね！', 'わかる', 'あとで調べてみます', '🍵 お茶いれてきた'][Math.floor(Math.random() * 6)]
  addMsg(e, n, x); say(memberB[i], x)
}, 9000)

// 退出：確認は 2 つの泡（✓ と ✕）＋問いの泡
const ask = put(el('div', 'tone-violet', '<span class="q">「ポッポの森」から退出しますか？</span>', { id: 'ask' }))
ask.hidden = true
// 部屋の右上の外にぽこんと出す問いの泡。✓ ✕ は問いの泡の右下の外壁から生える（中に入れるより押しやすく、文も読みやすい）
const ASK_R = 84, ASK_DEG = -42, ASK_D = ROOM_R + ASK_R + 10
const askB = space.add(ask, { kind: 'slot', parent: room, r: ASK_R, wall: { a: ASK_DEG * Math.PI / 180, d: ASK_R + 10 } })
const yes = put(el('button', 'tone-red', '<span class="ico">✓</span>', { 'aria-label': '退出する' }))
const no = put(el('button', '', '<span class="ico">✕</span>', { 'aria-label': 'やめる' }))
yes.hidden = no.hidden = true
const onAsk = (deg, r = 32) => { const d = ASK_R + r + 4, a = deg * Math.PI / 180; return { x: d * Math.cos(a), y: d * Math.sin(a) } }
space.add(yes, { kind: 'slot', parent: askB, r: 32, ...onAsk(18) })
space.add(no, { kind: 'slot', parent: askB, r: 32, ...onAsk(66) })
let askTimer = 0
const showAsk = on => {
  yes.hidden = no.hidden = !on
  // 問いの泡が画面の外に出ないよう、部屋と問いの泡の両方が収まるところへカメラを寄せる
  if (on) { const t = askB.target(); space.view(room.x + (t.x - room.x) * 0.45, room.y + (t.y - room.y) * 0.45, (room.r * 2 + ASK_R * 2 + 20) * 1.15) }
  ask.hidden = !on; room.pinned = on; clearTimeout(askTimer); if (on) askTimer = setTimeout(() => showAsk(false), 8000) }
ctrl.leave.el.addEventListener('click', () => showAsk(ask.hidden))
no.addEventListener('click', () => showAsk(false))
yes.addEventListener('click', () => { showAsk(false); fly(meB, '👋'); setTimeout(() => setJoined(false), 250) })
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
// 半個ずらしの行のハニカムのまま、プロフィールの泡の右下の外壁に抱きつくように並べる（hexHug）
const AV_STEP = 62, AV_DEG = 40
const avSlots = hexHug(AVATARS.length, AV_STEP, AV_DEG, 100, 28, 6)
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
const openAv = on => { avs.forEach(b => { b.el.hidden = !on }); pfB.pinned = on; if (on) { const cx = avSlots.reduce((a, p) => a + p.x, 0) / avSlots.length, cy = avSlots.reduce((a, p) => a + p.y, 0) / avSlots.length; space.view(pfB.x + cx * 0.5, pfB.y + cy * 0.5, 560) } }
pf.querySelector('#pfEmoji').addEventListener('click', () => openAv(avs[0].el.hidden))
pf.querySelector('#pfName').addEventListener('input', e => { roomEl.querySelector('.member .m-name').textContent = e.target.value || 'あなた' })

// カメラ：全体が収まるように
const fit = () => space.view(0, 40, 1150, { now: !fit.done }); fit(); fit.done = true
addEventListener('resize', () => fit())

// ── 入室中は「部屋の中のあなた」が自分の泡。プロフィールの泡は出さない ────────────────────
// （本番も通話中はプロフィールを触れない）。退出すると、あなたの泡が部屋から弾けて抜け、
// プロフィールの泡が膨らんで戻る。部屋をタップすると逆の順で入る
let joined = true
pf.hidden = true
const setJoined = on => {
  joined = on
  openAv(false)
  if (!on) chatMode(false)
  reacts.forEach(r => { r.el.hidden = true }); ctrl.react.el.classList.remove('tone-on')
  meB.el.hidden = !on
  Object.values(ctrl).forEach(c => { c.el.hidden = !on })
  roomEl.classList.toggle('tone-room', on); roomEl.classList.toggle('tone-faint', !on)
  roomEl.querySelector('.room-name small').textContent = (on ? people.length : people.length - 1) + '人'
  roomEl.setAttribute('aria-label', on ? '' : 'ポッポの森に参加')
  if (!on) {
    // プロフィールの泡は、あなたが抜けた所（部屋の左外）に膨らむ
    pfB.ox = pfB.x = room.x - ROOM_R - 130; pfB.oy = pfB.y = room.y + 40
    pf.hidden = false
    space.view(room.x - 120, room.y, ROOM_R * 2 + 360)
  } else {
    pf.hidden = true
    space.view(room.x + 60, room.y + 60, ROOM_R * 2 + 260)
  }
}
roomEl.addEventListener('click', e => { if (!joined && !e.target.closest('.member')) setJoined(true) })
