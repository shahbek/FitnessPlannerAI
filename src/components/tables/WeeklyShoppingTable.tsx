import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ShoppingCart, DollarSign, Package } from 'lucide-react';
import { useState } from 'react';

interface WeeklyShoppingItem {
  weekNumber: number;
  phaseName: string;
  categories: Array<{
    category: string;
    items: Array<{
      name: string;
      quantity: string;
      estimatedCost: number;
      priority: string;
      meals: string[]; // Which meals use this ingredient
    }>;
    categoryTotal: number;
  }>;
  weekTotal: number;
  meals: Array<{
    mealName: string;
    mealType: string;
    ingredients: string[];
  }>;
}

interface WeeklyShoppingTableProps {
  data: WeeklyShoppingItem[];
}

export function WeeklyShoppingTable({ data }: WeeklyShoppingTableProps) {
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1])); // First week expanded by default

  const toggleWeekExpansion = (weekNumber: number) => {
    const newExpanded = new Set(expandedWeeks);
    if (newExpanded.has(weekNumber)) {
      newExpanded.delete(weekNumber);
    } else {
      newExpanded.add(weekNumber);
    }
    setExpandedWeeks(newExpanded);
  };

  // Unified color scheme - subtle monochrome
  const getPriorityStyle = () => {
    return 'text-foreground border border-border bg-transparent';
  };

  const getCategoryStyle = () => {
    return 'text-muted-foreground border border-border bg-transparent';
  };

  const getMealTypeStyle = () => {
    return 'text-foreground border border-border bg-transparent';
  };

  // Calculate total cost for all weeks
  const totalCost = data.reduce((sum, week) => sum + week.weekTotal, 0);
  const weeklyCost = totalCost / data.length;
  const monthlyCost = weeklyCost * 4; // Assuming 4 weeks per month

  return (
    <div className="space-y-6">
      {/* Overall Summary */}
      <div className="rounded-lg border border-border/60 bg-background shadow-sm p-6">
        <div className="flex items-center gap-2 mb-6 pb-2 border-b border-border/30">
          <div className="p-1.5 bg-primary/10 rounded-md">
            <ShoppingCart className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-sm font-medium uppercase tracking-wide text-foreground">Shopping Plan Summary</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-semibold font-mono mb-1">${totalCost.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Total Plan Cost</div>
          </div>
          <div className="text-center border-l border-border/50 pl-6">
            <div className="text-3xl font-semibold font-mono mb-1">${(totalCost / data.length).toFixed(2)}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Avg Weekly Cost</div>
          </div>
          <div className="text-center border-l border-border/50 pl-6">
            <div className="text-3xl font-semibold font-mono mb-1">${monthlyCost.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Estimated Monthly</div>
          </div>
        </div>
      </div>

      {/* Weekly Breakdown */}
      {data.map((week, weekIndex) => {
        const isEven = weekIndex % 2 === 0;
        
        return (
          <div 
            key={week.weekNumber} 
            className={`rounded-lg border border-border/60 transition-all hover:shadow-md hover:border-border ${
              isEven 
                ? 'bg-background shadow-sm' 
                : 'bg-muted/40 shadow-sm'
            }`}
          >
            <Collapsible>
              <CollapsibleTrigger 
                className="w-full hover:bg-muted/50 transition-colors rounded-t-lg"
                onClick={() => toggleWeekExpansion(week.weekNumber)}
              >
                <div className="px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-editorial font-light">
                          Week {week.weekNumber}
                        </h3>
                        <span className="text-sm text-muted-foreground">•</span>
                        <span className="text-sm font-medium">{week.phaseName}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <Badge variant="outline" className="flex items-center gap-1.5 text-xs">
                          <DollarSign className="h-3 w-3" />
                          ${week.weekTotal.toFixed(2)}
                        </Badge>
                        <Badge variant="outline" className="flex items-center gap-1.5 text-xs">
                          <Package className="h-3 w-3" />
                          {week.categories.length} categories
                        </Badge>
                      </div>
                    </div>
                    
                    <ChevronDown 
                      className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${
                        expandedWeeks.has(week.weekNumber) ? 'rotate-180' : ''
                      }`} 
                    />
                  </div>
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="px-6 py-6 border-t border-border/50">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Shopping List */}
                    <div className="bg-background/80 rounded-lg p-5 border border-border/40 shadow-sm">
                      <div className="flex items-center gap-2 mb-5 pb-2 border-b border-border/30">
                        <div className="p-1.5 bg-primary/10 rounded-md">
                          <ShoppingCart className="h-4 w-4 text-primary" />
                        </div>
                        <h3 className="text-sm font-medium uppercase tracking-wide text-foreground">Shopping List</h3>
                      </div>
                      
                      <div className="rounded-md border border-border/30">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-b border-border/50">
                              <TableHead className="text-xs uppercase tracking-wide">Item</TableHead>
                              <TableHead className="text-xs uppercase tracking-wide">Category</TableHead>
                              <TableHead className="text-xs uppercase tracking-wide">Quantity</TableHead>
                              <TableHead className="text-xs uppercase tracking-wide">Priority</TableHead>
                              <TableHead className="text-right text-xs uppercase tracking-wide">Cost</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {week.categories.flatMap(category => 
                              category.items.map((item, index) => (
                                <TableRow key={`${category.category}-${index}`} className="border-b border-border/30">
                                  <TableCell className="font-medium text-sm">{item.name}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={getCategoryStyle()}>
                                      {category.category}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-mono text-sm">{item.quantity}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={`text-xs ${getPriorityStyle()}`}>
                                      {item.priority}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-sm">
                                    ${item.estimatedCost.toFixed(2)}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                            <TableRow className="border-t-2 border-border/60 font-semibold bg-muted/30">
                              <TableCell colSpan={4} className="text-right font-medium">
                                Total Cost:
                              </TableCell>
                              <TableCell className="text-right font-mono text-lg">
                                ${week.weekTotal.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    {/* Weekly Meals */}
                    <div className="bg-background/80 rounded-lg p-5 border border-border/40 shadow-sm">
                      <div className="flex items-center gap-2 mb-5 pb-2 border-b border-border/30">
                        <div className="p-1.5 bg-primary/10 rounded-md">
                          <Package className="h-4 w-4 text-primary" />
                        </div>
                        <h3 className="text-sm font-medium uppercase tracking-wide text-foreground">Weekly Meal Plan</h3>
                      </div>
                      
                      <div className="space-y-3">
                        {week.meals.map((meal, index) => (
                          <div 
                            key={index} 
                            className={`pb-3 ${index < week.meals.length - 1 ? 'border-b border-border/50 mb-3' : ''}`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className={getMealTypeStyle()}>
                                {meal.mealType}
                              </Badge>
                              <span className="font-medium text-sm">{meal.mealName}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <div className="font-medium mb-1.5">Ingredients:</div>
                              <div className="flex flex-wrap gap-1.5">
                                {meal.ingredients.map((ingredient, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {ingredient}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        );
      })}
    </div>
  );
}
