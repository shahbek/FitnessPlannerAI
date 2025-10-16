import React from 'react';
import { FitnessPlan } from '@/types';

interface PlanOverviewProps {
  plan: FitnessPlan;
}

export function PlanOverview({ plan }: PlanOverviewProps) {
  return (
    <div className="prose max-w-none">
      <p className="text-sm text-gray-600">
        {plan.feasibility
          ? `Feasibility: ${plan.feasibility.status}${
              plan.feasibility.proposed_timeline_weeks ? ` (timeline ~${plan.feasibility.proposed_timeline_weeks} weeks)` : ''
            }`
          : ''}
      </p>
      
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border p-3">
          <h4 className="font-semibold mb-2">Calories & Macros</h4>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="py-1 text-gray-600">Daily kcal</td>
                <td className="py-1 text-right font-mono">{plan.calories?.daily_kcal}</td>
              </tr>
              <tr>
                <td className="py-1 text-gray-600">Protein (g)</td>
                <td className="py-1 text-right font-mono">{plan.calories?.protein_g}</td>
              </tr>
              <tr>
                <td className="py-1 text-gray-600">Fat (g)</td>
                <td className="py-1 text-right font-mono">{plan.calories?.fat_g}</td>
              </tr>
              <tr>
                <td className="py-1 text-gray-600">Carb (g)</td>
                <td className="py-1 text-right font-mono">{plan.calories?.carb_g}</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div className="rounded-xl border p-3">
          <h4 className="font-semibold mb-2">Adjustments</h4>
          <ul className="list-disc pl-5 text-sm">
            <li>
              <strong>Missed workout:</strong> {plan.adjustments?.missed_workout || '—'}
            </li>
            <li>
              <strong>Diet deviation:</strong> {plan.adjustments?.diet_deviation || '—'}
            </li>
            <li>
              <strong>Low sleep:</strong> {plan.adjustments?.low_sleep || '—'}
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-4">
        <h4 className="font-semibold mb-2">Week Plan</h4>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-700">
                <th className="py-2 px-2 text-left">Day</th>
                <th className="py-2 px-2 text-left">Session</th>
                <th className="py-2 px-2 text-left">Blocks</th>
              </tr>
            </thead>
            <tbody>
              {(plan.week_plan || []).map((day) => (
                <tr key={day.day} className="border-t">
                  <td className="py-2 px-2 font-medium">{day.day}</td>
                  <td className="py-2 px-2">
                    {day.session_minutes}m {day.focus}
                  </td>
                  <td className="py-2 px-2 whitespace-pre-wrap font-mono text-xs">
                    {(day.blocks || []).map((block, i) => (
                      <div key={i}>
                        • {block.name}: {block.sets} x {block.reps_or_time}
                        {block.rir_or_rpe ? ` (${block.rir_or_rpe})` : ''}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {plan.references?.length ? (
        <div className="mt-4">
          <h4 className="font-semibold mb-1">References</h4>
          <ul className="list-disc pl-5 text-sm text-gray-700">
            {plan.references.map((ref, idx) => (
              <li key={idx}>{ref}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
