import { useState, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import styles from './CctvCalculatorSection.module.css';

/* ─── animation variants ─── */
const sectionVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const headerVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 22 } },
};

const cardVariants = {
    hidden: { opacity: 0, y: 28 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 22 } },
};

const gridVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

/* ─── calculation helpers ───
 * Формула камер: N = (Этажи × Подъезды) + (1 × Подъезды) + (Камеры_у_входа × Подъезды)
 *   = по 1 камере на этаж + по 2 на первый этаж (доп. 1 на подъезд) + камеры у входа на подъезд.
 * NVR/коммутатор: до 16 камер → 16-канальный; 17–32 → 32-канальный; 33+ → 64-канальный.
 * Кабель: ~100 м на камеру. HDD: 2 ТБ на каждые 8 камер (архив ~2 недели).
 */

/** 16 / 32 / 64 каналов по количеству камер */
function pickChannelSize(n: number): number {
    if (n <= 16) return 16;
    if (n <= 32) return 32;
    return 64;
}

/** Количество HDD 2 ТБ: 1 диск на каждые 8 камер (архив ~2 недели) */
function hddCount(cameras: number): number {
    return Math.max(1, Math.ceil(cameras / 8));
}

interface CalcResult {
    cameras: number;
    cableMeters: number;
    dvrChannels: number;
    switchPorts: number;
    hddQty: number;
    hddTotalTb: number;
}

function calculate(floors: number, entrances: number, entranceCams: number): CalcResult | null {
    if (floors <= 0 || entrances <= 0) return null;

    // По 1 камере на каждый этаж каждого подъезда
    // + 1 дополнительная камера на 1-й этаж каждого подъезда
    // + камеры у входа на каждый подъезд
    const cameras = floors * entrances + 1 * entrances + entranceCams * entrances;
    const cableMeters = cameras * 100;
    const dvrChannels = pickChannelSize(cameras);
    const switchPorts = pickChannelSize(cameras); // PoE switch ports ≥ cameras
    const hdd = hddCount(cameras);

    return {
        cameras,
        cableMeters,
        dvrChannels,
        switchPorts,
        hddQty: hdd,
        hddTotalTb: hdd * 2,
    };
}

/* ─── component ─── */

