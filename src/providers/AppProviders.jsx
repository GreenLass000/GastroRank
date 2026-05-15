import { AppStateProvider } from './AppStateProvider.jsx'
import { AppDataProvider } from './AppDataProvider.jsx'
import { AuthSessionProvider } from './AuthSessionProvider.jsx'
import { FiltersProvider } from './FiltersProvider.jsx'
import { SocialProvider } from './SocialProvider.jsx'

export function AppProviders({ children }) {
  return (
    <AuthSessionProvider>
      <FiltersProvider>
        <AppDataProvider>
          <SocialProvider>
            <AppStateProvider>{children}</AppStateProvider>
          </SocialProvider>
        </AppDataProvider>
      </FiltersProvider>
    </AuthSessionProvider>
  )
}
