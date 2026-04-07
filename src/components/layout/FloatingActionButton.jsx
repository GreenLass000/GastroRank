export function FloatingActionButton({ label, onClick }) {
  return (
    <button className="fab" type="button" onClick={onClick}>
      ➕ {label}
    </button>
  )
}
