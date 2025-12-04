import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
} from '@tanstack/react-table';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';

// Types
interface MacroRow {
  day: string;
  dayNumber: number;
  date?: Date;
  bodyWeight: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
}

interface WeekData {
  weekNumber: number;
  phaseName: string;
  rows: MacroRow[];
}

interface MacroTrackingTableProps {
  weeklyScheduleData?: any[];
  weeklyOutlines?: any[];
  workoutPlanId?: string;
  userProfile?: {
    weight?: number;
  };
  planStartDate?: Date;
  onMacroUpdate?: (weekNumber: number, dayNumber: number, field: string, value: number) => void;
}

// Debounce helper
function useDebounce<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    }) as T,
    [callback, delay]
  );
}

// Notion-style editable cell - ultra minimal
function EditableCell({
  getValue,
  row,
  column,
  table,
  target,
}: {
  getValue: () => number;
  row: { index: number };
  column: { id: string };
  table: any;
  target?: number;
}) {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const commit = () => {
    setEditing(false);
    if (value !== initialValue) {
      table.options.meta?.updateData(row.index, column.id, value);
    }
  };

  // Simple status: over/under/on target (only for macro columns)
  let status: 'on' | 'over' | 'under' | null = null;
  if (target !== undefined) {
    const diff = value - target;
    const pct = target > 0 ? Math.abs(diff / target) * 100 : 0;
    status = pct <= 5 ? 'on' : diff > 0 ? 'over' : 'under';
  }

  if (editing) {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setValue(initialValue);
            setEditing(false);
          }
        }}
        autoFocus
        className="w-full h-6 px-1 text-sm font-mono text-left bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        min="0"
        step={column.id === 'bodyWeight' ? '0.1' : '1'}
      />
    );
  }

  // Get unit suffix based on column
  const getUnit = () => {
    if (column.id === 'bodyWeight') return 'kg';
    if (column.id === 'calories') return 'kcal';
    if (['protein', 'carbs', 'fat'].includes(column.id)) return 'g';
    return '';
  };

  // Format target for display
  const formatTarget = () => {
    if (!target || target === 0) return null;
    if (column.id === 'bodyWeight') return `${target.toFixed(1)}kg`;
    if (column.id === 'calories') return `${Math.round(target)}kcal`;
    if (['protein', 'carbs', 'fat'].includes(column.id)) return `${Math.round(target)}g`;
    return null;
  };

  return (
    <div
      onClick={() => setEditing(true)}
      className={cn(
        "h-6 px-1 flex items-center justify-start cursor-text font-mono text-sm rounded-sm",
        "hover:bg-slate-100 transition-colors",
        status === 'over' && "text-amber-800 bg-amber-100",
        status === 'under' && "text-emerald-800 bg-emerald-100"
      )}
    >
      <span className="text-sm">
        {column.id === 'bodyWeight' ? value.toFixed(1) : Math.round(value)}
        {getUnit() && <span className="ml-0.5 text-xs text-slate-600">{getUnit()}</span>}
      </span>
      {target !== undefined && formatTarget() && (
        <>
          <span className="mx-1.5 text-slate-300">/</span>
          <span className="text-sm text-slate-600 font-mono">
            {formatTarget()}
          </span>
        </>
      )}
    </div>
  );
}

const columnHelper = createColumnHelper<MacroRow>();

