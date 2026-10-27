const TONE_MAP = {
  default: 'blue',
  accent: 'gold',
  ok: 'green',
  warn: 'rose',
};

const ICONS = {
  blue: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  gold: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  green: 'M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3',
  rose: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
};

export default function StatCard({ label, value, hint, tone = 'default' }) {
  const color = TONE_MAP[tone] ?? 'blue';

  return (
    <article className="stat-card">
      <div className={`icon-box ${color}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={ICONS[color] ?? ICONS.blue} />
        </svg>
      </div>
      <p className="stat-label">{label}</p>
      <strong>{value}</strong>
      {hint ? (
        <div className="stat-foot">
          <span>{hint}</span>
        </div>
      ) : null}
    </article>
  );
}
