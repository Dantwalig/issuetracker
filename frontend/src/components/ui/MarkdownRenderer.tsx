import ReactMarkdown from 'react-markdown';
import styles from './MarkdownRenderer.module.css';

interface Props {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: Props) {
  return (
    <div className={`${styles.markdown} ${className ?? ''}`}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
