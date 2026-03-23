import { useRef, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiProfile, apiUpdateProfile, apiSkills, apiCities } from '../api';
import { useAppStore } from '../store';
import { Button } from '../components/Button';
import { SkeletonList } from '../components/Skeleton';
import { TG, hapticNotify } from '../telegram';
import styles from './ProfileEditScreen.module.css';

export function ProfileEditScreen() {
  const { back } = useAppStore();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  const { data: user, isLoading } = useQuery({ queryKey: ['profile'], queryFn: apiProfile });
  const { data: skillsData } = useQuery({ queryKey: ['skills'], queryFn: apiSkills });
  const { data: citiesData } = useQuery({ queryKey: ['cities'], queryFn: apiCities });

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (user?.skills) setSelectedSkills(user.skills);
  }, [user]);

  if (isLoading || !user) return <div className={styles.screen}><SkeletonList count={3} /></div>;

  const skillOptions = skillsData?.skills ?? [];
  const cities = citiesData?.cities ?? (user.city ? [user.city] : []);

  function toggleSkill(s: string) {
    setSelectedSkills((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const full_name = nameRef.current?.value.trim() ?? '';
    const phone = phoneRef.current?.value.trim() ?? '';
    const city = cityRef.current?.value ?? '';

    if (!full_name || !city) {
      TG?.showAlert('Заполните ФИО и город.');
      return;
    }

    setSaving(true);
    try {
      await apiUpdateProfile({ full_name, phone, city, skills: selectedSkills });
      hapticNotify('success');
      await qc.invalidateQueries({ queryKey: ['profile'] });
      await qc.invalidateQueries({ queryKey: ['me'] });
      back();
    } catch (err) {
      hapticNotify('error');
      TG?.showAlert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.screen}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.group}>
          <label className={styles.label}>ФИО</label>
          <input ref={nameRef} className={styles.input} type="text" defaultValue={user.full_name} maxLength={256} required />
        </div>

        <div className={styles.group}>
          <label className={styles.label}>Город</label>
          <select ref={cityRef} className={styles.input} defaultValue={user.city}>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className={styles.group}>
          <label className={styles.label}>Телефон</label>
          <input ref={phoneRef} className={styles.input} type="tel" defaultValue={user.phone} maxLength={64} />
        </div>

        {skillOptions.length > 0 && (
          <div className={styles.group}>
            <label className={styles.label}>Навыки</label>
            <div className={styles.chips}>
              {skillOptions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`${styles.chip} ${selectedSkills.includes(s) ? styles.chipActive : ''}`}
                  onClick={() => toggleSkill(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={styles.btnRow}>
          <Button type="submit" fullWidth loading={saving}>Сохранить</Button>
          <Button type="button" variant="ghost" fullWidth onClick={back}>Отмена</Button>
        </div>
      </form>
    </div>
  );
}
