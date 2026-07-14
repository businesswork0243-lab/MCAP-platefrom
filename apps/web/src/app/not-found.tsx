'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <h1 style={{ fontSize: '6rem', margin: 0, color: '#333' }}>404</h1>
      <h2 style={{ fontSize: '1.5rem', margin: '10px 0', color: '#666' }}>
        Page Not Found
      </h2>
      <p style={{ color: '#999', marginBottom: '20px' }}>
        The page you're looking for doesn't exist.
      </p>
      <Link 
        href="/"
        style={{
          padding: '10px 20px',
          background: '#0070f3',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '5px',
        }}
      >
        Go Home
      </Link>
    </div>
  );
}
