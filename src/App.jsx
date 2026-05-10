import { Suspense, lazy, useEffect, useState } from 'react'
import './App.css'
import { LoadingOverlay } from './components/feedback/LoadingOverlay.jsx'
import { StatusBanner } from './components/feedback/StatusBanner.jsx'
import { ToastCenter } from './components/feedback/ToastCenter.jsx'
import { BottomNav } from './components/layout/BottomNav.jsx'
import { FloatingActionButton } from './components/layout/FloatingActionButton.jsx'
import { ModalSheet } from './components/layout/ModalSheet.jsx'
import { fetchPublicShare } from './lib/api.js'
import { NAV_ITEMS } from './lib/constants.js'
import { useAppState } from './hooks/useAppState.js'

const EntityDetailSheet = lazy(() =>
  import('./components/details/EntityDetailSheet.jsx').then((module) => ({
    default: module.EntityDetailSheet,
  })),
)
const AddDishWizard = lazy(() =>
  import('./components/forms/AddDishWizard.jsx').then((module) => ({
    default: module.AddDishWizard,
  })),
)
const RestaurantForm = lazy(() =>
  import('./components/forms/RestaurantForm.jsx').then((module) => ({
    default: module.RestaurantForm,
  })),
)
const GlobalSearchPanel = lazy(() =>
  import('./components/search/GlobalSearchPanel.jsx').then((module) => ({
    default: module.GlobalSearchPanel,
  })),
)
const HomeScreen = lazy(() =>
  import('./screens/HomeScreen.jsx').then((module) => ({
    default: module.HomeScreen,
  })),
)
const AuthScreen = lazy(() =>
  import('./screens/AuthScreen.jsx').then((module) => ({
    default: module.AuthScreen,
  })),
)
const ComunidadScreen = lazy(() =>
  import('./screens/ComunidadScreen.jsx').then((module) => ({
    default: module.ComunidadScreen,
  })),
)
const MapScreen = lazy(() =>
  import('./screens/MapScreen.jsx').then((module) => ({
    default: module.MapScreen,
  })),
)
const ProfileScreen = lazy(() =>
  import('./screens/ProfileScreen.jsx').then((module) => ({
    default: module.ProfileScreen,
  })),
)
const RankingsScreen = lazy(() =>
  import('./screens/RankingsScreen.jsx').then((module) => ({
    default: module.RankingsScreen,
  })),
)
const ReportScreen = lazy(() =>
  import('./screens/ReportScreen.jsx').then((module) => ({
    default: module.ReportScreen,
  })),
)

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

function ScreenFallback({ message = 'Cargando...' }) {
  return (
    <section className="screen" aria-label={message}>
      <article className="surface-card">
        <strong>{message}</strong>
      </article>
    </section>
  )
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
  const { authChecked, currentUser, isLoading, loadError, toast, clearToast } =
    useAppState()

  const activeNavItem =
    NAV_ITEMS.find((item) => item.id === activeScreen) ?? NAV_ITEMS[0]
  const isPublicShareView = activeScreen === 'report' && Boolean(shareToken)
  const requiresAuth = !isPublicShareView
  const shouldShowAuthScreen = requiresAuth && authChecked && !currentUser
  const isHomeScreen = activeScreen === 'home'
  const showTopbar = Boolean(currentUser) && isHomeScreen && !shareToken

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
        onOpenAddDish={() => setIsDishWizardOpen(true)}
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
        <header className={`topbar${isHomeScreen ? ' topbar--home' : ''}`}>
          <button
            className="shell-search-bar"
            type="button"
            aria-label="Buscar restaurantes, platos o perfiles"
            onClick={() => setIsSearchOpen(true)}
          >
            <span className="shell-search-bar__ornament" aria-hidden="true">
              <span className="shell-search-bar__spark shell-search-bar__spark--orange" />
              <span className="shell-search-bar__spark shell-search-bar__spark--purple" />
            </span>
            <span className="shell-search-bar__content">
              <span className="shell-search-bar__eyebrow">Explorar rápido</span>
              <span className="shell-search-bar__label">
                Buscar restaurantes, platos o perfiles
              </span>
            </span>
            <span className="shell-search-bar__badge">Abrir</span>
          </button>
        </header>
      ) : null}

      <main
        className={`screen-container${
          isHomeScreen && !shareToken ? ' screen-container--with-floating-search' : ''
        }`}
      >
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
        <Suspense fallback={<ScreenFallback />}>
          {shouldShowAuthScreen ? <AuthScreen /> : null}
          {(!requiresAuth || authChecked) && (!requiresAuth || currentUser)
            ? renderActiveScreen()
            : null}
        </Suspense>
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
        <LoadingOverlay
          message={
            isShareLoading
              ? 'Cargando informe público...'
              : requiresAuth && !authChecked
                ? 'Cargando tu cuenta...'
                : 'Cargando...'
          }
        />
      ) : null}
      <ToastCenter message={toast.message} tone={toast.tone} />

      {isSearchOpen && currentUser ? (
        <ModalSheet
          title="Buscar"
          eyebrow="Acceso rápido"
          immersive
          onClose={() => setIsSearchOpen(false)}
        >
          <Suspense fallback={<ScreenFallback message="Cargando búsqueda..." />}>
            <GlobalSearchPanel
              onClose={() => setIsSearchOpen(false)}
              onOpenEntity={openEntityDetail}
            />
          </Suspense>
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
          <Suspense fallback={<ScreenFallback message="Cargando detalle..." />}>
            <EntityDetailSheet
              key={`${entityDetailTarget.type}:${entityDetailTarget.id}`}
              target={entityDetailTarget}
              onClose={() => setEntityDetailTarget(null)}
            />
          </Suspense>
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
          <Suspense fallback={<ScreenFallback message="Cargando formulario..." />}>
            <AddDishWizard
              onClose={() => {
                setIsDishWizardOpen(false)
              }}
              onOpenRestaurantForm={() => {
                setIsRestaurantFormOpen(true)
              }}
            />
          </Suspense>
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
          <Suspense fallback={<ScreenFallback message="Cargando restaurante..." />}>
            <RestaurantForm
              initialLocation={restaurantDraftLocation}
              onClose={() => {
                setIsRestaurantFormOpen(false)
                setRestaurantDraftLocation(null)
              }}
            />
          </Suspense>
        </ModalSheet>
      ) : null}
    </div>
  )
}

export default App
