import { useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { contactsContent } from '@/shared/content/contacts';
import { servicesList } from '@/shared/content/services';
import { LeadForm } from '@/features/lead-form/LeadForm';
import styles from './ContactSection.module.css';

const sectionVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 22 },
  },
};

interface ContactSectionProps {
  fullPage?: boolean;
}

export function ContactSection({ fullPage: _fullPage }: ContactSectionProps) {
  const { phone, email, address, schedule, whatsapp, telegram } = contactsContent;
  const [searchParams] = useSearchParams();
  const serviceId = searchParams.get('service');
  const service = serviceId ? servicesList.find((s) => s.id === serviceId) : null;
  const defaultMessage = service ? `Интересует: ${service.title}` : undefined;
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className={styles.section}
      id="contact"
      aria-labelledby="contact-heading"
      variants={reduceMotion ? undefined : sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '0px', amount: 0.05 }}
    >
      <div className={styles.container}>
        <motion.h2 id="contact-heading" className={styles.heading} variants={reduceMotion ? undefined : itemVariants}>
          Свяжитесь с нами
        </motion.h2>
        <motion.p className={styles.subtitle} variants={reduceMotion ? undefined : itemVariants}>
          Получите бесплатную консультацию и расчёт стоимости
        </motion.p>
        <motion.div className={styles.grid} variants={reduceMotion ? undefined : sectionVariants}>
          <motion.div className={styles.info} variants={reduceMotion ? undefined : itemVariants}>
            <div className={styles.block}>
              <h3 className={styles.label}>Телефон</h3>
              <a href={`tel:${phone.replace(/\s/g, '')}`} className={styles.value}>
                {phone}
              </a>
            </div>
            <div className={styles.block}>
              <h3 className={styles.label}>Email</h3>
              <a href={`mailto:${email}`} className={styles.value}>
                {email}
              </a>
            </div>
            <div className={styles.block}>
              <h3 className={styles.label}>Адрес</h3>
              <p className={styles.value}>{address}</p>
            </div>
            <div className={styles.block}>
              <h3 className={styles.label}>Режим работы</h3>
              <p className={styles.value}>{schedule}</p>
            </div>
            <div className={styles.social}>
              <a href={whatsapp.href} target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                WhatsApp
              </a>
              <a href={telegram.href} target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                Telegram
              </a>
            </div>
          </motion.div>
          <motion.div className={styles.formWrap} variants={reduceMotion ? undefined : itemVariants}>
            <LeadForm key={serviceId ?? 'default'} defaultMessage={defaultMessage} />
          </motion.div>
        </motion.div>
      </div>
    </motion.section>
  );
}
