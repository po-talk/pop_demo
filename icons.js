// icons.js — POP DEMO の線のアイコン（2026-10-09・docs/ICONS.md と lab/icons.html の案を採用したもの）
// ★原則：絵文字は「いのち」（アバター・リアクション・育ち具合・BGM の気分）、線は「道具」（押せるもの）、
//   状態は「泡そのもの」（点線・光・くすみ）。ここにあるのは「道具」と、人や部屋に付く小さな印。
// ★線は 1 種類：24×24・stroke=currentColor・線幅 2・端は丸め（元からある 参加・マイク・退出 と同じ）。
//   塗りは、目印として形で読ませたいもの（静かに入る＝忍者の頭巾）だけ。
// 普通の <script>（module ではない）で読み、index.html の泡の前に [data-i] を埋める。名前は window.POP_ICON。
(() => {
  const P = {
    check: '<polyline points="20 6 9 17 4 12"/>',
    x: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
    houseplus: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M12 12.5v5M9.5 15h5"/>',
    house: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
    megaphone: '<path d="M3 10.5v3a1 1 0 0 0 1 1h3l11 5V4.5l-11 5H4a1 1 0 0 0-1 1z"/><path d="M7 14.5l1.5 5h2.5l-1.3-5"/><path d="M21 9.5v5"/>',
    lobby: '<circle cx="8.5" cy="14.5" r="5"/><circle cx="16.5" cy="8" r="3.5"/><circle cx="17.5" cy="17" r="2.5"/>',
    pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    send: '<path d="M3.5 4.5 21 12 3.5 19.5 6 12z"/><path d="M6 12h15"/>',
    chat: '<path d="M12 4c4.7 0 8.5 3.1 8.5 7s-3.8 7-8.5 7c-1 0-2-.1-2.9-.4L5 20l1.2-3.5C4.5 15.2 3.5 13.2 3.5 11c0-3.9 3.8-7 8.5-7z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><rect x="14.5" y="7.5" width="4" height="4.5" rx=".5"/><path d="M6 9.5h5.5M6 12.5h5.5M6 15.5h9"/>',
    gear: '<path d="M9.90 5.32 L10.43 5.18 L10.66 2.49 L13.34 2.49 L13.57 5.18 L14.10 5.32 L15.23 5.79 L15.71 6.06 L17.78 4.33 L19.67 6.22 L17.94 8.29 L18.21 8.77 L18.68 9.90 L18.82 10.43 L21.51 10.66 L21.51 13.34 L18.82 13.57 L18.68 14.10 L18.21 15.23 L17.94 15.71 L19.67 17.78 L17.78 19.67 L15.71 17.94 L15.23 18.21 L14.10 18.68 L13.57 18.82 L13.34 21.51 L10.66 21.51 L10.43 18.82 L9.90 18.68 L8.77 18.21 L8.29 17.94 L6.22 19.67 L4.33 17.78 L6.06 15.71 L5.79 15.23 L5.32 14.10 L5.18 13.57 L2.49 13.34 L2.49 10.66 L5.18 10.43 L5.32 9.90 L5.79 8.77 L6.06 8.29 L4.33 6.22 L6.22 4.33 L8.29 6.06 L8.77 5.79Z"/><circle cx="12" cy="12" r="3"/>',
    reactplus: '<circle cx="10.5" cy="13" r="7.5"/><path d="M7.5 15a4 4 0 0 0 6 0"/><path d="M8 10.5h.01M13 10.5h.01"/><path d="M19.5 2.5v5M17 5h5"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.6L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.6 4.6L20 16"/><path d="M20 21v-5h-5"/>',
    link: '<path d="M10 13.5a4.5 4.5 0 0 0 6.8.5l2.7-2.7a4.5 4.5 0 0 0-6.4-6.4l-1.5 1.5"/><path d="M14 10.5a4.5 4.5 0 0 0-6.8-.5l-2.7 2.7a4.5 4.5 0 0 0 6.4 6.4l1.5-1.5"/>',
    qr: '<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1"/><path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM18 14h2.5M14 20.5h2"/>',
    vol3: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9.5a3.5 3.5 0 0 1 0 5"/><path d="M18.5 7a7 7 0 0 1 0 10"/>',
    vol2: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9.5a3.5 3.5 0 0 1 0 5"/>',
    vol0: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
    logo: '<circle cx="9" cy="14" r="6.5"/><circle cx="17.5" cy="6.5" r="3.5"/><circle cx="19" cy="15.5" r="2"/><path d="M6 11.5a3.5 3.5 0 0 1 2.5-2"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .9-1 1.6v.6"/><path d="M12 17h.01"/>',
    theme: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/>',
    bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    center: '<path d="M3 11 21 3l-8 18-2-8z"/>',
    // 扉（「このまま入ってみる」・v0.15.26）：開いた扉と、向こうへの一歩
    door: '<path d="M4 21h16"/><path d="M6 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17"/><path d="M6 3l7 2.2V21"/><path d="M10.5 12.5h.01"/>',
    ninja: '<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M12 3.5a8.8 8.8 0 1 0 .01 0z M6.7 9.6h10.6a2 2 0 0 1 0 4H6.7a2 2 0 0 1 0-4z"/><path d="M8.6 11.2l2.2.8M15.4 11.2l-2.2.8"/><path d="M19.2 6.4l2.6-2.4M20.2 8.2l3-.8"/>',
    headphones: '<path d="M4 16v-4a8 8 0 0 1 16 0v4"/><rect x="3" y="14" width="4.5" height="6.5" rx="1.5"/><rect x="16.5" y="14" width="4.5" height="6.5" rx="1.5"/>',
    musicoff: '<path d="M9 18V6.5l10-2.5v11"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="15" r="2.5"/><path d="M3 3l18 18"/>',
    slider: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    sparkle: '<path d="M9 3.5l1.6 4.4L15 9.5l-4.4 1.6L9 15.5l-1.6-4.4L3 9.5l4.4-1.6z"/><path d="M17 13.5a3 3 0 0 1 0 5"/><path d="M19.5 11a6.5 6.5 0 0 1 0 10"/>',
    speak: '<path d="M12 4c4.7 0 8.5 3.1 8.5 7s-3.8 7-8.5 7c-1 0-2-.1-2.9-.4L5 20l1.2-3.5C4.5 15.2 3.5 13.2 3.5 11c0-3.9 3.8-7 8.5-7z"/><path d="M8.5 9.5v3M12 8v6M15.5 9.5v3"/>',
    nameoff: '<rect x="3" y="7" width="18" height="10" rx="2.5"/><path d="M7 12h5"/><path d="M3 21 21 3"/>',
    tag: '<path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6h.01"/>',
    warn: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.3h.01"/>',
    unplug: '<path d="M8 3v4M14 3v4"/><path d="M5.5 7h11v3a5.5 5.5 0 0 1-11 0z"/><path d="M11 15.5V21"/><path d="M19 15l3 3M22 15l-3 3"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="8.5" y1="21" x2="15.5" y2="21"/>',
    // 挙手（指 4 本と親指。10-08 利用者「指が足りないように見える」で描き直し）
    raise: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 12V4.5a1.5 1.5 0 0 1 3 0V12"/><path d="M14 12V5.5a1.5 1.5 0 0 1 3 0V13"/><path d="M17 13V8.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1.5a6 6 0 0 1-4.6-2.2L3.3 15.4a1.6 1.6 0 0 1 2.4-2.1L8 15.5"/>',
  }
  const svg = k => P[k] ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + P[k] + '</svg>' : ''
  const fill = (root = document) => root.querySelectorAll('[data-i]').forEach(e => { if (!e.firstElementChild) e.innerHTML = svg(e.dataset.i) })
  // 文の頭の絵文字 → 何の知らせか（お知らせの泡の色と、左上の衛星のアイコン）
  // info＝青・ok＝緑・warn＝黄・err＝赤。絵文字の無い文は info
  const TONE = {
    '🎙': 'info', '📣': 'info', '🗣': 'info', '📮': 'info', '👥': 'info', '🛰': 'info', '🔬': 'info', '🔍': 'info', '🟢': 'ok',
    '📋': 'ok', '✓': 'ok', '🔈': 'warn', '🔊': 'warn', '⚠️': 'warn', '⚠': 'warn', '😴': 'info', '🔌': 'err', '❌': 'err',
  }
  const SAT = { info: 'info', ok: 'check', warn: 'warn', err: 'unplug' }
  const LEAD = /^(\p{Extended_Pictographic}️?|✓)\s*/u
  window.POP_ICON = { svg, fill, TONE, SAT, LEAD, names: Object.keys(P) }
  fill()
})()
