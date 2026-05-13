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
    eyebrow: 'Bienvenido a GastroRank',
    title: 'Descubre, prueba y rankea sin perder el hilo.',
    description:
      'Guarda tus hallazgos, vuelve a tus favoritos y empieza tu ranking personal en pocos segundos.',
    accent: 'No tienes cuenta? Comenzar',
    primaryLabel: 'Comenzar',
    primaryTab: 'register',
    secondaryLabel: 'Iniciar sesión',
    secondaryTab: 'login',
    highlights: ['Rankings reales', 'Tus platos favoritos', 'Acceso rápido'],
  },
  {
    id: 'create',
    eyebrow: 'Crea, explora y comparte',
    title: 'Convierte cada salida en una pista útil para el resto.',
    description:
      'Añade platos, descubre sitios por categoría y comparte hallazgos que merezcan entrar en el mapa.',
    accent: 'Tu criterio también construye la experiencia',
    primaryLabel: 'Explorar acceso',
    primaryTab: 'login',
    secondaryLabel: 'Ver siguiente',
    secondaryAction: 'next',
    highlights: ['Crea listas', 'Explora rankings', 'Comparte hallazgos'],
  },
  {
    id: 'community',
    eyebrow: 'Haz crecer la comunidad',
    title: 'Tu próxima recomendación puede ayudar a toda la ciudad.',
    description:
      'Súmate para registrar nuevos lugares, puntuar con contexto y dejar una comunidad gastronómica más viva.',
    accent: 'Empieza hoy',
    primaryLabel: 'Registrarse',
    primaryTab: 'register',
    secondaryLabel: 'Iniciar sesión',
    secondaryTab: 'login',
    highlights: ['Más sitios', 'Más opiniones', 'Más contexto'],
  },
]

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
}

export function AuthScreen() {
  const { loadError, login, register } = useAppState()
  const [activeTab, setActiveTab] = useState('login')
  const [activeSlide, setActiveSlide] = useState(0)
  const [loginForm, setLoginForm] = useState(INITIAL_LOGIN_FORM)
  const [registerForm, setRegisterForm] = useState(INITIAL_REGISTER_FORM)
  const [status, setStatus] = useState({ tone: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [touchStartX, setTouchStartX] = useState(null)

  const currentSlide = ONBOARDING_SLIDES[activeSlide] ?? ONBOARDING_SLIDES[0]

  function goToSlide(nextIndex) {
    const normalizedIndex =
      ((nextIndex % ONBOARDING_SLIDES.length) + ONBOARDING_SLIDES.length) %
      ONBOARDING_SLIDES.length
    setActiveSlide(normalizedIndex)
  }

  function handleSlideAction(tab) {
    setActiveTab(tab)
    setStatus({ tone: '', message: '' })
  }

  function handleSecondaryAction(slide) {
    if (slide.secondaryAction === 'next') {
      goToSlide(activeSlide + 1)
      return
    }

    if (slide.secondaryTab) {
      handleSlideAction(slide.secondaryTab)
    }
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
    <section className="auth-screen" aria-label="Acceso a GastroRank">
      <article className="auth-card">
        <div
          className="auth-card__hero auth-hero"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="auth-hero__topbar">
            <span className="auth-card__brandline">GastroRank</span>
            <div className="auth-hero__actions" aria-label="Controles del onboarding">
              <button
                className="auth-hero__nav"
                type="button"
                onClick={() => goToSlide(activeSlide - 1)}
                aria-label="Ir a la diapositiva anterior"
              >
                ←
              </button>
              <button
                className="auth-hero__nav"
                type="button"
                onClick={() => goToSlide(activeSlide + 1)}
                aria-label="Ir a la diapositiva siguiente"
              >
                →
              </button>
            </div>
          </div>

          <div className="auth-hero__viewport">
            <div
              className="auth-hero__track"
              style={{ transform: `translateX(-${activeSlide * 100}%)` }}
            >
              {ONBOARDING_SLIDES.map((slide) => (
                <section className="auth-hero__slide" key={slide.id}>
                  <div className="auth-hero__content">
                    <span className="auth-hero__eyebrow">{slide.eyebrow}</span>
                    <h1>{slide.title}</h1>
                    <p>{slide.description}</p>
                  </div>

                  <div className="auth-hero__highlights" aria-label="Puntos destacados">
                    {slide.highlights.map((highlight) => (
                      <span className="auth-hero__chip" key={highlight}>
                        {highlight}
                      </span>
                    ))}
                  </div>

                  <div className="auth-hero__cta">
                    <span className="auth-hero__accent">{slide.accent}</span>
                    <button
                      className="auth-hero__primary"
                      type="button"
                      onClick={() => handleSlideAction(slide.primaryTab)}
                    >
                      {slide.primaryLabel}
                    </button>
                    <button
                      className="auth-hero__secondary"
                      type="button"
                      onClick={() => handleSecondaryAction(slide)}
                    >
                      {slide.secondaryLabel}
                    </button>
                  </div>
                </section>
              ))}
            </div>
          </div>

          <div className="auth-hero__footer">
            <div className="auth-hero__dots" role="tablist" aria-label="Mensajes de acceso">
              {ONBOARDING_SLIDES.map((slide, index) => (
                <button
                  key={slide.id}
                  className={`auth-hero__dot${index === activeSlide ? ' auth-hero__dot--active' : ''}`}
                  type="button"
                  onClick={() => goToSlide(index)}
                  aria-label={`Ir a ${slide.eyebrow}`}
                  aria-selected={index === activeSlide}
                />
              ))}
            </div>
            <p className="auth-hero__hint">Desliza para ver las tres ventanas</p>
          </div>
        </div>
        <div className="auth-card__panel">
          <div className="auth-card__header">
            <span className="auth-card__brand">G</span>
            <h2>{activeTab === 'login' ? 'Vuelve a tu mesa' : 'Abre tu cuenta foodie'}</h2>
            <p>
              {activeTab === 'login'
                ? 'Accede con usuario o correo para seguir puntuando, guardando y explorando.'
                : 'Regístrate en menos de un minuto y empieza a aportar a la comunidad.'}
            </p>
          </div>

          <div className="auth-card__slide-summary" aria-live="polite">
            <strong>{currentSlide.eyebrow}</strong>
            <span>{currentSlide.accent}</span>
          </div>

          <div className="auth-tabs" role="tablist" aria-label="Autenticación">
            <button
              className={`auth-tab${activeTab === 'login' ? ' auth-tab--active' : ''}`}
              type="button"
              onClick={() => setActiveTab('login')}
            >
              Iniciar sesión
            </button>
            <button
              className={`auth-tab${activeTab === 'register' ? ' auth-tab--active' : ''}`}
              type="button"
              onClick={() => setActiveTab('register')}
            >
              Registrarse
            </button>
          </div>

          {activeTab === 'login' ? (
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
              <button className="primary-button" type="submit" disabled={isSubmitting}>
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
              <button className="primary-button" type="submit" disabled={isSubmitting}>
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
    </section>
  )
}
