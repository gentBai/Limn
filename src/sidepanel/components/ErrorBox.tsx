import type { ErrorCode } from '@/shared/messages';

interface ErrorBoxProps {
  code: ErrorCode;
  message: string;
  onRetry?: () => void;
  onAction?: () => void;
  actionLabel?: string;
}

export function ErrorBox({ code, message, onRetry, onAction, actionLabel }: ErrorBoxProps) {
  const canRetry = code === 'NETWORK_ERROR' || code === 'RATE_LIMITED' || code === 'MODEL_ERROR';
  const showSettings = code === 'INVALID_API_KEY' || code === 'MISSING_API_KEY';
  return (
    <div className="error-box">
      <div className="error-box-icon">
        {code === 'MISSING_API_KEY' || code === 'INVALID_API_KEY' ? '🔑' : '📡'}
      </div>
      <div className="error-box-title">{message}</div>
      <div className="error-box-actions">
        {canRetry && onRetry && <button className="btn btn-primary btn-sm" onClick={onRetry}>重试</button>}
        {showSettings && onAction && (
          <button className="btn btn-primary btn-sm" onClick={onAction}>{actionLabel ?? '前往设置'}</button>
        )}
      </div>
    </div>
  );
}
