import { useAppStore } from '../store';
import styles from './Header.module.css';

const SCREEN_TITLES: Record<string, string> = {
  home:               'TenderBot',
  tenders:            'Заказы',
  tender:             'Заказ',
  applications:       'Мои отклики',
  application:        'Отклик',
  support:            'Поддержка',
  support_chat:       'Чат с поддержкой',
  profile:            'Профиль',
  profile_edit:       'Редактирование',
  my_tenders:         'Мои заказы',
  create_tender:      'Новый заказ',
  tender_applicants:  'Отклики на заказ',
};

export function Header() {
  const { screen, back, canGoBack } = useAppStore();
  const title = SCREEN_TITLES[screen] ?? 'TenderBot';

  return (
    <header className={styles.header}>
      {canGoBack() ? (
        <button className={styles.backBtn} onClick={back} aria-label="Назад">
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
            <path d="M8.5 1.5L2 8l6.5 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : (
        <div className={styles.placeholder} />
      )}
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.placeholder} />
    </header>
  );
}
