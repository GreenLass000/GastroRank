import { useState } from 'react'
import { useAppState } from '../hooks/useAppState.js'

const INITIAL_LOGIN_FORM = {
  identifier: '',
  password: '',
}

const INITIAL_REGISTER_FORM = {
  nombre: '',
  email: '',
  password: '',
}

const ONBOARDING_SLIDES = [
  {
    id: 'intro',
    eyebrow: 'Bienvenido',
    title: 'GastroRank',
    description:
      'Descubre. Prueba. Rankea. Guarda tus sitios favoritos y empieza tu criterio gastronómico.',
    accent: '¿No tienes cuenta?',
    primaryLabel: 'Comenzar',
    secondaryLabel: 'Iniciar sesión',
    secondaryTab: 'login',
    highlights: ['Descubre', 'Prueba', 'Rankea'],
  },
  {
    id: 'create',
    eyebrow: 'Ventana 2',
    title: 'Crea, explora y comparte',
    description:
      'Añade platos, encuentra nuevos restaurantes y comparte recomendaciones que merezcan quedarse.',
    accent: 'Explora lo que está puntuando la comunidad',
    primaryLabel: 'Siguiente',
    secondaryAction: 'next',
    secondaryLabel: 'Iniciar sesión',
    secondaryTab: 'login',
    highlights: ['Crea', 'Explora', 'Comparte'],
  },
  {
    id: 'community',
    eyebrow: 'Ventana 3',
    title: 'Haz crecer a la comunidad',
    description:
      'Súmate para descubrir más sitios, añadir contexto y construir un mapa gastronómico vivo.',
    accent: 'Forma parte del movimiento foodie local',
    primaryLabel: 'Registrarse',
    primaryTab: 'register',
    secondaryLabel: 'Iniciar sesión',
    secondaryTab: 'login',
    highlights: ['Comunidad', 'Nuevos lugares', 'Opiniones reales'],
  },
]

const SLIDE_SYMBOLS = ['G', '△', '✦']

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
}

function getSecondaryAction(slide, activeSlide, goToSlide, handleSlideAction) {
  if (slide.secondaryAction === 'next') {
    return () => goToSlide(activeSlide + 1)
  }

  if (slide.secondaryTab) {
    return () => handleSlideAction(slide.secondaryTab)
  }

  return undefined
}

