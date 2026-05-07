export function ListsScreen({ onNavigate }) {
  return (
    <section className="screen" aria-label="Pantalla archivada de listas">
      <article className="surface-card">
        <strong>La pestaña Listas ya no forma parte de la navegación principal.</strong>
        <p>
          La fase social vive ahora en <strong>Comunidad</strong> y la exportación CSV,
          listas guardadas y ajustes relacionados se han movido a <strong>Perfil</strong>.
        </p>
        <div className="modal-actions">
          <button
            className="pill-button"
            type="button"
            onClick={() => onNavigate?.('community')}
          >
            Ir a Comunidad
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={() => onNavigate?.('profile')}
          >
            Ir a Perfil
          </button>
        </div>
      </article>
    </section>
  )
}
