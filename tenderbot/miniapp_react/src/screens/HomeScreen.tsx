import { useQuery } from '@tanstack/react-query';
import { apiMe } from '../api';
import { useAppStore } from '../store';
import { Card, CardTitle, CardMeta, CardDesc } from '../components/Card';
import { Button } from '../components/Button';
import styles from './HomeScreen.module.css';

const STATUS_LABELS: Record<string, string> = {
  active:              'Активен',
  pending_moderation:  'На модерации',
  banned:              'Заблокирован',
};

export function HomeScreen() {
  const { navigate } = useAppStore();
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: apiMe, retry: false });

  if (!user) return null;

  const isExecutor = user.role === 'executor' || user.role === 'both';
  const isCustomer = user.role === 'customer' || user.role === 'both';
  const statusLabel = STATUS_LABELS[user.status] ?? user.status;

  return (
    <div className={styles.screen}>
      <Card welcome>
        <CardTitle>Привет, {user.full_name}!</CardTitle>
        <CardMeta>{user.city} · {statusLabel}</CardMeta>
        <CardDesc>
          {isExecutor && isCustomer
            ? 'Вы можете как откликаться на заказы, так и создавать собственные.'
            : isCustomer
            ? 'Создавайте заказы и выбирайте исполнителей.'
            : 'Просматривайте заказы, откликайтесь и следите за статусами.'}
        </CardDesc>
      </Card>

      <div className={styles.actions}>
        {isExecutor && (
          <>
            <Button fullWidth onClick={() => navigate('tenders')}>
              Смотреть заказы
            </Button>
            <Button fullWidth variant="secondary" onClick={() => navigate('applications')}>
              Мои отклики
            </Button>
          </>
        )}
        {isCustomer && (
          <>
            <Button fullWidth variant={isExecutor ? 'secondary' : 'primary'} onClick={() => navigate('my_tenders')}>
              Мои заказы
            </Button>
            <Button fullWidth variant="secondary" onClick={() => navigate('create_tender')}>
              + Создать заказ
            </Button>
          </>
        )}
        <Button fullWidth variant="secondary" onClick={() => navigate('support')}>
          Поддержка
        </Button>
        <Button fullWidth variant="ghost" onClick={() => navigate('profile')}>
          Профиль
        </Button>
      </div>
    </div>
  );
}
