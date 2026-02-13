import { useState, useRef, useEffect } from 'react';
import { sendAssistantMessage } from '@/mock/assistantApi.mock';
import { assistantGreeting } from '@/shared/content/assistant';
import { Button } from '@/shared/ui/Button/Button';
import { LeadForm } from '@/features/lead-form/LeadForm';
import { Modal } from '@/shared/ui/Modal/Modal';
import { useOpenAssistant } from '@/shared/context/OpenAssistantContext';
import styles from './AssistantWidget.module.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const { setOpenAssistant } = useOpenAssistant();
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', role: 'assistant', text: assistantGreeting },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [open, messages]);

  useEffect(() => {
    setOpenAssistant(() => () => setOpen(true));
  }, [setOpenAssistant]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const reply = await sendAssistantMessage(text);
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', text: reply },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={styles.fab}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Закрыть чат' : 'Открыть помощника'}
        aria-expanded={open}
      >
        🤖
      </button>
      {open && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <span className={styles.title}>Помощник G&R Group</span>
            <button
              type="button"
              className={styles.close}
              onClick={() => setOpen(false)}
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>
          <div className={styles.messages} ref={listRef}>
            {messages.map((m) => (
              <div
                key={m.id}
                className={m.role === 'user' ? styles.msgUser : styles.msgBot}
              >
                {m.text}
              </div>
            ))}
            {loading && <div className={styles.msgBot}>...</div>}
          </div>
          <div className={styles.footer}>
            <input
              type="text"
              className={styles.input}
              placeholder="Напишите сообщение..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              disabled={loading}
            />
            <Button variant="primary" size="sm" onClick={send} disabled={loading}>
              Отправить
            </Button>
            <button
              type="button"
              className={styles.formLink}
              onClick={() => setShowForm(true)}
            >
              Оформить заявку
            </button>
          </div>
        </div>
      )}

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Оформить заявку"
      >
        <LeadForm onSuccess={() => setShowForm(false)} />
      </Modal>
    </>
  );
}