export function AuthScreen() {
  const { loadError, login, register } = useAppState()
  const [activeView, setActiveView] = useState('onboarding')
  const [activeSlide, setActiveSlide] = useState(0)
  const [loginForm, setLoginForm] = useState(INITIAL_LOGIN_FORM)
  const [registerForm, setRegisterForm] = useState(INITIAL_REGISTER_FORM)
  const [status, setStatus] = useState({ tone: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [touchStartX, setTouchStartX] = useState(null)

  function goToSlide(nextIndex) {
    const normalizedIndex =
      ((nextIndex % ONBOARDING_SLIDES.length) + ONBOARDING_SLIDES.length) %
      ONBOARDING_SLIDES.length
    setActiveSlide(normalizedIndex)
  }

  function openForm(nextView) {
    setActiveView(nextView)
    setStatus({ tone: '', message: '' })
  }

  function closeForm() {
    setActiveView('onboarding')
    setStatus({ tone: '', message: '' })
  }

  function handleTouchStart(event) {
    setTouchStartX(event.touches[0]?.clientX ?? null)
  }

  function handleTouchEnd(event) {
    if (touchStartX === null) {
      return
    }

    const touchEndX = event.changedTouches[0]?.clientX ?? touchStartX
    const deltaX = touchStartX - touchEndX

    if (Math.abs(deltaX) > 50) {
      goToSlide(activeSlide + (deltaX > 0 ? 1 : -1))
    }

    setTouchStartX(null)
  }

  async function handleLoginSubmit(event) {
    event.preventDefault()
    setStatus({ tone: '', message: '' })

    if (!loginForm.identifier.trim()) {
      setStatus({ tone: 'error', message: 'Introduce tu usuario o correo.' })
      return
    }

    if (loginForm.password.trim().length < 8) {
      setStatus({
        tone: 'error',
        message: 'La contraseña debe tener al menos 8 caracteres.',
      })
      return
    }

    try {
      setIsSubmitting(true)
      await login(loginForm.identifier, loginForm.password)
    } catch (error) {
      setStatus({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'No se pudo iniciar sesión.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault()
    setStatus({ tone: '', message: '' })

    if (!registerForm.nombre.trim()) {
      setStatus({ tone: 'error', message: 'El usuario es obligatorio.' })
      return
    }

    if (!validateEmail(registerForm.email)) {
      setStatus({ tone: 'error', message: 'Introduce un email válido.' })
      return
    }

    if (registerForm.password.trim().length < 8) {
      setStatus({
        tone: 'error',
        message: 'La contraseña debe tener al menos 8 caracteres.',
      })
      return
    }

    try {
      setIsSubmitting(true)
      await register(registerForm.nombre, registerForm.email, registerForm.password)
    } catch (error) {
      setStatus({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'No se pudo crear la cuenta.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="auth-screen auth-flow" aria-label="Acceso a GastroRank">
      {activeView === 'onboarding' ? (
        <article
          className="auth-flow__onboarding auth-flow__onboarding--full"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="auth-flow__phone-frame">
            <header className="auth-flow__phone-topbar">
              <span className="auth-flow__time">9:41</span>
              <span className="auth-flow__status">●●●</span>
            </header>

            <div className="auth-flow__decor" aria-hidden="true">
              <span>🍔</span>
              <span>✦</span>
              <span>🍣</span>
              <span>⌁</span>
              <span>🍕</span>
              <span>○</span>
            </div>

            <div className="auth-flow__carousel">
              <div
                className="auth-flow__track"
                style={{ transform: `translateX(-${activeSlide * 100}%)` }}
              >
                {ONBOARDING_SLIDES.map((slide, index) => (
                  <section className="auth-flow__slide" key={slide.id}>
                    <div className="auth-flow__slide-main">
                      <div className="auth-flow__logo-badge" aria-hidden="true">
                        {SLIDE_SYMBOLS[index] ?? 'G'}
                      </div>
                      <div className="auth-flow__copy">
                        <span className="auth-flow__eyebrow">{slide.eyebrow}</span>
                        <h1>{slide.title}</h1>
                        <p>{slide.description}</p>
                      </div>
                    </div>

                    <div className="auth-flow__tags" aria-label="Puntos destacados">
                      {slide.highlights.map((highlight) => (
                        <span className="auth-flow__tag" key={highlight}>
                          {highlight}
                        </span>
                      ))}
                    </div>

                    <div className="auth-flow__slide-actions">
                      <p className="auth-flow__prompt">{slide.accent}</p>
                      <button
                        className="auth-flow__slide-primary"
                        type="button"
                        onClick={() =>
                          slide.primaryTab
                            ? openForm(slide.primaryTab)
                            : goToSlide(activeSlide + 1)
                        }
                      >
                        {slide.primaryLabel}
                      </button>
                      <button
                        className="auth-flow__slide-secondary"
                        type="button"
                        onClick={getSecondaryAction(slide, activeSlide, goToSlide, openForm)}
                      >
                        {slide.secondaryLabel}
                      </button>
                    </div>
                  </section>
                ))}
              </div>
            </div>

            <footer className="auth-flow__phone-footer">
              <div className="auth-flow__dots" role="tablist" aria-label="Ventanas de onboarding">
                {ONBOARDING_SLIDES.map((slide, index) => (
                  <button
                    key={slide.id}
                    className={`auth-flow__dot${index === activeSlide ? ' auth-flow__dot--active' : ''}`}
                    type="button"
                    onClick={() => goToSlide(index)}
                    aria-label={`Ir a la ventana ${index + 1}`}
                    aria-selected={index === activeSlide}
                  />
                ))}
              </div>
            </footer>
          </div>
        </article>
      ) : (
        <article className="auth-flow__form-shell">
          <div className="auth-flow__form-card">
            <button className="auth-flow__back" type="button" onClick={closeForm}>
              ← Volver
            </button>

            <div className="auth-flow__form-header">
              <span className="auth-flow__panel-mark">G</span>
              <div>
                <h2>{activeView === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h2>
                <p>
                  {activeView === 'login'
                    ? 'Accede con usuario o correo para seguir puntuando.'
                    : 'Regístrate y empieza a guardar tus rankings.'}
                </p>
              </div>
            </div>

            {activeView === 'login' ? (
            <form className="form-stack" onSubmit={handleLoginSubmit}>
              <label className="field">
                <span>Usuario o correo</span>
                <input
                  type="text"
                  autoComplete="username"
                  value={loginForm.identifier}
                  placeholder="Tu usuario o correo"
                  onChange={(event) =>
                    setLoginForm((current) => ({
                      ...current,
                      identifier: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Contraseña</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                />
              </label>
              <button className="primary-button auth-flow__submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Cargando...' : 'Iniciar sesión'}
              </button>
            </form>
          ) : (
            <form className="form-stack" onSubmit={handleRegisterSubmit}>
              <label className="field">
                <span>Usuario</span>
                <input
                  type="text"
                  autoComplete="username"
                  value={registerForm.nombre}
                  placeholder="Elige tu usuario"
                  onChange={(event) =>
                    setRegisterForm((current) => ({
                      ...current,
                      nombre: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={registerForm.email}
                  onChange={(event) =>
                    setRegisterForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Contraseña</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={registerForm.password}
                  onChange={(event) =>
                    setRegisterForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                />
              </label>
              <button className="primary-button auth-flow__submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Cargando...' : 'Crear cuenta'}
              </button>
            </form>
          )}

          {status.message ? (
            <div className={`status-banner status-banner--${status.tone || 'info'}`}>
              <strong>{status.tone === 'error' ? 'Revisión' : 'Estado'}</strong>
              <p>{status.message}</p>
            </div>
          ) : null}

          {loadError ? (
            <div className="status-banner status-banner--error">
              <strong>Conectividad</strong>
              <p>{loadError}</p>
            </div>
          ) : null}
          </div>
        </article>
      )}
    </section>
  )
}
