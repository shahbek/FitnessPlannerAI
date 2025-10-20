import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ExerciseMuscleGroupsRow } from '@/utils/workoutDataParser';

interface ExerciseMuscleGroupsTableProps {
  data: ExerciseMuscleGroupsRow[];
}

export function ExerciseMuscleGroupsTable({ data }: ExerciseMuscleGroupsTableProps) {
  const getMuscleGroupColor = (muscleGroup: string) => {
    const colors = [
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800',
      'bg-purple-100 text-purple-800',
      'bg-orange-100 text-orange-800',
      'bg-pink-100 text-pink-800',
      'bg-indigo-100 text-indigo-800',
      'bg-teal-100 text-teal-800',
      'bg-cyan-100 text-cyan-800'
    ];
    
    const index = muscleGroup.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Exercise ID</TableHead>
            <TableHead>Muscle Group</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => (
            <TableRow key={`${row.exerciseId}-${row.muscleGroup}-${index}`}>
              <TableCell className="font-mono text-sm">{row.exerciseId}</TableCell>
              <TableCell>
                <Badge className={getMuscleGroupColor(row.muscleGroup)}>
                  {row.muscleGroup}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
