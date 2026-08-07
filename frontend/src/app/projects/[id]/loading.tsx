export default function ProjectsLoading() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '80px 0',
      }}
    >
      <span
        style={{
          display: 'block',
          width: 28,
          height: 28,
          border: '2.5px solid var(--border)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.65s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
