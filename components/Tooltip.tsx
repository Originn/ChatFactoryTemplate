import React, { useState } from 'react';

interface TooltipProps {
  message: string;
  children: React.ReactNode;
  hideOnClick?: boolean;
}

const Tooltip: React.FC<TooltipProps> = ({ message, children, hideOnClick = false }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isClicked, setIsClicked] = useState(false);

  const handleMouseEnter = () => {
    if (!isClicked) {
      setIsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    setIsVisible(true);
  };

  const handleClick = () => {
    if (hideOnClick) {
      setIsClicked(true);
      setIsVisible(false);
    }
  };

  return (
    <div 
      className="tooltip-container" 
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {children}
      {isVisible && (
        <div 
          className="tooltip-content" 
          style={{ 
            left: '30px',
            opacity: isVisible ? 1 : 0,
            transition: 'opacity 0.2s'
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
};

export default Tooltip;