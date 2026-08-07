import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import styles from './MarkdownRenderer.module.css';

interface Props {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: Props) {
  return (
    <div className={`${styles.markdown} ${className ?? ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{content}</ReactMarkdown>
    </div>
  );
}
