interface DonutProgressIndicatorProps {
    progress: number; // This specifies that progress should be a number
  }

const DonutProgressIndicator: React.FC<DonutProgressIndicatorProps> = ({ progress }) => {
    const radius = 18; // Radius of the inner circle
    const circumference = 2 * Math.PI * radius;
  
    // Calculate the stroke dash offset
    const strokeDashoffset = ((100 - progress) / 100) * circumference;
  
    return (
      <svg width="25" height="25" viewBox="0 0 50 50">
        <circle
          cx="25"
          cy="25"
          r={radius}
          fill="transparent"
          stroke="#eee"
          strokeWidth="4"
        />
        <circle
          cx="25"
          cy="25"
          r={radius}
          fill="transparent"
          stroke="#007bff" // You can use your own color here
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 25 25)"
        />
        {/* Optional: Text in the center */}
        <text
          x="50%"
          y="50%"
          dy=".3em"
          textAnchor="middle"
        >
          {`${Math.round(progress)}%`}
        </text>
      </svg>
    );
  };

  export default DonutProgressIndicator;