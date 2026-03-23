import { useQuery } from '@tanstack/react-query';
import { apiProfile } from '../api';
import { useAppStore } from '../store';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { SkeletonList } from '../components/Skeleton';
import styles from './ProfileScreen.module.css';

const STATUS_LABELS: Record<string, string> = {
  active:             'Активен',
  pending_moderation: 'На модерации',
  banned:             'Заблокирован',
};

const ROLE_LABELS: Record<string, string> = {
  executor: 'Исполнитель',
  customer: 'Заказчик',
  both:     'Исполнитель и заказчик',
};

export function ProfileScreen() {
  const { navigate } = useAppStore();
  const { data: user, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: apiProfile,
  });

  if (isLoading) return <div className={styles.screen}><SkeletonList count={2} /></div>;
  if (!user) return null;

  const skillsStr = user.skills?.length ? user.skills.join(', ') : '—';

  return (
    <div className={styles.screen}>
      <Card>
        <div className={styles.row}>
          <span className={styles.label}>ФИО</span>
          <span className={styles.value}>{user.full_name}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Город</span>
          <span className={styles.value}>{user.city}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Телефон</span>
          <span className={styles.value}>{user.phone}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Роль</span>
          <span className={styles.value}>{ROLE_LABELS[user.role] ?? user.role}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Навыки</span>
          <span className={styles.value}>{skillsStr}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Статус</span>
          <span className={`${styles.value} ${styles[user.status]}`}>
            {STATUS_LABELS[user.status] ?? user.status}
          </span>
        </div>
      </Card>

      <div className={styles.btnRow}>
        <Button fullWidth variant="secondary" onClick={() => navigate('profile_edit')}>
          Редактировать профиль
        </Button>
      </div>
    </div>
  );
}
