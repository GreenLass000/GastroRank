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

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
}

export function AuthScreen() {
  const { loadError, login, register } = useAppState()
  const [activeTab, setActiveTab] = useState('login')
  const [loginForm, setLoginForm] = useState(INITIAL_LOGIN_FORM)
  const [registerForm, setRegisterForm] = useState(INITIAL_REGISTER_FORM)
  const [status, setStatus] = useState({ tone: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

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
        <div className="auth-card__hero">
          <div>
            <span className="auth-card__brandline">Neo-Bistró Social</span>
          </div>
          <div>
            <h1>GastroRank</h1>
            <p>
              Guarda platos, compara rankings y convierte cada salida en una memoria
              compartible.
            </p>
            <ul>
              <li>Rankings compactos por plato, categoría y restaurante.</li>
              <li>Mapa usable aunque falle la geolocalización.</li>
              <li>Perfil con logros, listas y reportes para compartir.</li>
            </ul>
          </div>
        </div>
        <div className="auth-card__panel">
          <div className="auth-card__header">
            <span className="auth-card__brand">🍽️</span>
            <h2>{activeTab === 'login' ? 'Vuelve a tu mesa' : 'Crea tu cuenta foodie'}</h2>
            <p>
              {activeTab === 'login'
                ? 'Accede con usuario o correo para seguir puntuando.'
                : 'Regístrate en menos de un minuto y empieza a guardar platos.'}
            </p>
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
                {isSubmitting ? 'Cargando...' : 'Entrar'}
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
