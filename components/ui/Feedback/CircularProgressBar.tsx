import React, { useMemo } from 'react';

interface CircularProgressBarProps {
  progress: number;
  radius?: number;
  strokeWidth?: number;
  backgroundColor?: string;
  progressColor?: string;
  showText?: boolean;
  textSize?: number;
}

const CircularProgressBar: React.FC<CircularProgressBarProps> = ({
  progress,
  radius = 15,
  strokeWidth = 4,
  backgroundColor = '#e0e0e0',
  progressColor = '#4caf50',
  showText = true,
  textSize = 10,
}) => {
  // Calculate the circumference and stroke dash offset based on progress
  const circumference = useMemo(() => 2 * Math.PI * radius, [radius]);
  const strokeDashoffset = useMemo(
    () => circumference - (Math.min(Math.max(progress, 0), 100) / 100) * circumference,
    [circumference, progress]
  );

  // Size of the SVG viewBox
  const size = radius * 2 + strokeWidth;

  return (
    <svg 
      className="circular-progress" 
      width={size} 
      height={size} 
      viewBox={`0 0 ${size} ${size}`}
      style={{ overflow: 'visible' }}
    >
      {/* Background circle */}
      <circle
        className="circular-progress__background"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        fill="none"
        stroke={backgroundColor}
      />
      
      {/* Progress circle */}
      <circle
        className="circular-progress__bar"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        fill="none"
        stroke={progressColor}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      
      {/* Percentage text */}
      {showText && (
        <text 
          x={size / 2} 
          y={size / 2} 
          textAnchor="middle" 
          dy=".3em" 
          fontSize={textSize}
          fill="#000"
        >
          {`${Math.round(progress)}%`}
        </text>
      )}
    </svg>
  );
};

export default CircularProgressBar;