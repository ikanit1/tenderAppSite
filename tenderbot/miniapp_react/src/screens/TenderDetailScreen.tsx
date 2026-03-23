import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiTenderDetail, apiApply } from '../api';
import { Card, CardTitle, CardMeta } from '../components/Card';
import { TenderStatusBadge, Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { SkeletonList } from '../components/Skeleton';
import { TG, hapticNotify } from '../telegram';
import styles from './ScreenBase.module.css';

interface Props {
  tenderId: number;
}

export function TenderDetailScreen({ tenderId }: Props) {
  const qc = useQueryClient();
  const [applying, setApplying] = useState(false);

  const { data: tender, isLoading, error } = useQuery({
    queryKey: ['tender', tenderId],
    queryFn: () => apiTenderDetail(tenderId),
  });

  if (isLoading) return <div className={styles.screen}><SkeletonList count={2} /></div>;

  if (error || !tender) {
    return (
      <div className={styles.screen}>
        <div className={styles.errorMsg}>{error ? (error as Error).message : 'Заказ не найден'}</div>
      </div>
    );
  }

  const deadlineDate = tender.deadline ? new Date(tender.deadline) : null;
  const deadlineStr = deadlineDate ? deadlineDate.toLocaleString('ru-RU') : 'Не указан';
  const msLeft = deadlineDate ? deadlineDate.getTime() - Date.now() : null;
  const nearDeadline = tender.status === 'open' && msLeft !== null && msLeft > 0 && msLeft <= 86_400_000;
  const canApply = !tender.has_applied && tender.status === 'open';

  async function handleApply() {
    setApplying(true);
    try {
      await apiApply(tenderId);
      hapticNotify('success');
      await qc.invalidateQueries({ queryKey: ['tender', tenderId] });
      await qc.invalidateQueries({ queryKey: ['tenders'] });
      await qc.invalidateQueries({ queryKey: ['applications'] });
      TG?.showAlert('Отклик отправлен! Ожидайте решения заказчика.');
    } catch (e) {
      hapticNotify('error');
      TG?.showAlert((e as Error).message);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className={styles.screen}>
      <Card>
        <div className={styles.cardHeader}>
          <CardTitle>{tender.title}</CardTitle>
          <TenderStatusBadge status={tender.status} />
        </div>
        <CardMeta>{tender.city} · {tender.category}</CardMeta>
        <CardMeta>
          {tender.budget ? `${tender.budget}` : 'По договорённости'} · {deadlineStr}
        </CardMeta>
        {nearDeadline && (
          <Badge variant="warning">Менее 24 часов до закрытия</Badge>
        )}
      </Card>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>Описание</p>
        <p className={styles.sectionText}>{tender.description}</p>
      </div>

      <div className={styles.btnRow}>
        {canApply ? (
          <Button fullWidth onClick={handleApply} loading={applying}>
            Откликнуться
          </Button>
        ) : tender.has_applied ? (
          <p className={styles.hint}>Вы уже откликнулись на этот заказ</p>
        ) : null}
      </div>
    </div>
  );
}
