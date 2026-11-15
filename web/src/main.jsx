import { StrictMode, useState, useEffect, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import IntroPage from './pages/IntroPage.jsx'

// Lazy-load the full mission-control dashboard and 3D bundles
const Dashboard = lazy(() => import('./App.jsx'))

function LoadingScreen() {
  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      background: '#05070D',
      color: '#22D3EE',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      fontFamily: 'var(--font-mono, monospace)',
      fontSize: '12px',
      letterSpacing: '0.10em'
    }}>
      <div style={{
        width: '32px',
        height: '32px',
        border: '2px solid rgba(34, 211, 238, 0.2)',
        borderTop: '2px solid #22D3EE',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      <span>INITIALIZING STELLARON FLIGHT OPS...</span>
    </div>
  )
}

function RootRouter() {
  const getPath = () => window.location.pathname.toLowerCase()
  const [route, setRoute] = useState(getPath)

  useEffect(() => {
    const handlePopState = () => {
      setRoute(getPath())
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = (path) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path)
      setRoute(path.toLowerCase())
    }
  }

  // Route matching: /app, /app/ -> Dashboard, otherwise -> IntroPage
  if (route.startsWith('/app')) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <Dashboard />
      </Suspense>
    )
  }

  return <IntroPage navigate={navigate} />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootRouter />
  </StrictMode>,
)
