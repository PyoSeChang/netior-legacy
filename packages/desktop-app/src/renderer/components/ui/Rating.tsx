import React, { useState } from 'react';
import { Star } from 'lucide-react';

export interface RatingProps {
  value?: number;
  onChange?: (value: number) => void;
  max?: number;
  disabled?: boolean;
}

export const Rating: React.FC<RatingProps> = ({ value = 0, onChange, max = 5, disabled }) => {
  const [hover, setHover] = useState(0);

  return (
    <div className="inline-flex gap-0.5">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          className="p-0.5 transition-colors disabled:cursor-not-allowed"
          onClick={() => onChange?.(n === value ? 0 : n)}
          onMouseEnter={() => !disabled && setHover(n)}
          onMouseLeave={() => setHover(0)}
        >
          <Star
            size={18}
            className={`transition-colors ${
              n <= (hover || value)
                ? 'fill-amber-400 text-amber-400'
                : 'text-muted'
            }`}
          />
        </button>
      ))}
    </div>
  );
};
