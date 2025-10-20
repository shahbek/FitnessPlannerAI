import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ShoppingItemsRow } from '@/utils/workoutDataParser';

interface ShoppingItemsTableProps {
  data: ShoppingItemsRow[];
}

export function ShoppingItemsTable({ data }: ShoppingItemsTableProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const totalCost = data.reduce((sum, item) => sum + item.estimatedCost, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Item Name</TableHead>
              <TableHead className="w-[120px]">Quantity</TableHead>
              <TableHead className="w-[100px]">Cost</TableHead>
              <TableHead className="w-[100px]">Priority</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, index) => (
              <TableRow key={`${item.categoryName}-${item.itemName}-${index}`}>
                <TableCell className="font-medium">{item.categoryName}</TableCell>
                <TableCell>{item.itemName}</TableCell>
                <TableCell className="text-sm">{item.quantity}</TableCell>
                <TableCell className="text-center font-mono">${item.estimatedCost.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge className={getPriorityColor(item.priority)}>
                    {item.priority}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      <div className="bg-muted p-4 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="font-semibold">Total Estimated Cost:</span>
          <span className="font-mono text-lg font-bold">${totalCost.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
