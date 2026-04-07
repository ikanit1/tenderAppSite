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
    transition: { type: 'spring' as const, stiffness: 280, damping: 22 },
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
      viewport={{ once: true, margin: '0px', amount: 0.05 }}
    >
      {partnersContent.mainPartners?.length ? (
        <div className={styles.mainPartnerBlock}>
          <div className={styles.mainPartnersGrid}>
            {partnersContent.mainPartners.map((partner) => (
              <motion.div
                key={partner.name}
                className={styles.mainPartner}
                variants={reduceMotion ? undefined : itemVariants}
              >
                <motion.div
                  className={styles.mainPartnerLogo}
                  whileHover={reduceMotion ? undefined : { scale: 1.03 }}
                  transition={{ type: 'spring' as const, stiffness: 400, damping: 25 }}
                >
                  {partner.url ? (
                    <a href={partner.url} target="_blank" rel="noopener noreferrer">
                      <img src={partner.logo} alt={partner.alt} className={styles.mainPartnerImg} />
                    </a>
                  ) : (
                    <img src={partner.logo} alt={partner.alt} className={styles.mainPartnerImg} />
                  )}
                </motion.div>
                <span className={styles.mainPartnerLabel}>{partner.label}</span>
                <span className={styles.mainPartnerName}>{partner.name}</span>
                {partner.certificates?.length ? (
                  <div className={styles.certificates}>
                    <span className={styles.certificatesLabel}>Сертификаты:</span>
                    <div className={styles.certificatesList}>
                      {partner.certificates.map((cert) => (
                        <motion.button
                          key={cert.src}
                          type="button"
                          className={styles.certLink}
                          onClick={() => setSelectedCert({ label: cert.label, src: cert.src })}
                          whileHover={reduceMotion ? undefined : { scale: 1.05 }}
                          whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                          transition={{ type: 'spring' as const, stiffness: 400, damping: 25 }}
                        >
                          {cert.label}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {partner.tags?.length ? (
                  <div className={styles.certificates}>
                    <span className={styles.certificatesLabel}>Направления:</span>
                    <div className={styles.certificatesList}>
                      {partner.tags.map((tag) => (
                        <span key={tag.label} className={styles.tagChip}>
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </motion.div>
            ))}
          </div>
        </div>
      ) : null}
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
              transition={{ type: 'spring' as const, stiffness: 400, damping: 25 }}
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
