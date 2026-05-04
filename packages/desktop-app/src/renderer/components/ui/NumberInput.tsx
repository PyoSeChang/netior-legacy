import React from 'react';
import { Input, type InputProps } from './Input';

export interface NumberInputProps extends Omit<InputProps, 'type' | 'onChange'> {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value, onChange, min, max, step = 1, ...props
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseFloat(e.target.value);
    if (!isNaN(num)) onChange(num);
  };

  return (
    <Input
      type="number"
      value={value}
      onChange={handleChange}
      min={min}
      max={max}
      step={step}
      {...props}
    />
  );
};
