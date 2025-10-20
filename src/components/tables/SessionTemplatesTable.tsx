import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SessionTemplatesRow } from '@/utils/workoutDataParser';

interface SessionTemplatesTableProps {
  data: SessionTemplatesRow[];
}

export function SessionTemplatesTable({ data }: SessionTemplatesTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Template ID</TableHead>
            <TableHead>Session Name</TableHead>
            <TableHead>Duration (min)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((session, index) => (
            <TableRow key={session.templateId || index}>
              <TableCell className="font-mono text-sm">{session.templateId}</TableCell>
              <TableCell className="font-medium">{session.name}</TableCell>
              <TableCell>
                <Badge variant="outline">
                  {session.totalDurationMinutes} min
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
