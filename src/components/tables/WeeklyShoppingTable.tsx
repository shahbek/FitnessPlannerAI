import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ShoppingCart, DollarSign, Calendar, Package } from 'lucide-react';
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

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = [
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800',
      'bg-purple-100 text-purple-800',
      'bg-orange-100 text-orange-800',
      'bg-pink-100 text-pink-800',
      'bg-indigo-100 text-indigo-800'
    ];
    const index = category.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Calculate total cost for all weeks
  const totalCost = data.reduce((sum, week) => sum + week.weekTotal, 0);
  const weeklyCost = totalCost / data.length;
  const monthlyCost = weeklyCost * 4; // Assuming 4 weeks per month

  return (
    <div className="space-y-6">
      {/* Overall Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Shopping Plan Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">${totalCost.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Total Plan Cost</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">${(totalCost / data.length).toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Avg Weekly Cost</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">${monthlyCost.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Estimated Monthly Cost</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Breakdown */}
      {data.map((week) => (
        <Card key={week.weekNumber} className="overflow-hidden">
          <Collapsible>
            <CollapsibleTrigger 
              className="w-full"
              onClick={() => toggleWeekExpansion(week.weekNumber)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Week {week.weekNumber} - {week.phaseName}
                    </CardTitle>
                    <div className="flex items-center gap-4 mt-2">
                      <Badge variant="outline" className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        ${week.weekTotal.toFixed(2)}
                      </Badge>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {week.categories.length} categories
                      </Badge>
                    </div>
                  </div>
                  
                  <ChevronDown 
                    className={`h-5 w-5 transition-transform ${
                      expandedWeeks.has(week.weekNumber) ? 'rotate-180' : ''
                    }`} 
                  />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Shopping List */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      Shopping List
                    </h3>
                    
                    <Card className="p-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead className="text-right">Cost</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {week.categories.flatMap(category => 
                            category.items.map((item, index) => (
                              <TableRow key={`${category.category}-${index}`}>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell>
                                  <Badge className={getCategoryColor(category.category)}>
                                    {category.category}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-mono">{item.quantity}</TableCell>
                                <TableCell>
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs ${getPriorityColor(item.priority)}`}
                                  >
                                    {item.priority}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  ${item.estimatedCost.toFixed(2)}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                          <TableRow className="border-t-2 font-semibold bg-muted/50">
                            <TableCell colSpan={4} className="text-right font-medium">
                              Total Cost:
                            </TableCell>
                            <TableCell className="text-right font-mono text-lg">
                              ${week.weekTotal.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </Card>
                  </div>

                  {/* Weekly Meals */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Weekly Meal Plan
                    </h3>
                    
                    <div className="space-y-3">
                      {week.meals.map((meal, index) => (
                        <Card key={index} className="p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{meal.mealType}</Badge>
                            <span className="font-medium text-sm">{meal.mealName}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <div className="font-medium mb-1">Ingredients:</div>
                            <div className="flex flex-wrap gap-1">
                              {meal.ingredients.map((ingredient, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {ingredient}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}
    </div>
  );
}
