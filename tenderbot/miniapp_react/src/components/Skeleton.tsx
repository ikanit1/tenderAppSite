import styles from './Skeleton.module.css';

export function SkeletonCard() {
  return (
    <div className={styles.card}>
      <div className={`${styles.line} ${styles.title} skeleton`} />
      <div className={`${styles.line} ${styles.meta} skeleton`} />
      <div className={`${styles.line} ${styles.desc} skeleton`} />
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </>
  );
}
