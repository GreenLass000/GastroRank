import { useEffect, useState } from 'react'
import './App.css'
import { EntityDetailSheet } from './components/details/EntityDetailSheet.jsx'
import { LoadingOverlay } from './components/feedback/LoadingOverlay.jsx'
import { StatusBanner } from './components/feedback/StatusBanner.jsx'
import { ToastCenter } from './components/feedback/ToastCenter.jsx'
import { AddDishWizard } from './components/forms/AddDishWizard.jsx'
import { RestaurantForm } from './components/forms/RestaurantForm.jsx'
import { BottomNav } from './components/layout/BottomNav.jsx'
import { FloatingActionButton } from './components/layout/FloatingActionButton.jsx'
import { ModalSheet } from './components/layout/ModalSheet.jsx'
import { GlobalSearchPanel } from './components/search/GlobalSearchPanel.jsx'
import { fetchPublicShare } from './lib/api.js'
import { NAV_ITEMS } from './lib/constants.js'
import { useAppState } from './hooks/useAppState.js'
import { useTheme } from './hooks/useTheme.js'
import { HomeScreen } from './screens/HomeScreen.jsx'
import { AuthScreen } from './screens/AuthScreen.jsx'
import { ComunidadScreen } from './screens/ComunidadScreen.jsx'
import { MapScreen } from './screens/MapScreen.jsx'
import { ProfileScreen } from './screens/ProfileScreen.jsx'
import { RankingsScreen } from './screens/RankingsScreen.jsx'
import { ReportScreen } from './screens/ReportScreen.jsx'

const SCREEN_COMPONENTS = {
  home: HomeScreen,
  rankings: RankingsScreen,
  map: MapScreen,
  community: ComunidadScreen,
  profile: ProfileScreen,
  report: ReportScreen,
}

function normalizeScreenId(screenId) {
  if (screenId === 'lists') {
    return 'community'
  }

  return screenId
}

function readNavigationState() {
  const params = new URLSearchParams(window.location.search)
  const legacyScreen = normalizeScreenId(params.get('screen') || '')

  return {
    activeScreen:
      params.get('share') || window.location.pathname === '/informe'
        ? 'report'
        : legacyScreen || 'home',
    shareToken: params.get('share') || '',
  }
}

function writeNavigationState(nextScreen, shareToken = '') {
  const params = new URLSearchParams(window.location.search)
  const normalizedScreen = normalizeScreenId(nextScreen)

  if (shareToken) {
    params.set('share', shareToken)
  } else {
    params.delete('share')
  }

  params.delete('screen')

  const nextQuery = params.toString()
  const nextPath = normalizedScreen === 'report' ? '/informe' : '/'
  const nextUrl = `${nextPath}${nextQuery ? `?${nextQuery}` : ''}`
  window.history.pushState({}, '', nextUrl)
}

