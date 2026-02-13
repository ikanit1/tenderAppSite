import { useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import styles from './CertificateModal.module.css';

interface CertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  src: string;
}

const overlayVariants = {
  hidden: { opacity: 0, backgroundColor: 'rgba(10, 0, 31, 0)' },
  visible: { opacity: 1, backgroundColor: 'rgba(10, 0, 31, 0.85)' },
  exit: { opacity: 0, backgroundColor: 'rgba(10, 0, 31, 0)' },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: { duration: 0.2 },
  },
};

const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;

export function CertificateModal({ isOpen, onClose, title, src }: CertificateModalProps) {
  const isImage = IMAGE_EXT.test(src);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={`${styles.overlay} ${isImage ? styles.overlayImage : ''}`}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cert-modal-title"
          variants={reduceMotion ? undefined : overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className={`${styles.modal} ${isImage ? styles.modalImage : ''}`}
            onClick={(e) => e.stopPropagation()}
            variants={reduceMotion ? undefined : modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className={styles.header}>
              <h2 id="cert-modal-title" className={styles.title}>
                {title}
              </h2>
              <motion.button
                type="button"
                className={styles.close}
                onClick={onClose}
                aria-label="Закрыть"
                whileHover={reduceMotion ? undefined : { scale: 1.1 }}
                whileTap={reduceMotion ? undefined : { scale: 0.95 }}
              >
                ×
              </motion.button>
            </div>
            <div className={`${styles.body} ${isImage ? styles.bodyImage : ''}`}>
              {isImage ? (
                <div className={styles.imageFrame}>
                  <img src={src} alt={title} className={styles.certImage} />
                </div>
              ) : (
                <iframe src={`${src}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`} title={title} className={styles.pdfFrame} />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
