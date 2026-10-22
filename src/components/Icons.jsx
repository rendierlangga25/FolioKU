// Ikon menu (SVG garis) — satu gaya untuk semua menu.
const P = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

/** Siluet orang (kepala + bahu) untuk menu DRIVER. */
export const IcDriver = () => (
  <svg {...P} fill="currentColor" stroke="none"><circle cx="12" cy="7.5" r="4" /><path d="M4 20.5c0-4.2 3.6-6.5 8-6.5s8 2.3 8 6.5c0 .55-.45 1-1 1H5c-.55 0-1-.45-1-1z" /></svg>
);
export const IcHome = () => (<svg {...P}><rect x="3.5" y="3.5" width="7" height="8" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="5" rx="1.5" /><rect x="13.5" y="11.5" width="7" height="9" rx="1.5" /><rect x="3.5" y="14.5" width="7" height="6" rx="1.5" /></svg>);
export const IcCost = () => (<svg {...P}><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M3.5 10h17M9.5 10v9.5" /></svg>);
export const IcTruck = () => (<svg {...P}><path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3v3h-7z" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></svg>);
export const IcMaster = () => (<svg {...P}><ellipse cx="12" cy="6" rx="7.5" ry="2.8" /><path d="M4.5 6v6c0 1.55 3.35 2.8 7.5 2.8s7.5-1.25 7.5-2.8V6M4.5 12v6c0 1.55 3.35 2.8 7.5 2.8s7.5-1.25 7.5-2.8v-6" /></svg>);
export const IcUsers = () => (<svg {...P}><circle cx="9" cy="8" r="3.3" /><path d="M2.8 19.5c0-3.3 2.8-5.2 6.2-5.2s6.2 1.9 6.2 5.2M16 4.9a3.3 3.3 0 0 1 0 6.2M18 14.6c2 .6 3.2 2.2 3.2 4.9" /></svg>);
export const IcLogout = () => (<svg {...P}><path d="M9.5 4.5h-4a1.5 1.5 0 0 0-1.5 1.5v12a1.5 1.5 0 0 0 1.5 1.5h4M15 8l4 4-4 4M19 12H9.5" /></svg>);
export const IcProfile = () => (<svg {...P}><rect x="3" y="4.5" width="18" height="15" rx="2.2" /><circle cx="9" cy="10.5" r="2.3" /><path d="M5.5 16.5c.6-2 2-3 3.5-3s2.9 1 3.5 3M14.5 9.5h4M14.5 13h4" /></svg>);
/** Dermaga muat: gudang dengan pintu rolling door + panah muat. */
export const IcDock = () => (<svg {...P}><path d="M3 10.5 12 4l9 6.5V20H3z" /><path d="M7.5 20v-6.5h9V20M7.5 16.7h9" /></svg>);

/** Laporan: lembar dokumen dengan panah unduh. */
export const IcReport = () => (<svg {...P}><path d="M6 3.5h8l4 4V20.5H6z" /><path d="M14 3.5v4h4M12 11v5.5M9.7 14.4 12 16.7l2.3-2.3" /></svg>);
