import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MealTemplatesRow } from '@/utils/workoutDataParser';

interface MealTemplatesTableProps {
  data: MealTemplatesRow[];
}

export function MealTemplatesTable({ data }: MealTemplatesTableProps) {
  const getMealTypeColor = (mealType: string) => {
    switch (mealType.toLowerCase()) {
      case 'breakfast':
        return 'bg-orange-100 text-orange-800';
      case 'lunch':
        return 'bg-blue-100 text-blue-800';
      case 'dinner':
        return 'bg-purple-100 text-purple-800';
      case 'snack':
        return 'bg-green-100 text-green-800';
      case 'recovery':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Template ID</TableHead>
            <TableHead>Meal Name</TableHead>
            <TableHead>Meal Type</TableHead>
            <TableHead className="w-[100px]">Calories</TableHead>
            <TableHead className="w-[80px]">Protein (g)</TableHead>
            <TableHead className="w-[80px]">Carbs (g)</TableHead>
            <TableHead className="w-[80px]">Fat (g)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((meal, index) => (
            <TableRow key={meal.templateId || index}>
              <TableCell className="font-mono text-sm">{meal.templateId}</TableCell>
              <TableCell className="font-medium">{meal.name}</TableCell>
              <TableCell>
                <Badge className={getMealTypeColor(meal.mealType)}>
                  {meal.mealType}
                </Badge>
              </TableCell>
              <TableCell className="text-center font-mono">{meal.totalCalories}</TableCell>
              <TableCell className="text-center">{meal.proteinGrams}</TableCell>
              <TableCell className="text-center">{meal.carbsGrams}</TableCell>
              <TableCell className="text-center">{meal.fatGrams}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
