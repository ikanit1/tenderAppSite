import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { partnersContent } from '@/shared/content/home';
import { CertificateModal } from '@/shared/ui/CertificateModal/CertificateModal';
import styles from './PartnersSection.module.css';

const sectionVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 280, damping: 22 },
  },
};

export function PartnersSection() {
  const reduceMotion = useReducedMotion();
  const [selectedCert, setSelectedCert] = useState<{ label: string; src: string } | null>(null);

  return (
    <motion.section
      className={styles.section}
      aria-labelledby="partners-heading"
      variants={reduceMotion ? undefined : sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px', amount: 0.2 }}
    >
      {partnersContent.mainPartner && (
        <div className={styles.mainPartnerBlock}>
          <motion.div
            className={styles.mainPartner}
            variants={reduceMotion ? undefined : itemVariants}
          >
            <motion.div
              className={styles.mainPartnerLogo}
              whileHover={reduceMotion ? undefined : { scale: 1.03 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <img
                src={partnersContent.mainPartner.logo}
                alt={partnersContent.mainPartner.alt}
                className={styles.mainPartnerImg}
              />
            </motion.div>
            <span className={styles.mainPartnerLabel}>Главный партнёр</span>
            <span className={styles.mainPartnerName}>{partnersContent.mainPartner.name}</span>
            {partnersContent.mainPartner.certificates?.length ? (
              <div className={styles.certificates}>
                <span className={styles.certificatesLabel}>Сертификаты:</span>
                <div className={styles.certificatesList}>
                  {partnersContent.mainPartner.certificates.map((cert) => (
                    <motion.button
                      key={cert.src}
                      type="button"
                      className={styles.certLink}
                      onClick={() => setSelectedCert({ label: cert.label, src: cert.src })}
                      whileHover={reduceMotion ? undefined : { scale: 1.05 }}
                      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    >
                      {cert.label}
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : null}
          </motion.div>
        </div>
      )}
      <div className={styles.container}>
        <motion.h2 id="partners-heading" className={styles.heading} variants={reduceMotion ? undefined : itemVariants}>
          {partnersContent.title}
        </motion.h2>
        <motion.p className={styles.subtitle} variants={reduceMotion ? undefined : itemVariants}>
          {partnersContent.subtitle}
        </motion.p>
        <motion.div className={styles.grid} variants={reduceMotion ? undefined : sectionVariants}>
          {partnersContent.logos.map((logo) => (
            <motion.div
              key={logo.alt}
              className={styles.logoWrapper}
              variants={reduceMotion ? undefined : itemVariants}
              whileHover={reduceMotion ? undefined : { scale: 1.04, y: -4 }}
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <img
                src={logo.src}
                alt={logo.alt}
                className={styles.logo}
                loading="lazy"
              />
              {logo.desc && (
                <span className={styles.logoDesc}>{logo.desc}</span>
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
      {selectedCert && (
        <CertificateModal
          isOpen={!!selectedCert}
          onClose={() => setSelectedCert(null)}
          title={`Сертификат ${selectedCert.label}`}
          src={selectedCert.src}
        />
      )}
    </motion.section>
  );
}
