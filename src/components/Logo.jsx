export default function Logo({ light }) {
  return (
    <span className={'logo' + (light ? ' logo-light' : '')}>
      <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill={light ? '#ff8a1f' : '#0f1b2d'} />
        <path d="M18 46V18h15a10 10 0 0 1 3 19.5L46 46h-9l-8-7h-4v7zm7-14h8a3.5 3.5 0 0 0 0-7h-8z" fill={light ? '#0f1b2d' : '#ff8a1f'} />
      </svg>
      <b>RAXER</b><i>ERP</i>
    </span>
  );
}
