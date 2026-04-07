import { useEffect, useState } from 'react'
import './App.css'
import { LoadingOverlay } from './components/feedback/LoadingOverlay.jsx'
import { StatusBanner } from './components/feedback/StatusBanner.jsx'
import { ToastCenter } from './components/feedback/ToastCenter.jsx'
import { AddDishWizard } from './components/forms/AddDishWizard.jsx'
import { RestaurantForm } from './components/forms/RestaurantForm.jsx'
import { FloatingActionButton } from './components/layout/FloatingActionButton.jsx'
import { BottomNav } from './components/layout/BottomNav.jsx'
import { ModalSheet } from './components/layout/ModalSheet.jsx'
import { APP_NAME, NAV_ITEMS } from './lib/constants.js'
import { useAppState } from './hooks/useAppState.js'
import { HomeScreen } from './screens/HomeScreen.jsx'
import { RankingsScreen } from './screens/RankingsScreen.jsx'
import { MapScreen } from './screens/MapScreen.jsx'
import { ListsScreen } from './screens/ListsScreen.jsx'
import { ProfileScreen } from './screens/ProfileScreen.jsx'

const SCREEN_COMPONENTS = {
  home: HomeScreen,
  rankings: RankingsScreen,
  map: MapScreen,
  lists: ListsScreen,
  profile: ProfileScreen,
}

function App() {
  const [activeScreen, setActiveScreen] = useState('home')
  const [isDishWizardOpen, setIsDishWizardOpen] = useState(false)
  const [isRestaurantFormOpen, setIsRestaurantFormOpen] = useState(false)
  const [restaurantDraftLocation, setRestaurantDraftLocation] = useState(null)
  const { dataSource, isLoading, loadError, toast, clearToast } = useAppState()

  const activeNavItem =
    NAV_ITEMS.find((item) => item.id === activeScreen) ?? NAV_ITEMS[0]

  function renderActiveScreen() {
    if (activeScreen === 'map') {
      return (
        <MapScreen
          onCreateRestaurantAtLocation={(location) => {
            setRestaurantDraftLocation(location)
            setIsRestaurantFormOpen(true)
          }}
        />
      )
    }

    const ActiveScreen = SCREEN_COMPONENTS[activeScreen]
    return <ActiveScreen />
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

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">PWA gastronómica</p>
          <h1>{APP_NAME}</h1>
        </div>
        <button className="icon-button" type="button" aria-label="Buscar">
          🔎
        </button>
      </header>

      <main className="screen-container">
        {loadError ? (
          <StatusBanner
            tone="error"
            title="Carga parcial"
            detail={loadError}
          />
        ) : null}
        {dataSource === 'api' ? (
          <StatusBanner
            tone="success"
            title="Datos sincronizados"
            detail="La app está leyendo datos reales desde la API SQLite local."
          />
        ) : null}
        {renderActiveScreen()}
      </main>

      <FloatingActionButton
        label="Añadir plato rápido"
        onClick={() => setIsDishWizardOpen(true)}
      />
      <BottomNav
        activeId={activeNavItem.id}
        items={NAV_ITEMS}
        onChange={setActiveScreen}
      />
      {isLoading ? <LoadingOverlay message="Cargando..." /> : null}
      <ToastCenter message={toast.message} tone={toast.tone} />
      {isDishWizardOpen ? (
        <ModalSheet
          title="Añadir plato"
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
      {isRestaurantFormOpen ? (
        <ModalSheet
          title="Nuevo restaurante"
          onClose={() => {
            clearToast()
            setIsRestaurantFormOpen(false)
            setRestaurantDraftLocation(null)
          }}
        >
          <RestaurantForm
            initialLocation={restaurantDraftLocation}
            onCreated={() => {
              setRestaurantDraftLocation(null)
            }}
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
