// Ikon kecil untuk kotak foto & menu pilihan (solid, mengikuti warna teks).
const P = {
  cam: <path d="M9 4l-1.7 2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3.3L15 4H9zm3 4.2a4.3 4.3 0 1 1 0 8.6 4.3 4.3 0 0 1 0-8.6zm0 2a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6z" />,
  gallery: <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm3.5 3.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6zM4 18h16v-2.6l-4.2-4.6-4.1 4.5-2.4-2.5L4 16.6V18z" />,
  eye: <path d="M12 5C6.5 5 2.7 8.6 1.5 12c1.2 3.4 5 7 10.5 7s9.3-3.6 10.5-7C21.3 8.6 17.5 5 12 5zm0 11.2a4.2 4.2 0 1 1 0-8.4 4.2 4.2 0 0 1 0 8.4zm0-6.4a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4z" />,
  trash: <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm-3 6h12l-1 12H7L6 9z" />,
  plus: <path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7V4z" />,
  chev: <path d="M7.4 9.4 12 14l4.6-4.6L18 10.8l-6 6-6-6 1.4-1.4z" />,
  chevl: <path d="M14.6 7.4 10 12l4.6 4.6L13.2 18l-6-6 6-6 1.4 1.4z" />,
};
export default function Ic({ n }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">{P[n]}</svg>;
}
