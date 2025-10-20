import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SessionExercisesRow } from '@/utils/workoutDataParser';

interface SessionExercisesTableProps {
  data: SessionExercisesRow[];
}

export function SessionExercisesTable({ data }: SessionExercisesTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Template ID</TableHead>
            <TableHead className="w-[100px]">Exercise ID</TableHead>
            <TableHead>Exercise Name</TableHead>
            <TableHead className="w-[80px]">Sets</TableHead>
            <TableHead className="w-[80px]">Reps</TableHead>
            <TableHead className="w-[100px]">Rest (sec)</TableHead>
            <TableHead className="w-[80px]">Order</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((exercise, index) => (
            <TableRow key={`${exercise.templateId}-${exercise.exerciseId}-${index}`}>
              <TableCell className="font-mono text-sm">{exercise.templateId}</TableCell>
              <TableCell className="font-mono text-sm">{exercise.exerciseId}</TableCell>
              <TableCell className="font-medium">{exercise.exerciseId}</TableCell>
              <TableCell className="text-center">{exercise.sets}</TableCell>
              <TableCell className="text-center">{exercise.reps}</TableCell>
              <TableCell className="text-center">{exercise.restSeconds}</TableCell>
              <TableCell className="text-center">{exercise.exerciseOrder}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {exercise.notes || '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
