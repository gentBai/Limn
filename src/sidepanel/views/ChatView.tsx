import { EmptyState } from '../components/EmptyState';
import { t } from '@/i18n';

// MVP: chat view is UI-only; full chat lands in v1.1
export function ChatView() {
  return (
    <EmptyState
      icon="💬"
      title={t('chat.emptyTitle')}
      desc={t('chat.emptyDesc')}
    />
  );
}
