import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PhaseProgressionRow } from '@/utils/workoutDataParser';

interface PhaseProgressionTableProps {
  data: PhaseProgressionRow[];
}

export function PhaseProgressionTable({ data }: PhaseProgressionTableProps) {
  const getPhaseColor = (phaseNumber: number) => {
    const colors = [
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800',
      'bg-purple-100 text-purple-800',
      'bg-orange-100 text-orange-800',
      'bg-pink-100 text-pink-800',
      'bg-indigo-100 text-indigo-800'
    ];
    
    return colors[(phaseNumber - 1) % colors.length];
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Phase</TableHead>
            <TableHead>Phase Name</TableHead>
            <TableHead className="w-[120px]">Duration (weeks)</TableHead>
            <TableHead>Focus</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((phase, index) => (
            <TableRow key={phase.phaseNumber || index}>
              <TableCell>
                <Badge className={getPhaseColor(phase.phaseNumber)}>
                  Phase {phase.phaseNumber}
                </Badge>
              </TableCell>
              <TableCell className="font-medium">{phase.name}</TableCell>
              <TableCell className="text-center">{phase.durationWeeks} weeks</TableCell>
              <TableCell className="text-sm">{phase.focus}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
