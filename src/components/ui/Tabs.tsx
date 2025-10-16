import { TabsProps } from '@/types';

export function Tabs({ tabs, current, onChange }: TabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`rounded-xl px-3 py-1.5 text-sm transition-colors ${
            tab === current
              ? 'bg-black text-white shadow'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
