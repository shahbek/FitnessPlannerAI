import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ExerciseFormCuesRow } from '@/utils/workoutDataParser';

interface ExerciseFormCuesTableProps {
  data: ExerciseFormCuesRow[];
}

export function ExerciseFormCuesTable({ data }: ExerciseFormCuesTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Exercise ID</TableHead>
            <TableHead>Form Cue</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => (
            <TableRow key={`${row.exerciseId}-${index}`}>
              <TableCell className="font-mono text-sm">{row.exerciseId}</TableCell>
              <TableCell className="text-sm">{row.formCue}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