function App() {
  const [activeScreen, setActiveScreen] = useState(readNavigationState().activeScreen)
  const [isDishWizardOpen, setIsDishWizardOpen] = useState(false)
  const [isRestaurantFormOpen, setIsRestaurantFormOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [entityDetailTarget, setEntityDetailTarget] = useState(null)
  const [restaurantDraftLocation, setRestaurantDraftLocation] = useState(null)
  const [reportConfig, setReportConfig] = useState(null)
  const [shareToken, setShareToken] = useState(readNavigationState().shareToken)
  const [sharePayload, setSharePayload] = useState(null)
  const [shareError, setShareError] = useState('')
  const [isShareLoading, setIsShareLoading] = useState(false)
  const { themeMode, resolvedTheme, setThemeMode } = useTheme()
  const { authChecked, currentUser, isLoading, loadError, toast, clearToast } =
    useAppState()

  const activeNavItem =
    NAV_ITEMS.find((item) => item.id === activeScreen) ?? NAV_ITEMS[0]
  const isPublicShareView = activeScreen === 'report' && Boolean(shareToken)
  const requiresAuth = !isPublicShareView
  const shouldShowAuthScreen = requiresAuth && authChecked && !currentUser
  const showTopbar = isPublicShareView || Boolean(currentUser)
  const topbarCopy = {
    home: {
      eyebrow: 'Tu mesa',
      title: `Hola${currentUser?.nombre ? `, ${currentUser.nombre}` : ''}`,
      subtitle: 'Resumen editorial de platos, top semanal y actividad reciente.',
    },
    community: {
      eyebrow: 'Descubrir',
      title: 'Explorar',
      subtitle: 'Feed social, amigos y hallazgos públicos en una sola vista.',
    },
    map: {
      eyebrow: 'Territorio',
      title: 'Mapa',
      subtitle: 'Restaurantes cerca, selección rápida y contexto espacial.',
    },
    rankings: {
      eyebrow: 'Leaderboards',
      title: 'Rankings',
      subtitle: 'Comparativas compactas para abrir detalle sin perder contexto.',
    },
    profile: {
      eyebrow: 'Cuenta',
      title: 'Perfil',
      subtitle: `Logros, actividad y ajustes de ${resolvedTheme === 'dark' ? 'modo oscuro' : 'apariencia'}.`,
    },
    report: {
      eyebrow: 'Informe',
      title: 'Reporte',
      subtitle: 'Vista compartible lista para revisar o imprimir.',
    },
  }

  function handleScreenChange(nextScreen) {
    const normalizedScreen = normalizeScreenId(nextScreen)

    setActiveScreen(normalizedScreen)
    setShareToken('')
    setSharePayload(null)
    setShareError('')
    writeNavigationState(normalizedScreen)
  }

  function openEntityDetail(target) {
    if (!target?.id || !target?.type) {
      return
    }

    setEntityDetailTarget(target)
  }

  function renderActiveScreen() {
    if (activeScreen === 'report') {
      if (shareToken && shareError) {
        return (
          <section className="screen" aria-label="Error de informe público">
            <article className="surface-card">
              <strong>No se pudo abrir el enlace público</strong>
              <p>{shareError}</p>
            </article>
          </section>
        )
      }

      if (shareToken && !sharePayload) {
        return (
          <section className="screen" aria-label="Carga de informe público">
            <article className="surface-card">
              <strong>Cargando informe público</strong>
              <p>Esperando la respuesta del enlace compartido.</p>
            </article>
          </section>
        )
      }

      return (
        <ReportScreen
          onBack={
            shareToken
              ? undefined
              : () => {
                  handleScreenChange('rankings')
                }
          }
          onOpenEntity={openEntityDetail}
          reportConfig={reportConfig}
          sharePayload={sharePayload}
        />
      )
    }

    if (activeScreen === 'map') {
      return (
        <MapScreen
          onCreateRestaurantAtLocation={(location) => {
            setRestaurantDraftLocation(location)
            setIsRestaurantFormOpen(true)
          }}
          onNavigate={handleScreenChange}
          onOpenEntity={openEntityDetail}
        />
      )
    }

    const ActiveScreen = SCREEN_COMPONENTS[activeScreen]
    if (activeScreen === 'rankings') {
      return (
        <ActiveScreen
          onOpenReport={(nextReportConfig) => {
            setReportConfig(nextReportConfig)
            setActiveScreen('report')
            writeNavigationState('report')
          }}
        />
      )
    }

    return (
      <ActiveScreen
        onNavigate={handleScreenChange}
        onOpenEntity={openEntityDetail}
        onOpenSearch={() => setIsSearchOpen(true)}
      />
    )
  }

  useEffect(() => {
    if (!toast.message) {
      return undefined
    }

    const timeout = window.setTimeout(() => {
      clearToast()
    }, 2600)

    return () => window.clearTimeout(timeout)
  }, [clearToast, toast.message])

  useEffect(() => {
    function handlePopState() {
      const nextState = readNavigationState()
      setActiveScreen(nextState.activeScreen)
      setShareToken(nextState.shareToken)
      if (!nextState.shareToken) {
        setSharePayload(null)
        setShareError('')
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!shareToken) {
      return
    }

    let cancelled = false

    async function loadShare() {
      try {
        setIsShareLoading(true)
        const payload = await fetchPublicShare(shareToken)

        if (cancelled) {
          return
        }

        setSharePayload(payload)
        setShareError('')
      } catch (error) {
        if (cancelled) {
          return
        }

        setSharePayload(null)
        setShareError(
          error instanceof Error ? error.message : 'No se pudo cargar el enlace público.',
        )
      } finally {
        if (!cancelled) {
          setIsShareLoading(false)
        }
      }
    }

    loadShare()

    return () => {
      cancelled = true
    }
  }, [shareToken])

  return (
    <div className="app-shell">
      {showTopbar ? (
        <header className="topbar">
          <div className="topbar__meta">
            <span className="topbar__label">{topbarCopy[activeScreen]?.eyebrow || 'GastroRank'}</span>
            <h1>{topbarCopy[activeScreen]?.title || 'GastroRank'}</h1>
            <p>{topbarCopy[activeScreen]?.subtitle || 'Tu app gastronómica social.'}</p>
          </div>
          <div className="topbar__actions">
            {!shareToken ? (
              <>
                <button
                  className="shell-button"
                  type="button"
                  aria-label={`Tema actual: ${themeMode}`}
                  onClick={() =>
                    setThemeMode(
                      themeMode === 'system'
                        ? 'light'
                        : themeMode === 'light'
                          ? 'dark'
                          : 'system',
                    )
                  }
                >
                  {themeMode === 'dark' ? '🌙' : themeMode === 'light' ? '☀️' : '🖥️'}
                  <span>{themeMode === 'system' ? 'Sistema' : themeMode === 'dark' ? 'Oscuro' : 'Claro'}</span>
                </button>
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Buscar"
                  onClick={() => setIsSearchOpen(true)}
                >
                  🔎
                </button>
              </>
            ) : null}
          </div>
        </header>
      ) : null}

      <main className="screen-container">
        {loadError && !shouldShowAuthScreen ? (
          <StatusBanner
            tone="error"
            title="Sin conexión"
            detail={`No se pudieron actualizar todos los datos. ${loadError}`}
          />
        ) : null}
        {shareError ? (
          <StatusBanner
            tone="error"
            title="Share público"
            detail={`Error al cargar ❌ — ${shareError}`}
          />
        ) : null}
        {shouldShowAuthScreen ? <AuthScreen /> : null}
        {(!requiresAuth || authChecked) && (!requiresAuth || currentUser)
          ? renderActiveScreen()
          : null}
      </main>

      {!shareToken && currentUser ? (
        <>
          <FloatingActionButton
            label="Añadir plato rápido"
            onClick={() => setIsDishWizardOpen(true)}
          />
          <BottomNav
            activeId={activeNavItem.id}
            items={NAV_ITEMS}
            onChange={handleScreenChange}
          />
        </>
      ) : null}
      {(isLoading || isShareLoading || (requiresAuth && !authChecked)) ? (
        <LoadingOverlay message="Cargando..." />
      ) : null}
      <ToastCenter message={toast.message} tone={toast.tone} />

      {isSearchOpen && currentUser ? (
        <ModalSheet
          title="Buscar"
          eyebrow="Acceso rápido"
          immersive
          onClose={() => setIsSearchOpen(false)}
        >
          <GlobalSearchPanel
            onClose={() => setIsSearchOpen(false)}
            onOpenEntity={openEntityDetail}
          />
        </ModalSheet>
      ) : null}

      {entityDetailTarget && currentUser ? (
        <ModalSheet
          title="Detalle"
          eyebrow="Ficha"
          immersive
          onClose={() => {
            setEntityDetailTarget(null)
          }}
        >
          <EntityDetailSheet
            key={`${entityDetailTarget.type}:${entityDetailTarget.id}`}
            target={entityDetailTarget}
            onClose={() => setEntityDetailTarget(null)}
          />
        </ModalSheet>
      ) : null}

      {isDishWizardOpen && currentUser ? (
        <ModalSheet
          title="Añadir plato"
          eyebrow="Nuevo registro"
          immersive
          fullHeight
          onClose={() => {
            clearToast()
            setIsDishWizardOpen(false)
          }}
        >
          <AddDishWizard
            onClose={() => {
              setIsDishWizardOpen(false)
            }}
            onOpenRestaurantForm={() => {
              setIsRestaurantFormOpen(true)
            }}
          />
        </ModalSheet>
      ) : null}

      {isRestaurantFormOpen && currentUser ? (
        <ModalSheet
          title="Nuevo restaurante"
          eyebrow="Ubicación"
          immersive
          onClose={() => {
            clearToast()
            setIsRestaurantFormOpen(false)
            setRestaurantDraftLocation(null)
          }}
        >
          <RestaurantForm
            initialLocation={restaurantDraftLocation}
            onClose={() => {
              setIsRestaurantFormOpen(false)
              setRestaurantDraftLocation(null)
            }}
          />
        </ModalSheet>
      ) : null}
    </div>
  )
}

export default App
