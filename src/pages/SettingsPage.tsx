import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/Label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/Progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { 
  Save, 
  Coins, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Calendar, 
  Activity,
  AlertTriangle,
  CheckCircle2,
  ShoppingCart,
  Clock,
  BarChart3
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

type SettingsView = 'account' | 'tokens';

interface SettingsPageProps {
  currentView?: SettingsView;
  onViewChange?: (view: SettingsView) => void;
}

export function SettingsPage({ currentView = 'account', onViewChange }: SettingsPageProps) {
  const user = useQuery(api.users.getCurrentUser);
  const updateUserProfile = useMutation(api.users.updateUserProfile);
  const userAccount = useQuery(api.accounts.getUserAccount);
  const tokenUsage = useQuery(api.accounts.getTokenUsage, { limit: 100 });
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Calculate usage statistics from tokenUsage (moved to top level for Rules of Hooks)
  const usageStats = useMemo(() => {
    if (!tokenUsage || tokenUsage.length === 0) {
      return {
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
        total: 0,
        averagePerDay: 0,
      };
    }

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;

    const today = tokenUsage
      .filter(u => now - u.createdAt < oneDay)
      .reduce((sum, u) => sum + u.tokensUsed, 0);
    
    const thisWeek = tokenUsage
      .filter(u => now - u.createdAt < oneWeek)
      .reduce((sum, u) => sum + u.tokensUsed, 0);
    
    const thisMonth = tokenUsage
      .filter(u => now - u.createdAt < oneMonth)
      .reduce((sum, u) => sum + u.tokensUsed, 0);
    
    const total = tokenUsage.reduce((sum, u) => sum + u.tokensUsed, 0);
    const daysWithUsage = Math.max(1, Math.ceil((now - Math.min(...tokenUsage.map(u => u.createdAt))) / oneDay));
    const averagePerDay = total / daysWithUsage;

    return { today, thisWeek, thisMonth, total, averagePerDay };
  }, [tokenUsage]);

  // Update local state when user data loads
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setImageUrl(user.image || '');
    }
  }, [user]);

  // Show loading state while data is being fetched
  if (user === undefined || (currentView === 'tokens' && userAccount === undefined)) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Please wait while we load your settings.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSave = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      await updateUserProfile({
        name: name.trim() || undefined,
        image: imageUrl.trim() || undefined,
      });
      
      toast({
        title: "Profile updated",
        description: "Your changes have been saved successfully.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Failed to update profile",
        description: "Please try again. If the problem persists, contact support.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
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

  if (currentView === 'account') {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[1.5rem] font-editorial">
              Account Settings
            </CardTitle>
            <CardDescription>
              Update your profile information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Profile Image */}
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={imageUrl || undefined} alt={name || 'User'} />
                <AvatarFallback className="text-2xl">
                  {name ? getInitials(name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2 flex-1">
                <Label htmlFor="image-url">Profile Image URL</Label>
                <Input
                  id="image-url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                />
                <p className="text-sm text-muted-foreground">
                  Enter a URL to your profile image
                </p>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            {/* Email (read-only) */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user?.email || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-sm text-muted-foreground">
                Email cannot be changed
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentView === 'tokens') {
    // Dummy data for demonstration
    const dummyTokenBalance = userAccount?.tokens ?? 1000;
    const dummyTotalPurchased = userAccount?.totalTokensPurchased ?? 1000;
    const dummyPlanType = userAccount?.planType ?? 'free';

    // Check if balance is low (less than 100 tokens or less than 10% of initial)
    const isLowBalance = dummyTokenBalance < 100 || dummyTokenBalance < (dummyTotalPurchased * 0.1);
    const balancePercentage = dummyTotalPurchased > 0 ? (dummyTokenBalance / dummyTotalPurchased) * 100 : 100;

    // Token packages (dummy data for UI)
    const tokenPackages = [
      { id: 'starter', name: 'Starter', tokens: 1000, price: 9.99, popular: false },
      { id: 'professional', name: 'Professional', tokens: 5000, price: 39.99, popular: true },
      { id: 'enterprise', name: 'Enterprise', tokens: 15000, price: 99.99, popular: false },
      { id: 'unlimited', name: 'Unlimited', tokens: 50000, price: 299.99, popular: false },
    ];

    // Operation costs (dummy data)
    const operationCosts = [
      { operation: 'Plan Generation', tokens: 500, description: 'Complete fitness plan generation' },
      { operation: 'Meal Plan Generation', tokens: 300, description: 'Nutritional meal plan creation' },
      { operation: 'Workout Analysis', tokens: 200, description: 'Detailed workout analysis' },
      { operation: 'Progress Update', tokens: 100, description: 'Update and adjust plan' },
      { operation: 'Quick Consultation', tokens: 50, description: 'AI fitness consultation' },
    ];

    // Format operation type for display
    const formatOperationType = (type: string) => {
      return type
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    };

    // Get plan badge variant
    const getPlanBadge = (plan: string) => {
      switch (plan.toLowerCase()) {
        case 'free':
          return <Badge variant="secondary">Free</Badge>;
        case 'basic':
          return <Badge className="bg-blue-500 text-white">Basic</Badge>;
        case 'premium':
          return <Badge className="bg-purple-500 text-white">Premium</Badge>;
        case 'enterprise':
          return <Badge className="bg-gold-500 text-white">Enterprise</Badge>;
        default:
          return <Badge variant="secondary">{plan}</Badge>;
      }
    };

    return (
      <div className="space-y-6">
        {/* Low Balance Warning */}
        {isLowBalance && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Low Token Balance</AlertTitle>
            <AlertDescription>
              You have {dummyTokenBalance.toLocaleString()} tokens remaining. 
              Consider purchasing more tokens to continue using the service.
            </AlertDescription>
          </Alert>
        )}

        {/* Token Balance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-sm font-medium">Available Tokens</CardDescription>
                <Coins className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-4xl font-bold mt-2">
                {dummyTokenBalance.toLocaleString()}
              </CardTitle>
              <div className="mt-3">
                <Progress value={Math.min(balancePercentage, 100)} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {balancePercentage.toFixed(1)}% of total purchased
                </p>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-sm font-medium">Total Purchased</CardDescription>
                <Activity className="h-5 w-5 text-muted-foreground" />
              </div>
              <CardTitle className="text-4xl font-bold mt-2">
                {dummyTotalPurchased.toLocaleString()}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-3">
                Lifetime tokens acquired
              </p>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-sm font-medium">Current Plan</CardDescription>
                <Zap className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="mt-2">
                {getPlanBadge(dummyPlanType)}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {dummyPlanType === 'free' ? 'Upgrade for more benefits' : 'Active subscription'}
              </p>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-sm font-medium">Usage Today</CardDescription>
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <CardTitle className="text-4xl font-bold mt-2 text-green-600">
                {usageStats.today.toLocaleString()}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-3">
                Average: {Math.round(usageStats.averagePerDay).toLocaleString()}/day
              </p>
            </CardHeader>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="purchase">Purchase Tokens</TabsTrigger>
            <TabsTrigger value="history">Usage History</TabsTrigger>
            <TabsTrigger value="pricing">Pricing Guide</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Usage Statistics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Usage Statistics
                </CardTitle>
                <CardDescription>
                  Track your token consumption over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">This Week</span>
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    </div>
                    <p className="text-2xl font-bold">{usageStats.thisWeek.toLocaleString()}</p>
                    <Progress 
                      value={Math.min((usageStats.thisWeek / 1000) * 100, 100)} 
                      className="h-2" 
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">This Month</span>
                      <Activity className="h-4 w-4 text-blue-600" />
                    </div>
                    <p className="text-2xl font-bold">{usageStats.thisMonth.toLocaleString()}</p>
                    <Progress 
                      value={Math.min((usageStats.thisMonth / 5000) * 100, 100)} 
                      className="h-2" 
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">All Time</span>
                      <TrendingDown className="h-4 w-4 text-purple-600" />
                    </div>
                    <p className="text-2xl font-bold">{usageStats.total.toLocaleString()}</p>
                    <Progress 
                      value={Math.min((usageStats.total / dummyTotalPurchased) * 100, 100)} 
                      className="h-2" 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
                <CardDescription>
                  Your latest token usage transactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tokenUsage && tokenUsage.length > 0 ? (
                  <div className="space-y-3">
                    {tokenUsage.slice(0, 5).map((usage) => (
                      <div
                        key={usage._id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Activity className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{formatOperationType(usage.operationType)}</p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(usage.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-destructive">
                            -{usage.tokensUsed.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">tokens</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">No token usage recorded yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your token usage will appear here after your first operation
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Purchase Tokens Tab */}
          <TabsContent value="purchase" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Purchase Token Packages
                </CardTitle>
                <CardDescription>
                  Choose a package that fits your needs. Tokens never expire.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {tokenPackages.map((pkg) => (
                    <Card
                      key={pkg.id}
                      className={`relative border-2 transition-all hover:shadow-lg ${
                        pkg.popular 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border'
                      }`}
                    >
                      {pkg.popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <Badge className="bg-primary text-white">Most Popular</Badge>
                        </div>
                      )}
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xl">{pkg.name}</CardTitle>
                        <div className="mt-4">
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold">${pkg.price}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {pkg.tokens.toLocaleString()} tokens
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            ${(pkg.price / pkg.tokens).toFixed(4)} per token
                          </p>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Button 
                          className="w-full" 
                          variant={pkg.popular ? 'default' : 'outline'}
                          disabled
                        >
                          Purchase
                        </Button>
                        <p className="text-xs text-muted-foreground text-center mt-2">
                          Payment integration coming soon
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Usage History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Complete Usage History
                </CardTitle>
                <CardDescription>
                  Detailed log of all token transactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tokenUsage && tokenUsage.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Operation</TableHead>
                          <TableHead>Date & Time</TableHead>
                          <TableHead className="text-right">Tokens Used</TableHead>
                          <TableHead className="text-right">Remaining</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tokenUsage.map((usage, index) => {
                          // Calculate remaining tokens (approximate, would be from details in real implementation)
                          const remainingAfter = dummyTokenBalance + tokenUsage.slice(0, index + 1).reduce((sum, u) => sum + u.tokensUsed, 0);
                          
                          return (
                            <TableRow key={usage._id}>
                              <TableCell className="font-medium">
                                {formatOperationType(usage.operationType)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm">
                                    {new Date(usage.createdAt).toLocaleString()}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-semibold text-destructive">
                                -{usage.tokensUsed.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {remainingAfter.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">No usage history available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pricing Guide Tab */}
          <TabsContent value="pricing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Operation Cost Breakdown
                </CardTitle>
                <CardDescription>
                  Understanding how tokens are used for different operations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {operationCosts.map((cost, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{cost.operation}</h4>
                          <Badge variant="secondary">{cost.tokens} tokens</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{cost.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-lg font-semibold">{cost.tokens}</p>
                        <p className="text-xs text-muted-foreground">tokens</p>
                      </div>
                    </div>
                  ))}
                </div>
                
                <Separator className="my-6" />
                
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Token Economy
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
                    <li>Tokens are only consumed when you generate new plans or content</li>
                    <li>Viewing existing plans does not consume tokens</li>
                    <li>Tokens never expire - use them at your own pace</li>
                    <li>More complex plans may require additional tokens</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return null;
}