export function CctvCalculatorSection() {
    const reduceMotion = useReducedMotion();

    const [floors, setFloors] = useState<number>(5);
    const [entrances, setEntrances] = useState<number>(4);
    const [entranceCams, setEntranceCams] = useState<number>(2);

    const result = useMemo(() => calculate(floors, entrances, entranceCams), [floors, entrances, entranceCams]);

    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

    return (
        <motion.section
            className={styles.section}
            aria-labelledby="calculator-heading"
            variants={reduceMotion ? undefined : sectionVariants}
            initial="visible"
            animate="visible"
        >
            <motion.div className={styles.container} variants={reduceMotion ? undefined : sectionVariants} initial="visible" animate="visible">
                <motion.h2 id="calculator-heading" className={styles.heading} variants={reduceMotion ? undefined : headerVariants} initial="visible" animate="visible">
                    Калькулятор видеонаблюдения
                </motion.h2>
                <motion.p className={styles.subtitle} variants={reduceMotion ? undefined : headerVariants} initial="visible" animate="visible">
                    Рассчитайте необходимое оборудование для установки системы видеонаблюдения и домофонии
                </motion.p>

                {/* ─── Input Card ─── */}
                <motion.div className={styles.formCard} variants={reduceMotion ? undefined : cardVariants} initial="visible" animate="visible">
                    <div className={styles.formTitle}>
                        <span className={styles.formTitleIcon}>🏢</span>
                        Параметры объекта
                    </div>

                    <div className={styles.inputsGrid}>
                        {/* Этажи */}
                        <div className={styles.inputGroup}>
                            <label htmlFor="calc-floors" className={styles.inputLabel}>
                                Количество этажей
                            </label>
                            <div className={styles.inputWrapper}>
                                <input
                                    id="calc-floors"
                                    type="number"
                                    className={styles.input}
                                    value={floors}
                                    min={1}
                                    max={100}
                                    onChange={(e) => setFloors(clamp(Number(e.target.value) || 0, 0, 100))}
                                    placeholder="5"
                                />
                            </div>
                            <span className={styles.inputHint}>1 камера на каждый этаж + доп. камера на 1-й этаж</span>
                        </div>

                        {/* Подъезды */}
                        <div className={styles.inputGroup}>
                            <label htmlFor="calc-entrances" className={styles.inputLabel}>
                                Количество подъездов
                            </label>
                            <div className={styles.inputWrapper}>
                                <input
                                    id="calc-entrances"
                                    type="number"
                                    className={styles.input}
                                    value={entrances}
                                    min={1}
                                    max={50}
                                    onChange={(e) => setEntrances(clamp(Number(e.target.value) || 0, 0, 50))}
                                    placeholder="4"
                                />
                            </div>
                            <span className={styles.inputHint}>Расчёт ведётся для каждого подъезда</span>
                        </div>

                        {/* Камеры у входа */}
                        <div className={styles.inputGroup}>
                            <label htmlFor="calc-entrance-cams" className={styles.inputLabel}>
                                Камеры у входа (на подъезд)
                            </label>
                            <div className={styles.inputWrapper}>
                                <input
                                    id="calc-entrance-cams"
                                    type="number"
                                    className={styles.input}
                                    value={entranceCams}
                                    min={0}
                                    max={10}
                                    onChange={(e) => setEntranceCams(clamp(Number(e.target.value) || 0, 0, 10))}
                                    placeholder="2"
                                />
                            </div>
                            <span className={styles.inputHint}>Камеры входной группы на каждый подъезд</span>
                        </div>
                    </div>
                </motion.div>

                {/* ─── Results ─── */}
                {result ? (
                    <>
                        <motion.div className={styles.resultsTitle} variants={reduceMotion ? undefined : headerVariants} initial="visible" animate="visible">
                            📋 Результат расчёта
                        </motion.div>

                        <motion.div className={styles.resultsGrid} variants={reduceMotion ? undefined : gridVariants} initial="visible" animate="visible">
                            {/* Cameras */}
                            <motion.div
                                className={styles.resultCard}
                                variants={reduceMotion ? undefined : cardVariants}
                                whileHover={reduceMotion ? undefined : { y: -4, scale: 1.02 }}
                                transition={{ type: 'spring' as const, stiffness: 400, damping: 25 }}
                            >
                                <div className={`${styles.resultIcon} ${styles.resultIconCamera}`}>📹</div>
                                <div className={styles.resultLabel}>IP-камеры</div>
                                <div className={styles.resultValue}>{result.cameras} шт.</div>
                                <div className={styles.resultDetail}>
                                    ({floors}×{entrances}) + (1×{entrances}) 1-й эт. + ({entranceCams}×{entrances}) у входа
                                </div>
                            </motion.div>

                            {/* Cable */}
                            <motion.div
                                className={styles.resultCard}
                                variants={reduceMotion ? undefined : cardVariants}
                                whileHover={reduceMotion ? undefined : { y: -4, scale: 1.02 }}
                                transition={{ type: 'spring' as const, stiffness: 400, damping: 25 }}
                            >
                                <div className={`${styles.resultIcon} ${styles.resultIconCable}`}>🔌</div>
                                <div className={styles.resultLabel}>Кабель UTP</div>
                                <div className={styles.resultValue}>{result.cableMeters.toLocaleString('ru-RU')} м</div>
                                <div className={styles.resultDetail}>~100 м на камеру × {result.cameras} камер</div>
                            </motion.div>

                            {/* DVR */}
                            <motion.div
                                className={styles.resultCard}
                                variants={reduceMotion ? undefined : cardVariants}
                                whileHover={reduceMotion ? undefined : { y: -4, scale: 1.02 }}
                                transition={{ type: 'spring' as const, stiffness: 400, damping: 25 }}
                            >
                                <div className={`${styles.resultIcon} ${styles.resultIconDvr}`}>🖥️</div>
                                <div className={styles.resultLabel}>Видеорегистратор (NVR)</div>
                                <div className={styles.resultValue}>{result.dvrChannels}-канальный</div>
                                <div className={styles.resultDetail}>Для {result.cameras} камер</div>
                            </motion.div>

                            {/* PoE Switch */}
                            <motion.div
                                className={styles.resultCard}
                                variants={reduceMotion ? undefined : cardVariants}
                                whileHover={reduceMotion ? undefined : { y: -4, scale: 1.02 }}
                                transition={{ type: 'spring' as const, stiffness: 400, damping: 25 }}
                            >
                                <div className={`${styles.resultIcon} ${styles.resultIconSwitch}`}>🔀</div>
                                <div className={styles.resultLabel}>Коммутатор PoE</div>
                                <div className={styles.resultValue}>{result.switchPorts}-портовый</div>
                                <div className={styles.resultDetail}>Портов ≥ {result.cameras} камер + uplink к NVR</div>
                            </motion.div>

                            {/* HDD */}
                            <motion.div
                                className={styles.resultCard}
                                variants={reduceMotion ? undefined : cardVariants}
                                whileHover={reduceMotion ? undefined : { y: -4, scale: 1.02 }}
                                transition={{ type: 'spring' as const, stiffness: 400, damping: 25 }}
                            >
                                <div className={`${styles.resultIcon} ${styles.resultIconHdd}`}>💾</div>
                                <div className={styles.resultLabel}>Жёсткие диски</div>
                                <div className={styles.resultValue}>{result.hddQty} × 2 ТБ</div>
                                <div className={styles.resultDetail}>2 ТБ на каждые 8 камер, итого {result.hddTotalTb} ТБ (архив ~2 нед.)</div>
                            </motion.div>

                            {/* Entrance panels */}
                            <motion.div
                                className={styles.resultCard}
                                variants={reduceMotion ? undefined : cardVariants}
                                whileHover={reduceMotion ? undefined : { y: -4, scale: 1.02 }}
                                transition={{ type: 'spring' as const, stiffness: 400, damping: 25 }}
                            >
                                <div className={`${styles.resultIcon} ${styles.resultIconEntrance}`}>🚪</div>
                                <div className={styles.resultLabel}>Домофонные панели</div>
                                <div className={styles.resultValue}>{entrances} шт.</div>
                                <div className={styles.resultDetail}>Одна вызывная панель на подъезд</div>
                            </motion.div>
                        </motion.div>

                        {/* ─── Summary ─── */}
                        <motion.div className={styles.summaryRow} variants={reduceMotion ? undefined : cardVariants} initial="visible" animate="visible">
                            <span className={styles.summaryItem}>
                                <span className={`${styles.summaryDot} ${styles.dotBlue}`} />
                                Камер: {result.cameras}
                            </span>
                            <span className={styles.summaryItem}>
                                <span className={`${styles.summaryDot} ${styles.dotGreen}`} />
                                Кабель: {result.cableMeters.toLocaleString('ru-RU')} м
                            </span>
                            <span className={styles.summaryItem}>
                                <span className={`${styles.summaryDot} ${styles.dotYellow}`} />
                                NVR: {result.dvrChannels}-кан.
                            </span>
                            <span className={styles.summaryItem}>
                                <span className={`${styles.summaryDot} ${styles.dotPink}`} />
                                PoE: {result.switchPorts} порт.
                            </span>
                            <span className={styles.summaryItem}>
                                <span className={`${styles.summaryDot} ${styles.dotPurple}`} />
                                HDD: {result.hddTotalTb} ТБ
                            </span>
                        </motion.div>
                    </>
                ) : (
                    <motion.div className={styles.emptyState} variants={reduceMotion ? undefined : cardVariants} initial="visible" animate="visible">
                        <div className={styles.emptyStateIcon}>📐</div>
                        Введите параметры объекта, чтобы рассчитать оборудование
                    </motion.div>
                )}
            </motion.div>
        </motion.section>
    );
}
