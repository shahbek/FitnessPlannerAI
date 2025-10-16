import { KbdProps } from '@/types';

export function Kbd({ children }: KbdProps) {
  return (
    <kbd className="rounded border bg-gray-50 px-1.5 py-0.5 text-[11px] font-mono text-gray-700">
      {children}
    </kbd>
  );
}
