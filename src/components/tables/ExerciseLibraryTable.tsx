import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ExerciseLibraryRow } from '@/utils/workoutDataParser';

interface ExerciseLibraryTableProps {
  data: ExerciseLibraryRow[];
}

export function ExerciseLibraryTable({ data }: ExerciseLibraryTableProps) {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'beginner':
        return 'bg-green-100 text-green-800';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'expert':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Exercise ID</TableHead>
            <TableHead>Exercise Name</TableHead>
            <TableHead>Difficulty</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((exercise, index) => (
            <TableRow key={exercise.exerciseId || index}>
              <TableCell className="font-mono text-sm">{exercise.exerciseId}</TableCell>
              <TableCell className="font-medium">{exercise.name}</TableCell>
              <TableCell>
                <Badge className={getDifficultyColor(exercise.difficulty)}>
                  {exercise.difficulty}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
