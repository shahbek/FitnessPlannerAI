import React from 'react';
import { FitnessPlan } from '@/types';
import { Small } from '@/components/ui/Small';

interface MealsTableProps {
  plan: FitnessPlan | null;
}

export function MealsTable({ plan }: MealsTableProps) {
  if (!plan?.meals?.length) {
    return <Small>No meals found in parsed JSON. Check Raw tab.</Small>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-gray-700">
            <th className="py-2 px-2 text-left">Meal</th>
            <th className="py-2 px-2 text-left">kcal</th>
            <th className="py-2 px-2 text-left">Items</th>
          </tr>
        </thead>
        <tbody>
          {plan.meals.map((meal, idx) => (
            <tr key={idx} className="border-t">
              <td className="py-2 px-2 font-medium">{meal.name}</td>
              <td className="py-2 px-2 font-mono">{meal.kcal}</td>
              <td className="py-2 px-2">
                <ul className="list-disc pl-5">
                  {(meal.items || []).map((item, j) => (
                    <li key={j} className="font-mono text-xs">
                      {item.food}: {item.grams} g
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
