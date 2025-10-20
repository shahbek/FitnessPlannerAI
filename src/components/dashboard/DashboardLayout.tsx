import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/Sheet';
import { 
  Activity, 
  Brain, 
  Calendar, 
  ChevronRight, 
  Clock, 
  Download, 
  Dumbbell, 
  FileText, 
  Heart, 
  Menu, 
  Settings, 
  Target, 
  TrendingUp, 
  Users,
  Zap
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  plan?: any;
  loading?: boolean;
  progress?: any;
  error?: string;
}

export function DashboardLayout({ children, plan, loading, progress, error }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = [
    { name: 'Overview', href: '#', icon: Activity, current: true },
    { name: 'Training Plan', href: '#', icon: Dumbbell, current: false },
    { name: 'Nutrition Plan', href: '#', icon: Heart, current: false },
    { name: 'Progress Tracking', href: '#', icon: TrendingUp, current: false },
    { name: 'Scientific Evidence', href: '#', icon: Brain, current: false },
    { name: 'Settings', href: '#', icon: Settings, current: false },
  ];

  const stats = [
    { name: 'Confidence Score', value: plan?.feasibility?.confidenceScore ? `${Math.round(plan.feasibility.confidenceScore * 100)}%` : 'N/A', icon: Target },
    { name: 'Exercise Library', value: plan?.exerciseLibrary?.length || 0, icon: Dumbbell },
    { name: 'Session Templates', value: plan?.sessionTemplates?.length || 0, icon: Calendar },
    { name: 'Meal Templates', value: plan?.mealTemplates?.length || 0, icon: Heart },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              Fitness Planner AI
            </SheetTitle>
          </SheetHeader>
          <nav className="mt-6 space-y-1">
            {navigation.map((item) => (
              <Button
                key={item.name}
                variant={item.current ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="mr-3 h-4 w-4" />
                {item.name}
              </Button>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      <div className="flex">
        {/* Desktop sidebar */}
        <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
          <div className="flex flex-col flex-grow bg-card border-r pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4">
              <Brain className="h-8 w-8 text-primary" />
              <span className="ml-2 text-xl font-bold">Fitness Planner AI</span>
            </div>
            <nav className="mt-8 flex-1 px-2 space-y-1">
              {navigation.map((item) => (
                <Button
                  key={item.name}
                  variant={item.current ? "default" : "ghost"}
                  className="w-full justify-start"
                >
                  <item.icon className="mr-3 h-4 w-4" />
                  {item.name}
                </Button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main content */}
        <div className="lg:pl-64 flex flex-col flex-1">
          {/* Top navigation */}
          <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b bg-background px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
              <div className="flex flex-1 items-center">
                <h1 className="text-2xl font-bold">AI Fitness Dashboard</h1>
              </div>
              <div className="flex items-center gap-x-4 lg:gap-x-6">
                {plan && (
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export Plan
                  </Button>
                )}
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </div>
            </div>
          </div>

          {/* Main content area */}
          <main className="flex-1">
            <div className="py-6">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                {/* Status alerts */}
                {error && (
                  <Alert variant="destructive" className="mb-6">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {loading && progress && (
                  <Card className="mb-6 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                      <span className="font-medium">{progress.currentStep}</span>
                    </div>
                    <Progress value={progress.progress} className="mb-4" />
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {progress.reasoning.map((reason, index) => (
                        <div key={`reasoning-${index}-${reason.substring(0, 20)}`} className="flex items-center gap-2">
                          <ChevronRight className="h-3 w-3" />
                          {reason}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Stats overview */}
                {plan && (
                  <div className="mb-8">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                      {stats.map((stat) => (
                        <Card key={stat.name} className="p-6">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <stat.icon className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                              <dl>
                                <dt className="text-sm font-medium text-muted-foreground truncate">
                                  {stat.name}
                                </dt>
                                <dd className="text-lg font-medium text-foreground">
                                  {stat.value}
                                </dd>
                              </dl>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Main content */}
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
