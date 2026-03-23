import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiSupportTickets, apiCreateTicket } from '../api';
import { useAppStore } from '../store';
import { Card, CardTitle, CardMeta } from '../components/Card';
import { TicketStatusBadge } from '../components/Badge';
import { Button } from '../components/Button';
import { SkeletonList } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { TG, haptic } from '../telegram';
import styles from './ScreenBase.module.css';

export function SupportScreen() {
  const { navigate } = useAppStore();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['support-tickets'],
    queryFn: apiSupportTickets,
    refetchInterval: 20_000,
  });

  async function handleNew() {
    setCreating(true);
    try {
      const res = await apiCreateTicket();
      haptic('medium');
      await qc.invalidateQueries({ queryKey: ['support-tickets'] });
      navigate('support_chat', { ticketId: res.id });
    } catch (e) {
      TG?.showAlert((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  if (isLoading) return <div className={styles.screen}><SkeletonList count={2} /></div>;

  if (error) {
    return (
      <div className={styles.screen}>
        <div className={styles.errorMsg}>{(error as Error).message}</div>
      </div>
    );
  }

  const tickets = data?.tickets ?? [];

  return (
    <div className={styles.screen}>
      <p className={styles.hint}>
        Задайте вопрос или опишите проблему. Ответ придёт в этот чат.
      </p>

      {tickets.length === 0 ? (
        <EmptyState icon="💬" title="Нет обращений" />
      ) : (
        tickets.map((t) => (
          <Card
            key={t.id}
            onClick={() => {
              haptic('light');
              navigate('support_chat', { ticketId: t.id });
            }}
          >
            <div className={styles.cardHeader}>
              <CardTitle>Обращение #{t.id}</CardTitle>
              <TicketStatusBadge status={t.status} />
            </div>
            <CardMeta>
              {t.created_at ? new Date(t.created_at).toLocaleString('ru-RU') : '—'}
              {t.last_preview ? ` · ${t.last_preview}` : ''}
            </CardMeta>
          </Card>
        ))
      )}

      <div className={styles.btnRow}>
        <Button fullWidth onClick={handleNew} loading={creating}>
          Новое обращение
        </Button>
      </div>
    </div>
  );
}
