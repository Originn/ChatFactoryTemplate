import React from 'react';

interface TooltipProps {
  message: string;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ message, children }) => {
  return (
    <div className="tooltip-container" style={{ position: 'relative', display: 'inline-block' }}>
        {children}
        <div className="tooltip-content">
            {message}
        </div>
    </div>
  );
};

export default Tooltip;
