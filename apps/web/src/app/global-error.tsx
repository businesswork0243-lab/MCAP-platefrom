'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <h1 style={{ fontSize: '6rem', margin: 0, color: '#e53e3e' }}>Error</h1>
          <h2 style={{ fontSize: '1.5rem', margin: '10px 0' }}>
            Application Error
          </h2>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            A critical error occurred
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '10px 20px',
              background: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>
      </body>
    </html>
  );
}
