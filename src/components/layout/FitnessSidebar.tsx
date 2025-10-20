import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuAction,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Plus, 
  History, 
  Brain,
  MoreHorizontal,
  Trash2
} from 'lucide-react';

// Interface for workout history items
interface WorkoutHistoryItem {
  id: number;
  title: string;
  createdAt: string;
  data?: any;
}

// Placeholder user profile data
const userProfile = {
  name: "John Doe",
  email: "john@example.com",
  avatar: null,
  initials: "JD"
};

interface FitnessSidebarProps {
  onNewWorkout: () => void;
  onSelectWorkout: (id: number) => void;
  onDeleteWorkout: (id: number) => void;
  selectedWorkoutId?: number;
  workoutHistory: WorkoutHistoryItem[];
}

export function FitnessSidebar({ onNewWorkout, onSelectWorkout, onDeleteWorkout, selectedWorkoutId, workoutHistory }: FitnessSidebarProps) {

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 p-2">
          <Brain className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg font-sans">AI Fitness</span>
        </div>
        
        {/* New Workout Button */}
        <div className="p-2">
          <Button 
            onClick={onNewWorkout}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Workout
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* History Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70 font-medium">
            <History className="h-4 w-4 mr-2" />
            History
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workoutHistory.map((workout) => (
                <SidebarMenuItem key={workout.id}>
                  <SidebarMenuButton
                    onClick={() => onSelectWorkout(workout.id)}
                    isActive={selectedWorkoutId === workout.id}
                    className="flex items-center gap-2 p-2 hover:bg-sidebar-accent"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-medium truncate">
                          {workout.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(workout.createdAt)}
                        </span>
                      </div>
                    </div>
                  </SidebarMenuButton>
                  
                  <SidebarMenuAction showOnHover asChild>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-6 w-6 p-0">
                        <MoreHorizontal className="h-3 w-3" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteWorkout(workout.id);
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuAction>
                </SidebarMenuItem>
              ))}
              
              {workoutHistory.length === 0 && (
                <div className="px-2 py-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    No workout programs yet
                  </p>
                </div>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton className="flex items-center gap-2 p-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={userProfile.avatar || undefined} />
                    <AvatarFallback className="text-xs font-mono">
                      {userProfile.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium truncate">
                      {userProfile.name}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {userProfile.email}
                    </span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  );
}
