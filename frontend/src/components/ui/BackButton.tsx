'use client';
import { useRouter } from 'next/navigation';
import styles from './BackButton.module.css';

export function BackButton({ href, label = 'Back' }: { href?: string; label?: string }) {
  const router = useRouter();
  return (
    <button className={styles.btn} onClick={() => href ? router.push(href) : router.back()}>
      <ArrowLeft />
      {label}
    </button>
  );
}

function ArrowLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M8.5 2.5 4 7l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
