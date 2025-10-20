import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RecipeIngredientsRow } from '@/utils/workoutDataParser';

interface RecipeIngredientsTableProps {
  data: RecipeIngredientsRow[];
}

export function RecipeIngredientsTable({ data }: RecipeIngredientsTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Template ID</TableHead>
            <TableHead>Ingredient Name</TableHead>
            <TableHead className="w-[120px]">Amount</TableHead>
            <TableHead className="w-[100px]">Calories</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((ingredient, index) => (
            <TableRow key={`${ingredient.templateId}-${ingredient.ingredientName}-${index}`}>
              <TableCell className="font-mono text-sm">{ingredient.templateId}</TableCell>
              <TableCell className="font-medium">{ingredient.ingredientName}</TableCell>
              <TableCell className="text-sm">{ingredient.amount}</TableCell>
              <TableCell className="text-center font-mono">{ingredient.calories}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
