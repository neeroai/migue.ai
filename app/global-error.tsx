'use client'

/**
 * Global error boundary for Next.js App Router
 * Must be a client component to avoid SSR/prerender context issues
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/error#global-errortsx
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Log error directly without useEffect to avoid context issues
  if (typeof window !== 'undefined') {
    console.error('Global error:', error)
  }

  return (
    <html lang="es">
      <body>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '20px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>
            Algo salio mal
          </h1>
          <p style={{ color: '#666', marginBottom: '24px', textAlign: 'center' }}>
            Lo sentimos, ocurrio un error inesperado.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '12px 24px',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            Intentar de nuevo
          </button>
        </div>
      </body>
    </html>
  )
}
