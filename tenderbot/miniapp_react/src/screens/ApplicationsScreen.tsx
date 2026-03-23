import { useQuery } from '@tanstack/react-query';
import { apiApplications } from '../api';
import { useAppStore } from '../store';
import { Card, CardTitle, CardMeta } from '../components/Card';
import { ApplicationStatusBadge } from '../components/Badge';
import { SkeletonList } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { haptic } from '../telegram';
import styles from './ScreenBase.module.css';

export function ApplicationsScreen() {
  const { navigate } = useAppStore();
  const { data, isLoading, error } = useQuery({
    queryKey: ['applications'],
    queryFn: apiApplications,
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

  const applications = data?.applications ?? [];

  return (
    <div className={styles.screen}>
      {applications.length === 0 ? (
        <EmptyState
          icon="📩"
          title="Нет откликов"
          subtitle="Выберите заказ и нажмите «Откликнуться», чтобы отправить заявку."
        />
      ) : (
        applications.map((a) => (
          <Card
            key={a.id}
            onClick={() => {
              haptic('light');
              navigate('application', { applicationId: a.id });
            }}
          >
            <div className={styles.cardHeader}>
              <CardTitle>{a.tender_title}</CardTitle>
              <ApplicationStatusBadge status={a.status} />
            </div>
            <CardMeta>{a.tender_city} · {a.tender_category}</CardMeta>
          </Card>
        ))
      )}
    </div>
  );
}
