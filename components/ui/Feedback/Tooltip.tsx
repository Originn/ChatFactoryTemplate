import React, { useState, useEffect, useRef } from 'react';

interface TooltipProps {
  message: string;
  children: React.ReactNode;
  hideOnClick?: boolean;
  alignPixels?: number;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

const Tooltip: React.FC<TooltipProps> = ({
  message,
  children,
  hideOnClick = false,
  alignPixels = 30,
  position = 'top',
  delay = 200,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // Show tooltip after delay
  const handleMouseEnter = () => {
    if (isClicked) return;
    
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    timerRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  // Hide tooltip immediately
  const handleMouseLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    setIsVisible(false);
  };

  // Handle click
  const handleClick = () => {
    if (hideOnClick) {
      setIsClicked(true);
      setIsVisible(false);
    }
  };

  // Reset clicked state after a while
  useEffect(() => {
    if (isClicked) {
      const timer = setTimeout(() => {
        setIsClicked(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [isClicked]);

  // Clean up any timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Calculate position styles
  const getPositionStyles = () => {
    const baseStyles: React.CSSProperties = {
      position: 'absolute',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      color: 'white',
      padding: '5px 10px',
      borderRadius: '4px',
      fontSize: '14px',
      whiteSpace: 'nowrap',
      zIndex: 1000,
      opacity: isVisible ? 1 : 0,
      transition: 'opacity 0.2s',
      pointerEvents: 'none'
    };
    
    switch (position) {
      case 'bottom':
        return { ...baseStyles, top: '100%', left: `${alignPixels}px`, marginTop: '8px' };
      case 'left':
        return { ...baseStyles, right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: '8px' };
      case 'right':
        return { ...baseStyles, left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: '8px' };
      case 'top':
      default:
        return { ...baseStyles, bottom: '100%', left: `${alignPixels}px`, marginBottom: '8px' };
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
      <div 
        ref={tooltipRef}
        style={getPositionStyles()}
      >
        {message}
      </div>
    </div>
  );
};

export default Tooltip;