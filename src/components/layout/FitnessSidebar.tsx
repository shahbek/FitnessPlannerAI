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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  Plus,
  MoreHorizontal,
  Trash2,
  LogOut,
  User,
  Settings,
  ChevronRight,
  Coins,
  Dumbbell,
} from 'lucide-react';
import logoIcon from '@/assets/logo.svg';
import { signOut } from '@/lib/auth-client';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useToast } from '@/components/ui/use-toast';
import { useState } from 'react';

// Interface for workout history items
interface WorkoutHistoryItem {
  id: number;
  title: string;
  createdAt: string;
  data?: any;
  convexId?: any;
}

type NavigationView = 'home' | 'settings' | 'settings-account' | 'settings-tokens';

interface FitnessSidebarProps {
  onNewWorkout: () => void;
  onSelectWorkout: (id: number) => void;
  onDeleteWorkout: (id: number) => void;
  onNavigate?: (view: NavigationView) => void;
  currentView?: NavigationView;
  selectedWorkoutId?: number;
  workoutHistory: WorkoutHistoryItem[];
}

export function FitnessSidebar({
  onNewWorkout,
  onSelectWorkout,
  onDeleteWorkout,
  onNavigate,
  currentView = 'home',
  selectedWorkoutId,
  workoutHistory
}: FitnessSidebarProps) {
  const { toast } = useToast();
  const user = useQuery(api.users.getCurrentUser);
  const [settingsOpen, setSettingsOpen] = useState(
    currentView?.startsWith('settings') ?? false
  );

  const handleSignOut = async () => {
    try {
      console.log('🚪 Nuclear Logout initiated...');

      // 1. Clear Local State IMMEDIATELY (Prevent any UI flickering or re-saves)
      localStorage.removeItem('fitness_planner_user_cache');
      localStorage.clear();
      sessionStorage.clear();

      // 2. Call Server Sign Out
      await signOut();

      console.log('✅ Server Sign Out complete');

    } catch (error: any) {
      console.error('❌ Sign out error (ignoring and forcing reload):', error);
    } finally {
      // 3. FORCE HARD RELOAD (No SPA navigation)
      // This wipes the memory state of React query, ensuring a fresh boot.
      window.location.href = '/';
    }
  };

  const handleNavigate = (view: NavigationView) => {
    if (view.startsWith('settings')) {
      setSettingsOpen(true);
    }
    onNavigate?.(view);
    // Also clear workout selection when navigating away
    // Don't call onSelectWorkout with 0 - that might cause issues
    if (view !== 'home' && selectedWorkoutId) {
      // Clear selection by setting to undefined, not 0
      // onSelectWorkout will be handled by parent
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 p-2">
          <img src={logoIcon} alt="Supercomp Logo" className="h-8 w-8" />
          <span className="font-bold text-lg font-editorial">Supercomp</span>
        </div>

        {/* New Workout Button */}
        <div className="p-2">
          <Button
            onClick={onNewWorkout}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Program
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* ✅ Settings Section with Sub-menu */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <Collapsible
                  open={settingsOpen}
                  onOpenChange={setSettingsOpen}
                >
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      onClick={() => handleNavigate('settings')}
                      isActive={currentView?.startsWith('settings')}
                    >
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                      <ChevronRight
                        className={cn(
                          "ml-auto transition-transform",
                          settingsOpen && "rotate-90"
                        )}
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          onClick={() => handleNavigate('settings-account')}
                          isActive={currentView === 'settings-account'}
                        >
                          <User className="h-4 w-4" />
                          <span>Account</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          onClick={() => handleNavigate('settings-tokens')}
                          isActive={currentView === 'settings-tokens'}
                        >
                          <Coins className="h-4 w-4" />
                          <span>Tokens</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* History Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70 font-medium text-[1.15rem] font-editorial">
            Your Plans
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workoutHistory.map((workout) => {
                return (
                  <SidebarMenuItem key={workout.convexId ? `convex-${workout.convexId}` : `workout-${workout.id}`}>
                    <SidebarMenuButton
                      onClick={() => onSelectWorkout(workout.id)}
                      isActive={selectedWorkoutId === workout.id}
                      className={cn(
                        "group relative",
                        workout.data?.isGenerating && "animate-pulse bg-primary/5"
                      )}
                    >
                      <div className="flex items-center justify-between w-full min-w-0">
                        <span className="text-sm font-medium truncate flex-1">
                          {workout.title}
                          {workout.data?.isGenerating && (
                            <span className="ml-2 text-xs text-muted-foreground font-normal italic">
                              Generating...
                            </span>
                          )}
                        </span>

                        {/* Actions Menu - Hide when generating */}
                        {!workout.data?.isGenerating && (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-sidebar-accent h-7 w-7 p-0 opacity-0 group-hover:opacity-100 flex-shrink-0 ml-2"
                            >
                              <MoreHorizontal className="h-4 w-4" />
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
                        )}
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {workoutHistory.length === 0 && (
                <div className="px-4 py-12 text-center">
                  <div className="mx-auto w-16 h-16 rounded-full bg-sidebar-accent flex items-center justify-center mb-4 opacity-50">
                    <Dumbbell className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-sidebar-foreground mb-1">
                    No workout programs yet
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Create your first plan to get started
                  </p>
                  <Button
                    onClick={onNewWorkout}
                    size="sm"
                    variant="outline"
                    className="gap-2"
                  >
                    <Plus className="h-3 w-3" />
                    New Plan
                  </Button>
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton className="flex items-center gap-2 p-2 hover:bg-sidebar-accent cursor-pointer">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={user?.image || undefined} />
                        <AvatarFallback className="text-xs font-mono">
                          {user?.name ? getInitials(user.name) : 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-medium truncate">
                          {user?.name || 'User'}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {user?.email || 'user@example.com'}
                        </span>
                      </div>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem disabled>
                      <User className="h-4 w-4 mr-2" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive cursor-pointer">
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  );
}
