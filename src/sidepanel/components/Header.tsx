export function Header({ providerLabel }: { providerLabel: string }) {
  return (
    <header className="sp-header">
      <span className="sp-logo">🕯️ Limn</span>
      <span className="badge">{providerLabel}</span>
    </header>
  );
}
