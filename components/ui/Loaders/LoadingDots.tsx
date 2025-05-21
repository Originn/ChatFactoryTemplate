import styles from '@/styles/loading-dots.module.css';

interface LoadingDotsProps {
  color?: string;
  style?: 'small' | 'large';
}

const LoadingDots: React.FC<LoadingDotsProps> = ({
  color = '#000',
  style = 'small',
}) => {
  return (
    <span className={style === 'small' ? styles.loading2 : styles.loading}>
      <span style={{ backgroundColor: color }} />
      <span style={{ backgroundColor: color }} />
      <span style={{ backgroundColor: color }} />
    </span>
  );
};

export default LoadingDots;
