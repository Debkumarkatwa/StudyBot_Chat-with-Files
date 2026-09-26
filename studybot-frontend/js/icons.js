// icons.js
// Small, self-contained set of inline SVG icons used in place of emoji glyphs.
// Every icon uses stroke="currentColor" so it inherits the button's text color
// (and therefore the light/dark theme) automatically. aria-hidden="true" is set
// on every icon because the *button* already carries the accessible name via
// aria-label — the icon itself is decorative.

const ICON_SVG_ATTRS =
  'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
  'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
  'stroke-linejoin="round" aria-hidden="true" focusable="false"';

const ICONS = {
  close: `<svg ${ICON_SVG_ATTRS}><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>`,

  menu: `<svg ${ICON_SVG_ATTRS}><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>`,

  moon: `<svg ${ICON_SVG_ATTRS}><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>`,

  sun: `<svg ${ICON_SVG_ATTRS}><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4.5"/><line x1="12" y1="19.5" x2="12" y2="22"/><line x1="2" y1="12" x2="4.5" y2="12"/><line x1="19.5" y1="12" x2="22" y2="12"/><line x1="4.9" y1="4.9" x2="6.6" y2="6.6"/><line x1="17.4" y1="17.4" x2="19.1" y2="19.1"/><line x1="4.9" y1="19.1" x2="6.6" y2="17.4"/><line x1="17.4" y1="6.6" x2="19.1" y2="4.9"/></svg>`,

  user: `<svg ${ICON_SVG_ATTRS}><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2"/></svg>`,

  document: `<svg ${ICON_SVG_ATTRS}><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/></svg>`,

  globe: `<svg ${ICON_SVG_ATTRS}><circle cx="12" cy="12" r="8.5"/><line x1="3.5" y1="12" x2="20.5" y2="12"/><path d="M12 3.5c2.6 2.4 2.6 14.6 0 17"/><path d="M12 3.5c-2.6 2.4-2.6 14.6 0 17"/></svg>`,

  plus: `<svg ${ICON_SVG_ATTRS}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,

  trash: `<svg ${ICON_SVG_ATTRS}><path d="M4.5 7h15"/><path d="M9 7V4.8a.8.8 0 0 1 .8-.8h4.4a.8.8 0 0 1 .8.8V7"/><path d="M6.5 7l1 13.2h9L17.5 7"/></svg>`,

  restore: `<svg ${ICON_SVG_ATTRS}><path d="M7.5 6.5 4 10l3.5 3.5"/><path d="M4 10h10.5a5.5 5.5 0 1 1 0 11H12"/></svg>`,

  copy: `<svg ${ICON_SVG_ATTRS}><rect x="5.5" y="7.5" width="11" height="13" rx="1.5"/><path d="M9 7.5V5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 19 5v10a1.5 1.5 0 0 1-1.5 1.5H16"/></svg>`,

  check: `<svg ${ICON_SVG_ATTRS}><path d="M4 12.5l5 5 11-11"/></svg>`,

  refresh: `<svg ${ICON_SVG_ATTRS}><path d="M20 12a8 8 0 1 1-2.9-6.2"/><path d="M20 4v5h-5"/></svg>`,

  link: `<svg ${ICON_SVG_ATTRS}><path d="M9.5 14.5l5-5"/><path d="M8 12.5l-1.8 1.8a3.4 3.4 0 0 0 4.8 4.8l1.8-1.8"/><path d="M16 11.5l1.8-1.8a3.4 3.4 0 0 0-4.8-4.8l-1.8 1.8"/></svg>`,

  warning: `<svg ${ICON_SVG_ATTRS}><path d="M12 4 2.5 20h19z"/><line x1="12" y1="9.5" x2="12" y2="14"/><line x1="12" y1="17" x2="12" y2="17.1"/></svg>`,

  eye: `<svg ${ICON_SVG_ATTRS}><path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/></svg>`,

  eyeOff: `<svg ${ICON_SVG_ATTRS}><path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/><line x1="3.5" y1="3.5" x2="20.5" y2="20.5"/></svg>`,

  clock: `<svg ${ICON_SVG_ATTRS}><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 2"/></svg>`,

  chat: `<svg ${ICON_SVG_ATTRS}><path d="M4 5.5h16a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1H9l-4 3.5V17H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1z"/></svg>`,

  settings: `<svg ${ICON_SVG_ATTRS}><line x1="4" y1="6" x2="20" y2="6"/><circle cx="9" cy="6" r="1.6" fill="currentColor" stroke="none"/><line x1="4" y1="12" x2="20" y2="12"/><circle cx="15" cy="12" r="1.6" fill="currentColor" stroke="none"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="11" cy="18" r="1.6" fill="currentColor" stroke="none"/></svg>`,

  logout: `<svg ${ICON_SVG_ATTRS}><path d="M9 4H6a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6 20h3"/><path d="M14 16l4-4-4-4"/><line x1="18" y1="12" x2="9" y2="12"/></svg>`,

  folder: `<svg ${ICON_SVG_ATTRS}><path d="M3.5 6.5a1 1 0 0 1 1-1H10l2 2h7.5a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z"/></svg>`,

  target: `<svg ${ICON_SVG_ATTRS}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg>`,

  sparkle: `<svg ${ICON_SVG_ATTRS}><path d="M12 3c.6 3.3 2.7 5.4 6 6-3.3.6-5.4 2.7-6 6-.6-3.3-2.7-5.4-6-6 3.3-.6 5.4-2.7 6-6z"/></svg>`,

  lock: `<svg ${ICON_SVG_ATTRS}><rect x="5.5" y="10.5" width="13" height="9" rx="1.5"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/></svg>`,

  edit: `<svg ${ICON_SVG_ATTRS}><path d="M4 20l4.5-1 10-10a2 2 0 0 0 0-2.8l-.7-.7a2 2 0 0 0-2.8 0l-10 10z"/><path d="M13.5 6.5l4 4"/></svg>`,
};

// Sets `el`'s content to the named icon, optionally followed by a text label
// (used where a button shows both an icon and a word, e.g. "Copy", "Regenerate").
// The icon markup is trusted (it comes from ICONS, never from user input), but
// `label` might contain a filename or other data the user controls — so it is
// always added as a plain text node, never concatenated into innerHTML.
function setIcon(el, name, label) {
  if (!el || !ICONS[name]) return;
  el.innerHTML = ICONS[name];
  if (label) el.appendChild(document.createTextNode(` ${label}`));
}
