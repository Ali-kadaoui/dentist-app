export default function Notice({ tone = 'error', children }) {
  if (!children) return null;

  return (
    <p className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}