export function MacroTrackingTable({
  weeklyScheduleData = [],
  weeklyOutlines = [],
  workoutPlanId,
  userProfile,
  planStartDate,
  onMacroUpdate,
}: MacroTrackingTableProps) {
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [weeklyData, setWeeklyData] = useState<WeekData[]>([]);
  const [startDate, setStartDate] = useState<Date>(() => {
    // Use provided start date or default to next Monday
    if (planStartDate) return planStartDate;
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    nextMonday.setHours(0, 0, 0, 0);
    return nextMonday;
  });

  // Convex mutations and queries
  const upsertMacroTracking = useMutation(api.macroTracking.upsertMacroTracking);
  const savedTrackingData = useQuery(
    api.macroTracking.getMacroTrackingByPlan,
    workoutPlanId ? { workoutPlanId: workoutPlanId as any } : 'skip'
  );

  // Handle query errors gracefully
  useEffect(() => {
    if (savedTrackingData === undefined && workoutPlanId) {
      // Query is loading or failed - this is okay, we'll use defaults
      console.log('⏳ Loading macro tracking data...');
    }
  }, [savedTrackingData, workoutPlanId]);

  const [savingState, setSavingState] = useState<Record<string, boolean>>({});

  // Debounced save function
  const debouncedSave = useDebounce(
    useCallback(
      async (
        weekNumber: number,
        dayNumber: number,
        date: Date,
        actualMacros: any,
        targetMacros: any
      ) => {
        if (!workoutPlanId) {
          console.warn('⚠️ Cannot save macro tracking: workoutPlanId is missing');
          return;
        }

        const saveKey = `${weekNumber}-${dayNumber}`;
        setSavingState(prev => ({ ...prev, [saveKey]: true }));

        try {
          console.log('💾 Saving macro tracking:', {
            workoutPlanId,
            weekNumber,
            dayNumber,
            actualMacros,
            targetMacros,
          });

          await upsertMacroTracking({
            workoutPlanId: workoutPlanId as any,
            date: date.getTime(),
            weekNumber,
            dayNumber,
            actualMacros,
            targetMacros,
          });

          console.log('✅ Macro tracking saved successfully');
        } catch (error) {
          console.error('❌ Failed to save macro tracking:', error);
        } finally {
          setSavingState(prev => ({ ...prev, [saveKey]: false }));
        }
      },
      [workoutPlanId, upsertMacroTracking]
    ),
    1000
  );

  // Calculate date for a specific day (normalized to midnight for day-level matching)
  const getDateForDay = useCallback(
    (weekNumber: number, dayNumber: number): Date => {
      const date = new Date(startDate);
      const daysToAdd = (weekNumber - 1) * 7 + (dayNumber - 1);
      date.setDate(date.getDate() + daysToAdd);
      // Normalize to midnight for day-level matching
      date.setHours(0, 0, 0, 0);
      return date;
    },
    [startDate]
  );

  // Format date for display
  const formatDate = useCallback((date: Date) => {
    const day = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    return `${day} ${month}`;
  }, []);

  // Transform schedule data with dates and saved data
  useEffect(() => {
    if (weeklyScheduleData.length === 0) return;

    console.log('🔄 Transforming macro tracking data:', {
      weeklyScheduleDataLength: weeklyScheduleData.length,
      savedTrackingDataLength: savedTrackingData?.length || 0,
      workoutPlanId,
    });

    const transformed: WeekData[] = weeklyScheduleData.map((week: any, idx: number) => {
      const outline = weeklyOutlines[idx];
      const rows: MacroRow[] = (week.days || []).map((day: any) => {
        const m = day.dailyMacros || {};
        const dayDate = getDateForDay(week.weekNumber || idx + 1, day.dayNumber);

        // Find saved data for this day
        const savedEntry = savedTrackingData?.find(
          (entry: any) =>
            entry.weekNumber === (week.weekNumber || idx + 1) &&
            entry.dayNumber === day.dayNumber
        );

        if (savedEntry) {
          console.log('📥 Loaded saved data for:', {
            weekNumber: week.weekNumber || idx + 1,
            dayNumber: day.dayNumber,
            actualMacros: savedEntry.actualMacros,
          });
        }

        // Use saved data if available, otherwise use defaults
        const actualMacros = savedEntry?.actualMacros || {
          calories: m.totalCalories || 0,
          protein: m.protein || 0,
          carbs: m.carbs || 0,
          fat: m.fat || 0,
          bodyWeight: userProfile?.weight || 0,
        };

        return {
          day: day.day || `Day ${day.dayNumber}`,
          dayNumber: day.dayNumber,
          date: dayDate,
          bodyWeight: actualMacros.bodyWeight || userProfile?.weight || 0,
          calories: actualMacros.calories || m.totalCalories || 0,
          protein: actualMacros.protein || m.protein || 0,
          carbs: actualMacros.carbs || m.carbs || 0,
          fat: actualMacros.fat || m.fat || 0,
          targetCalories: m.totalCalories || 0,
          targetProtein: m.protein || 0,
          targetCarbs: m.carbs || 0,
          targetFat: m.fat || 0,
        };
      });
      return {
        weekNumber: week.weekNumber || idx + 1,
        phaseName: week.phaseName || outline?.phase || '',
        rows,
      };
    });
    setWeeklyData(transformed);
  }, [weeklyScheduleData, weeklyOutlines, savedTrackingData, userProfile, getDateForDay, workoutPlanId]);

  const currentWeek = weeklyData.find((w) => w.weekNumber === selectedWeek);
  const [data, setData] = useState<MacroRow[]>([]);

  useEffect(() => {
    if (currentWeek) {
      console.log('📊 Loading week data:', {
        weekNumber: currentWeek.weekNumber,
        rowsCount: currentWeek.rows.length,
      });
      setData(currentWeek.rows);
    }
  }, [currentWeek]);

  // Reset selected week when plan changes
  useEffect(() => {
    if (weeklyData.length > 0 && selectedWeek > weeklyData.length) {
      setSelectedWeek(1);
    }
  }, [weeklyData.length, selectedWeek]);


  const columns = useMemo<ColumnDef<MacroRow, any>[]>(
    () => [
      columnHelper.accessor('day', {
        header: () => <span className="text-xs text-slate-800 font-semibold">Day</span>,
        cell: (info) => (
          <span className="text-sm font-medium text-slate-800">{info.getValue()}</span>
        ),
        size: 80,
      }),
      columnHelper.accessor('bodyWeight', {
        header: () => <span className="text-xs text-slate-800 font-semibold">Weight (kg)</span>,
        cell: (props) => (
          <EditableCell {...props} />
        ),
        size: 90,
      }),
      columnHelper.accessor('calories', {
        header: () => (
          <span className="text-xs text-slate-800 font-semibold">Calories</span>
        ),
        cell: (props) => (
          <EditableCell {...props} target={props.row.original.targetCalories} />
        ),
        size: 110,
      }),
      columnHelper.accessor('protein', {
        header: () => (
          <span className="text-xs text-slate-800 font-semibold">Protein</span>
        ),
        cell: (props) => (
          <EditableCell {...props} target={props.row.original.targetProtein} />
        ),
        size: 100,
      }),
      columnHelper.accessor('carbs', {
        header: () => (
          <span className="text-xs text-slate-800 font-semibold">Carbs</span>
        ),
        cell: (props) => (
          <EditableCell {...props} target={props.row.original.targetCarbs} />
        ),
        size: 100,
      }),
      columnHelper.accessor('fat', {
        header: () => (
          <span className="text-xs text-slate-800 font-semibold">Fat</span>
        ),
        cell: (props) => (
          <EditableCell {...props} target={props.row.original.targetFat} />
        ),
        size: 100,
      }),
    ],
    [formatDate]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      updateData: (rowIndex: number, columnId: string, value: number) => {
        setData((old) => {
          const updated = old.map((row, i) =>
            i === rowIndex ? { ...row, [columnId]: value } : row
          );
          const updatedRow = updated[rowIndex];

          // Auto-save to database
          if (updatedRow && updatedRow.date && workoutPlanId) {
            debouncedSave(
              selectedWeek,
              updatedRow.dayNumber,
              updatedRow.date,
              {
                calories: updatedRow.calories,
                protein: updatedRow.protein,
                carbs: updatedRow.carbs,
                fat: updatedRow.fat,
                bodyWeight: updatedRow.bodyWeight,
              },
              {
                calories: updatedRow.targetCalories,
                protein: updatedRow.targetProtein,
                carbs: updatedRow.targetCarbs,
                fat: updatedRow.targetFat,
              }
            );
          }

          return updated;
        });

        const row = data[rowIndex];
        if (row && onMacroUpdate) {
          onMacroUpdate(selectedWeek, row.dayNumber, columnId, value);
        }
      },
    },
  });

  // Log when workoutPlanId is missing
  useEffect(() => {
    if (!workoutPlanId && weeklyScheduleData.length > 0) {
      console.warn('⚠️ MacroTrackingTable: workoutPlanId is missing. Data will not be saved to database.');
    } else if (workoutPlanId) {
      console.log('✅ MacroTrackingTable: workoutPlanId found:', workoutPlanId);
    }
  }, [workoutPlanId, weeklyScheduleData.length]);

  if (weeklyData.length === 0) {
    return (
      <Card className="rounded-3xl border-2 border-white/60 bg-gradient-to-br from-white via-emerald-50 to-teal-50 backdrop-blur-xl shadow-[0_10px_40px_rgba(16,185,129,0.1),inset_0_3px_6px_rgba(0,0,0,0.05),inset_0_-2px_4px_rgba(255,255,255,0.9),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-300 overflow-hidden">
        <CardContent className="py-6 text-center text-slate-400">
          <Target className="h-6 w-6 mx-auto mb-2 opacity-40" />
          <p className="text-xs">No macro data</p>
        </CardContent>
      </Card>
    );
  }

  if (!workoutPlanId) {
    return (
      <Card className="rounded-3xl border-2 border-white/60 bg-gradient-to-br from-white via-emerald-50 to-teal-50 backdrop-blur-xl shadow-[0_10px_40px_rgba(16,185,129,0.1),inset_0_3px_6px_rgba(0,0,0,0.05),inset_0_-2px_4px_rgba(255,255,255,0.9),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-300 overflow-hidden">
        <CardContent className="py-6 text-center text-slate-400">
          <Target className="h-6 w-6 mx-auto mb-2 opacity-40" />
          <p className="text-xs">Plan not saved yet</p>
          <p className="text-[10px] mt-1">Save your plan to enable macro tracking</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl border-2 border-white/60 bg-gradient-to-br from-white via-emerald-50 to-teal-50 backdrop-blur-xl shadow-[0_10px_40px_rgba(16,185,129,0.1),inset_0_3px_6px_rgba(0,0,0,0.05),inset_0_-2px_4px_rgba(255,255,255,0.9),inset_0_1px_0_rgba(255,255,255,0.8)] hover:shadow-[0_16px_50px_rgba(16,185,129,0.15),inset_0_4px_8px_rgba(0,0,0,0.06),inset_0_-2px_4px_rgba(255,255,255,1),inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-300 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-[0_4px_12px_rgba(16,185,129,0.4),inset_0_2px_4px_rgba(255,255,255,0.4)] flex items-center justify-center">
              <Target className="h-5 w-5 text-white drop-shadow-md" />
            </div>
            <div>
              <div className="text-lg font-black text-slate-800 tracking-tight">Macro Tracking</div>
              <div className="text-xs font-medium text-emerald-600 uppercase tracking-wide mt-0.5">
                {currentWeek?.phaseName || 'Weekly Overview'}
              </div>
            </div>
          </div>
          <Tabs value={selectedWeek.toString()} onValueChange={(v) => setSelectedWeek(parseInt(v))}>
            <TabsList className="h-7 bg-white/70 border border-emerald-100 p-0.5 gap-0.5">
              {weeklyData.map((w) => (
                <TabsTrigger
                  key={w.weekNumber}
                  value={w.weekNumber.toString()}
                  className="text-xs h-6 px-2.5 min-w-0 data-[state=active]:bg-emerald-500 data-[state=active]:text-white"
                >
                  W{w.weekNumber}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Separate rounded table */}
        <div className="bg-white/90 rounded-2xl border border-emerald-100/50 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id} className="hover:bg-transparent border-b border-slate-300 bg-slate-100">
                    {hg.headers.map((h, idx) => {
                      const isValue = ['calories', 'protein', 'carbs', 'fat', 'bodyWeight'].includes(h.id);
                      const isLast = idx === hg.headers.length - 1;
                      // Add border if: it's day, or it's not a value column (and not last)
                      const shouldHaveBorder = (h.id === 'day' || (!isValue && !isLast)) && !isLast;

                      return (
                        <TableHead
                          key={h.id}
                          className={cn(
                            "h-8 px-2 text-left",
                            shouldHaveBorder && "border-r border-slate-300"
                          )}
                          style={{ width: h.getSize() }}
                        >
                          {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row, rowIdx) => (
                  <TableRow
                    key={row.id}
                    className={cn(
                      "h-8 border-b border-slate-200",
                      rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50",
                      "hover:bg-slate-100 transition-colors"
                    )}
                  >
                    {row.getVisibleCells().map((cell, idx) => {
                      const isValue = ['calories', 'protein', 'carbs', 'fat', 'bodyWeight'].includes(cell.column.id);
                      const isLast = idx === row.getVisibleCells().length - 1;
                      // Add border if: it's day, or it's not a value column (and not last)
                      const shouldHaveBorder = (cell.column.id === 'day' || (!isValue && !isLast)) && !isLast;

                      return (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            "py-1 px-2 text-left",
                            shouldHaveBorder && "border-r border-slate-200"
                          )}
                          style={{ width: cell.column.getSize() }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Minimal legend */}
          <div className="px-3 py-1.5 border-t border-slate-200 flex gap-4 text-xs text-slate-500 bg-slate-50">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-amber-100 border border-amber-300"></span>
              Over
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-emerald-100 border border-emerald-300"></span>
              Under
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
