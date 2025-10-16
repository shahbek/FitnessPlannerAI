import { LabelProps } from '@/types';

export function Label({ children, htmlFor }: LabelProps) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
      {children}
    </label>
  );
}
