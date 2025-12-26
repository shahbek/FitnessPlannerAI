import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ComprehensiveMealTable } from '@/components/tables/ComprehensiveMealTable';
import { WeeklyShoppingTable } from '@/components/tables/WeeklyShoppingTable';
import { ChefHat, ShoppingCart } from 'lucide-react';

interface MealsAndGroceriesViewProps {
    mealsData: any[];
    shoppingData: any[];
}

export function MealsAndGroceriesView({ mealsData, shoppingData }: MealsAndGroceriesViewProps) {
    return (
        <div className="space-y-6">
            <Tabs defaultValue="meal-plan" className="w-full">
                <div className="flex justify-center mb-6">
                    <TabsList className="grid w-full max-w-md grid-cols-2">
                        <TabsTrigger value="meal-plan" className="flex items-center gap-2">
                            <ChefHat className="w-4 h-4" />
                            Meal Plan
                        </TabsTrigger>
                        <TabsTrigger value="shopping-list" className="flex items-center gap-2">
                            <ShoppingCart className="w-4 h-4" />
                            Shopping List
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="meal-plan" className="mt-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-4">
                        <div className="flex flex-col space-y-1.5 mb-4">
                            <h3 className="text-lg font-semibold leading-none tracking-tight">Weekly Meal Plan</h3>
                            <p className="text-sm text-muted-foreground">
                                Your customized nutrition plan designed to support your training goals.
                            </p>
                        </div>
                        <ComprehensiveMealTable data={mealsData} />
                    </div>
                </TabsContent>

                <TabsContent value="shopping-list" className="mt-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-4">
                        <div className="flex flex-col space-y-1.5 mb-4">
                            <h3 className="text-lg font-semibold leading-none tracking-tight">Grocery List</h3>
                            <p className="text-sm text-muted-foreground">
                                Aggregated shopping list for your weekly meal plan.
                            </p>
                        </div>
                        <WeeklyShoppingTable data={shoppingData} />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
