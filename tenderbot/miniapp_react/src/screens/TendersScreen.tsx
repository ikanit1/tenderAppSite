import { useQuery } from '@tanstack/react-query';
import { apiTenders } from '../api';
import { useAppStore } from '../store';
import { Card, CardTitle, CardMeta, CardDesc } from '../components/Card';
import { TenderStatusBadge } from '../components/Badge';
import { SkeletonList } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { haptic } from '../telegram';
import styles from './ScreenBase.module.css';

export function TendersScreen() {
  const { navigate } = useAppStore();
  const { data, isLoading, error } = useQuery({
    queryKey: ['tenders'],
    queryFn: apiTenders,
    refetchInterval: 30_000,
  });

  if (isLoading) return <div className={styles.screen}><SkeletonList count={4} /></div>;

  if (error) {
    return (
      <div className={styles.screen}>
        <div className={styles.errorMsg}>{(error as Error).message}</div>
      </div>
    );
  }

  const tenders = data?.tenders ?? [];

  return (
    <div className={styles.screen}>
      {tenders.length === 0 ? (
        <EmptyState icon="📋" title="Нет открытых заказов" subtitle="Сейчас нет заказов в вашем городе. Попробуйте позже." />
      ) : (
        tenders.map((t) => (
          <Card
            key={t.id}
            onClick={() => {
              haptic('light');
              navigate('tender', { tenderId: t.id });
            }}
          >
            <div className={styles.cardHeader}>
              <CardTitle>{t.title}</CardTitle>
              <TenderStatusBadge status={t.status} hasApplied={t.has_applied} />
            </div>
            <CardMeta>{t.city} · {t.category}{t.budget ? ` · ${t.budget}` : ''}</CardMeta>
            <CardDesc>{t.description.slice(0, 120)}{t.description.length > 120 ? '…' : ''}</CardDesc>
          </Card>
        ))
      )}
    </div>
  );
}
