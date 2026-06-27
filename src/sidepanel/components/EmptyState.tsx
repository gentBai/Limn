interface EmptyStateProps {
  icon: string;
  title: string;
  desc: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, desc, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-desc">{desc}</div>
      {actionLabel && onAction && (
        <div style={{ marginTop: '16px' }}>
          <button className="btn btn-primary btn-lg" onClick={onAction}>{actionLabel}</button>
        </div>
      )}
    </div>
  );
}
