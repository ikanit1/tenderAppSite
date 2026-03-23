import { useQuery } from '@tanstack/react-query';
import { apiApplicationDetail } from '../api';
import { Card, CardTitle, CardMeta } from '../components/Card';
import { ApplicationStatusBadge } from '../components/Badge';
import { SkeletonList } from '../components/Skeleton';
import styles from './ScreenBase.module.css';

const STATUS_HINTS: Record<string, string> = {
  applied:  'Ожидайте решения заказчика. Как только исполнитель будет выбран, статус изменится.',
  selected: 'Вас выбрали по этому заказу! С вами свяжутся для уточнения деталей.',
  rejected: 'По этому заказу выбран другой исполнитель.',
};

interface Props {
  applicationId: number;
}

export function ApplicationDetailScreen({ applicationId }: Props) {
  const { data: app, isLoading, error } = useQuery({
    queryKey: ['application', applicationId],
    queryFn: () => apiApplicationDetail(applicationId),
    refetchInterval: 15_000,
  });

  if (isLoading) return <div className={styles.screen}><SkeletonList count={2} /></div>;

  if (error || !app) {
    return (
      <div className={styles.screen}>
        <div className={styles.errorMsg}>{error ? (error as Error).message : 'Отклик не найден'}</div>
      </div>
    );
  }

  const hint = STATUS_HINTS[app.status];

  return (
    <div className={styles.screen}>
      <Card>
        <div className={styles.cardHeader}>
          <CardTitle>{app.tender_title}</CardTitle>
          <ApplicationStatusBadge status={app.status} />
        </div>
        <CardMeta>{app.tender_city} · {app.tender_category}</CardMeta>
        {app.tender_budget && <CardMeta>{app.tender_budget}</CardMeta>}
      </Card>

      {hint && (
        <div className={styles.section}>
          <p className={styles.sectionText}>{hint}</p>
        </div>
      )}

      <div className={styles.section}>
        <p className={styles.sectionTitle}>Описание заказа</p>
        <p className={styles.sectionText}>{app.tender_description}</p>
      </div>

      {app.created_at && (
        <p className={styles.hint}>
          Дата отклика: {new Date(app.created_at).toLocaleString('ru-RU')}
        </p>
      )}
    </div>
  );
}
