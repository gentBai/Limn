import logoUrl from '../../../public/icons/icon.svg?url';

export function Header({ providerLabel }: { providerLabel: string }) {
  return (
    <header className="sp-header">
      <span className="sp-logo">
        <img className="sp-logo-img" src={logoUrl} alt="Limn" />
        Limn
      </span>
      <span className="badge">{providerLabel}</span>
    </header>
  );
}
