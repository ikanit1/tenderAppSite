import { useAppStore, TAB_SCREENS, type Screen } from '../store';
import { useQuery } from '@tanstack/react-query';
import { apiMe } from '../api';
import styles from './Tabbar.module.css';

interface TabDef {
  screen: Screen;
  label: string;
  icon: string;
  roles?: Array<'executor' | 'customer' | 'both'>;
}

const EXECUTOR_TABS: TabDef[] = [
  { screen: 'home',         label: 'Главная',  icon: '⌂' },
  { screen: 'tenders',      label: 'Заказы',   icon: '◫' },
  { screen: 'applications', label: 'Отклики',  icon: '✉' },
  { screen: 'support',      label: 'Чат',      icon: '◎' },
  { screen: 'profile',      label: 'Профиль',  icon: '◉' },
];

const CUSTOMER_TABS: TabDef[] = [
  { screen: 'home',          label: 'Главная',  icon: '⌂' },
  { screen: 'my_tenders',    label: 'Заказы',   icon: '◫' },
  { screen: 'create_tender', label: 'Создать',  icon: '+' },
  { screen: 'support',       label: 'Чат',      icon: '◎' },
  { screen: 'profile',       label: 'Профиль',  icon: '◉' },
];

const BOTH_TABS: TabDef[] = [
  { screen: 'home',          label: 'Главная',  icon: '⌂' },
  { screen: 'tenders',       label: 'Биржа',    icon: '◫' },
  { screen: 'applications',  label: 'Отклики',  icon: '✉' },
  { screen: 'my_tenders',    label: 'Мои',      icon: '◉' },
  { screen: 'support',       label: 'Чат',      icon: '◎' },
];

export function Tabbar() {
  const { screen, reset } = useAppStore();
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: apiMe, retry: false });

  const role = user?.role ?? 'executor';
  const tabs = role === 'customer' ? CUSTOMER_TABS : role === 'both' ? BOTH_TABS : EXECUTOR_TABS;

  // Determine which tab is "active" — map detail screens back to their parent tab
  const activeTab = getActiveTab(screen);

  return (
    <nav className={styles.tabbar}>
      {tabs.map((tab) => (
        <button
          key={tab.screen}
          className={`${styles.item} ${activeTab === tab.screen ? styles.active : ''}`}
          onClick={() => {
            if (TAB_SCREENS.includes(tab.screen)) reset(tab.screen);
          }}
          aria-label={tab.label}
        >
          <span className={styles.icon}>{tab.icon}</span>
          <span className={styles.label}>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

function getActiveTab(screen: Screen): Screen {
  const map: Partial<Record<Screen, Screen>> = {
    tender:             'tenders',
    application:        'applications',
    support_chat:       'support',
    profile_edit:       'profile',
    tender_applicants:  'my_tenders',
    create_tender:      'create_tender',
  };
  return map[screen] ?? screen;
}
