import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiTenderApplicants, apiSelectApplicant, apiRejectApplicant } from '../api';
import { Card, CardTitle, CardMeta } from '../components/Card';
import { ApplicationStatusBadge } from '../components/Badge';
import { Button } from '../components/Button';
import { SkeletonList } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { TG, hapticNotify } from '../telegram';
import styles from './TenderApplicantsScreen.module.css';

interface Props {
  tenderId: number;
}

export function TenderApplicantsScreen({ tenderId }: Props) {
  const qc = useQueryClient();
  const [actionId, setActionId] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['applicants', tenderId],
    queryFn: () => apiTenderApplicants(tenderId),
    refetchInterval: 20_000,
  });

  async function handleSelect(appId: number, name: string) {
    TG?.showConfirm(`Выбрать ${name} исполнителем?`, async (ok) => {
      if (!ok) return;
      setActionId(appId);
      try {
        await apiSelectApplicant(appId);
        hapticNotify('success');
        await qc.invalidateQueries({ queryKey: ['applicants', tenderId] });
        await qc.invalidateQueries({ queryKey: ['my-tenders'] });
      } catch (e) {
        hapticNotify('error');
        TG?.showAlert((e as Error).message);
      } finally {
        setActionId(null);
      }
    });
  }

  async function handleReject(appId: number) {
    TG?.showConfirm('Отклонить этого кандидата?', async (ok) => {
      if (!ok) return;
      setActionId(appId);
      try {
        await apiRejectApplicant(appId);
        await qc.invalidateQueries({ queryKey: ['applicants', tenderId] });
      } catch (e) {
        TG?.showAlert((e as Error).message);
      } finally {
        setActionId(null);
      }
    });
  }

  if (isLoading) return <div className={styles.screen}><SkeletonList count={3} /></div>;

  if (error) {
    return (
      <div className={styles.screen}>
        <div className={styles.errorMsg}>{(error as Error).message}</div>
      </div>
    );
  }

  const applicants = data?.applications ?? [];

  return (
    <div className={styles.screen}>
      {applicants.length === 0 ? (
        <EmptyState icon="👥" title="Нет откликов" subtitle="Пока никто не откликнулся на этот заказ." />
      ) : (
        applicants.map((a) => (
          <Card key={a.id}>
            <div className={styles.header}>
              <div>
                <CardTitle>{a.full_name}</CardTitle>
                <CardMeta>{a.city}</CardMeta>
                {a.skills?.length > 0 && <CardMeta>{a.skills.join(', ')}</CardMeta>}
              </div>
              <ApplicationStatusBadge status={a.status} />
            </div>

            {a.status === 'applied' && (
              <div className={styles.actions}>
                <Button
                  size="sm"
                  onClick={() => handleSelect(a.id, a.full_name)}
                  loading={actionId === a.id}
                >
                  Выбрать
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleReject(a.id)}
                  loading={actionId === a.id}
                >
                  Отклонить
                </Button>
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
