import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TG, hapticNotify } from './telegram';
import { apiMe } from './api';
import { useAppStore } from './store';
import { Header } from './components/Header';
import { Tabbar } from './components/Tabbar';
import { HomeScreen } from './screens/HomeScreen';
import { TendersScreen } from './screens/TendersScreen';
import { TenderDetailScreen } from './screens/TenderDetailScreen';
import { ApplicationsScreen } from './screens/ApplicationsScreen';
import { ApplicationDetailScreen } from './screens/ApplicationDetailScreen';
import { SupportScreen } from './screens/SupportScreen';
import { SupportChatScreen } from './screens/SupportChatScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { ProfileEditScreen } from './screens/ProfileEditScreen';
import { MyTendersScreen } from './screens/MyTendersScreen';
import { CreateTenderScreen } from './screens/CreateTenderScreen';
import { TenderApplicantsScreen } from './screens/TenderApplicantsScreen';
import styles from './App.module.css';

export function App() {
  const { screen, params, back, setUser, canGoBack } = useAppStore();

  const { data: user, error, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: apiMe,
    retry: false,
  });

  useEffect(() => {
    if (!TG) return;
    TG.ready();
    TG.expand();
  }, []);

  useEffect(() => {
    if (user) setUser(user);
  }, [user, setUser]);

  // Sync Telegram BackButton with navigation stack
  useEffect(() => {
    if (!TG) return;
    const BB = TG.BackButton;
    const fn = () => back();
    if (canGoBack()) {
      BB.show();
      BB.onClick(fn);
    } else {
      BB.hide();
    }
    return () => BB.offClick(fn);
  }, [screen, canGoBack, back]);

  if (!TG) {
    return (
      <div className={styles.errorScreen}>
        <div className={styles.errorBox}>
          <p>Откройте приложение из меню бота (☰) или по кнопке в чате.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.loader}>
        <div className={styles.spinner} />
        <p>Загрузка...</p>
      </div>
    );
  }

  if (error) {
    hapticNotify('error');
    return (
      <div className={styles.errorScreen}>
        <div className={styles.errorBox}>
          <p>{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  function renderScreen() {
    switch (screen) {
      case 'home':            return <HomeScreen />;
      case 'tenders':         return <TendersScreen />;
      case 'tender':          return <TenderDetailScreen tenderId={params.tenderId!} />;
      case 'applications':    return <ApplicationsScreen />;
      case 'application':     return <ApplicationDetailScreen applicationId={params.applicationId!} />;
      case 'support':         return <SupportScreen />;
      case 'support_chat':    return <SupportChatScreen ticketId={params.ticketId!} />;
      case 'profile':         return <ProfileScreen />;
      case 'profile_edit':    return <ProfileEditScreen />;
      case 'my_tenders':      return <MyTendersScreen />;
      case 'create_tender':   return <CreateTenderScreen />;
      case 'tender_applicants': return <TenderApplicantsScreen tenderId={params.tenderId!} />;
      default:                return <HomeScreen />;
    }
  }

  return (
    <div className={styles.app}>
      <Header />
      <main className={styles.main}>
        <div className="screen-enter" key={screen}>
          {renderScreen()}
        </div>
      </main>
      <Tabbar />
    </div>
  );
}
