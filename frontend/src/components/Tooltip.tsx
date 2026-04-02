import { useState, useId } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom';
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();

  return (
    <span
      className="tooltip-root"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      tabIndex={0}
      aria-describedby={visible ? tooltipId : undefined}
      style={{ cursor: 'default' }}
    >
      {children}
      {visible && (
        <span
          id={tooltipId}
          role="tooltip"
          className={`tooltip-overlay${position === 'bottom' ? ' bottom' : ''}`}
        >
          {content}
        </span>
      )}
    </span>
  );
}
