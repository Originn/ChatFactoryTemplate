// components/Tooltip.tsx
import React from 'react';

interface TooltipProps {
  message: string;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ message, children }) => {
  return (
    <div className="tooltip-container" style={{ position: 'relative', display: 'inline-block' }}>
        {children}
        <div className="tooltip-content" style={{ left: '30px' }}> {/* Add left offset here */}
            {message}
        </div>
    </div>
  );
};

export default Tooltip;