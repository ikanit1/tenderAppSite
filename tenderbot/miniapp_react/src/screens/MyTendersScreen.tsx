import { useQuery } from '@tanstack/react-query';
import { apiMyTenders } from '../api';
import { useAppStore } from '../store';
import { Card, CardTitle, CardMeta, CardDesc } from '../components/Card';
import { TenderStatusBadge } from '../components/Badge';
import { Button } from '../components/Button';
import { SkeletonList } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { haptic } from '../telegram';
import styles from './ScreenBase.module.css';

export function MyTendersScreen() {
  const { navigate } = useAppStore();
  const { data, isLoading, error } = useQuery({
    queryKey: ['my-tenders'],
    queryFn: apiMyTenders,
    refetchInterval: 30_000,
  });

  if (isLoading) return <div className={styles.screen}><SkeletonList count={3} /></div>;

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
      <div className={styles.btnRow}>
        <Button fullWidth size="sm" onClick={() => navigate('create_tender')}>
          + Создать заказ
        </Button>
      </div>

      {tenders.length === 0 ? (
        <EmptyState
          icon="📋"
          title="Нет заказов"
          subtitle="Нажмите «Создать заказ», чтобы разместить первый."
        />
      ) : (
        tenders.map((t) => (
          <Card
            key={t.id}
            onClick={() => {
              haptic('light');
              navigate('tender_applicants', { tenderId: t.id });
            }}
          >
            <div className={styles.cardHeader}>
              <CardTitle>{t.title}</CardTitle>
              <TenderStatusBadge status={t.status} />
            </div>
            <CardMeta>{t.city} · {t.category}</CardMeta>
            {t.description && (
              <CardDesc>{t.description.slice(0, 80)}{t.description.length > 80 ? '…' : ''}</CardDesc>
            )}
            {typeof t.applications_count === 'number' && (
              <CardMeta>Откликов: {t.applications_count}</CardMeta>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
