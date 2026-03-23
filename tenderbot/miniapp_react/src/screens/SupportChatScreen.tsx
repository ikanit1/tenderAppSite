import { useRef, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiSupportTicketDetail, apiSendMessage, apiCloseTicket } from '../api';
import { Button } from '../components/Button';
import { SkeletonList } from '../components/Skeleton';
import { TG, hapticNotify } from '../telegram';
import styles from './SupportChatScreen.module.css';

interface Props {
  ticketId: number;
}

function imageUrl(url: string | null): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return (url.startsWith('/') ? '' : '/') + url;
}

export function SupportChatScreen({ ticketId }: Props) {
  const qc = useQueryClient();
  const messagesRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);

  const { data: ticket, isLoading, error } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => apiSupportTicketDetail(ticketId),
    refetchInterval: 5_000,
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [ticket?.messages?.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = textRef.current?.value.trim() ?? '';
    const file = fileRef.current?.files?.[0];
    if (!text && !file) {
      TG?.showAlert('Введите сообщение или приложите фото.');
      return;
    }
    setSending(true);
    try {
      let payload: { text?: string; image_base64?: string } = { text };
      if (file) {
        const dataUrl = await readFileAsDataUrl(file);
        payload = { ...payload, image_base64: dataUrl };
      }
      await apiSendMessage(ticketId, payload);
      if (textRef.current) textRef.current.value = '';
      if (fileRef.current) fileRef.current.value = '';
      await qc.invalidateQueries({ queryKey: ['ticket', ticketId] });
      await qc.invalidateQueries({ queryKey: ['support-tickets'] });
    } catch (e) {
      hapticNotify('error');
      TG?.showAlert((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function handleClose() {
    TG?.showConfirm('Закрыть обращение?', async (ok) => {
      if (!ok) return;
      setClosing(true);
      try {
        await apiCloseTicket(ticketId);
        await qc.invalidateQueries({ queryKey: ['ticket', ticketId] });
        await qc.invalidateQueries({ queryKey: ['support-tickets'] });
      } catch (e) {
        TG?.showAlert((e as Error).message);
      } finally {
        setClosing(false);
      }
    });
  }

  if (isLoading) return <div className={styles.screen}><SkeletonList count={2} /></div>;

  if (error || !ticket) {
    return (
      <div className={styles.screen}>
        <div className={styles.errorMsg}>{error ? (error as Error).message : 'Обращение не найдено'}</div>
      </div>
    );
  }

  const closed = ticket.status === 'closed';

  return (
    <div className={styles.screen}>
      <div className={styles.messages} ref={messagesRef}>
        {ticket.messages.length === 0 && (
          <p className={styles.emptyChat}>Напишите первое сообщение</p>
        )}
        {ticket.messages.map((m) => {
          const isUser = m.author === 'user';
          const text = m.text === '(изображение)' ? '' : m.text;
          return (
            <div key={m.id} className={`${styles.msg} ${isUser ? styles.user : styles.admin}`}>
              <span className={styles.msgAuthor}>{isUser ? 'Вы' : 'Поддержка'}</span>
              {m.image_url && (
                <img className={styles.msgImg} src={imageUrl(m.image_url)} alt="Фото" loading="lazy" />
              )}
              {text && <p className={styles.msgText}>{text}</p>}
              <span className={styles.msgTime}>
                {m.created_at ? new Date(m.created_at).toLocaleString('ru-RU') : ''}
              </span>
            </div>
          );
        })}
      </div>

      {closed ? (
        <p className={styles.closedNote}>Обращение закрыто</p>
      ) : (
        <div className={styles.inputArea}>
          <form onSubmit={handleSend} className={styles.form}>
            <textarea
              ref={textRef}
              className={styles.textarea}
              placeholder="Сообщение..."
              rows={2}
              maxLength={2000}
            />
            <div className={styles.formActions}>
              <label className={styles.photoBtn}>
                📷
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                />
              </label>
              <Button type="submit" size="sm" loading={sending}>
                Отправить
              </Button>
            </div>
          </form>
          <Button variant="ghost" size="sm" onClick={handleClose} loading={closing} fullWidth>
            Завершить обращение
          </Button>
        </div>
      )}
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
}
