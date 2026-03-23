import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { apiCreateTender, apiSkills, apiCities } from '../api';
import { useAppStore } from '../store';
import { Button } from '../components/Button';
import { TG, hapticNotify } from '../telegram';
import styles from './ProfileEditScreen.module.css';

export function CreateTenderScreen() {
  const { navigate, back } = useAppStore();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const { data: skillsData } = useQuery({ queryKey: ['skills'], queryFn: apiSkills });
  const { data: citiesData } = useQuery({ queryKey: ['cities'], queryFn: apiCities });

  const titleRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLSelectElement>(null);
  const budgetRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const deadlineRef = useRef<HTMLInputElement>(null);

  const skillOptions = skillsData?.skills ?? [];
  const cities = citiesData?.cities ?? [];

  function toggleCategory(s: string) {
    setSelectedCategories((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const title = titleRef.current?.value.trim() ?? '';
    const city = cityRef.current?.value ?? '';
    const budget = budgetRef.current?.value.trim() || undefined;
    const description = descRef.current?.value.trim() ?? '';
    const deadline = deadlineRef.current?.value || undefined;

    if (!title || !city || !description) {
      TG?.showAlert('Заполните заголовок, город и описание.');
      return;
    }
    if (selectedCategories.length === 0) {
      TG?.showAlert('Выберите хотя бы одну категорию.');
      return;
    }

    setSaving(true);
    try {
      const tender = await apiCreateTender({
        title,
        categories: selectedCategories,
        city,
        budget,
        description,
        deadline,
      });
      hapticNotify('success');
      await qc.invalidateQueries({ queryKey: ['my-tenders'] });
      navigate('tender_applicants', { tenderId: tender.id });
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
          <label className={styles.label}>Заголовок</label>
          <input ref={titleRef} className={styles.input} type="text" placeholder="Название заказа" maxLength={256} required />
        </div>

        <div className={styles.group}>
          <label className={styles.label}>Город</label>
          <select ref={cityRef} className={styles.input}>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {skillOptions.length > 0 && (
          <div className={styles.group}>
            <label className={styles.label}>Категория (навыки)</label>
            <div className={styles.chips}>
              {skillOptions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`${styles.chip} ${selectedCategories.includes(s) ? styles.chipActive : ''}`}
                  onClick={() => toggleCategory(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={styles.group}>
          <label className={styles.label}>Бюджет (необязательно)</label>
          <input ref={budgetRef} className={styles.input} type="text" placeholder="Например: 50 000 тг" maxLength={128} />
        </div>

        <div className={styles.group}>
          <label className={styles.label}>Дедлайн (необязательно)</label>
          <input ref={deadlineRef} className={styles.input} type="datetime-local" />
        </div>

        <div className={styles.group}>
          <label className={styles.label}>Описание</label>
          <textarea
            ref={descRef}
            className={styles.input}
            style={{ resize: 'vertical', minHeight: 80 }}
            placeholder="Подробно опишите задачу..."
            maxLength={4000}
            required
          />
        </div>

        <div className={styles.btnRow}>
          <Button type="submit" fullWidth loading={saving}>Разместить заказ</Button>
          <Button type="button" variant="ghost" fullWidth onClick={back}>Отмена</Button>
        </div>
      </form>
    </div>
  );
}
