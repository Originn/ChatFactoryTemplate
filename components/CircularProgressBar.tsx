import React from 'react';

interface CircularProgressBarProps {
  progress: number;
}

const CircularProgressBar: React.FC<CircularProgressBarProps> = ({ progress }) => {
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <svg className="circular-progress" width="40" height="40" viewBox="0 0 40 40">
      <circle
        className="circular-progress__background"
        cx="20"
        cy="20"
        r={radius}
        strokeWidth="4"
        fill="none"
        stroke="#e0e0e0"
      />
      <circle
        className="circular-progress__bar"
        cx="20"
        cy="20"
        r={radius}
        strokeWidth="4"
        fill="none"
        stroke="#4caf50"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        transform="rotate(-90 20 20)"
      />
      <text x="20" y="20" textAnchor="middle" dy=".3em" fontSize="10">
        {`${Math.round(progress)}%`}
      </text>
    </svg>
  );
};

export default CircularProgressBar;