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
import { updateUser as updateAuthUser } from '@/lib/auth-client';
import { 
  Save, 
  Coins, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Activity,
  AlertTriangle,
  CheckCircle2,
  ShoppingCart,
  BarChart3,
  Upload,
  X
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { PurchaseTokensButton } from '@/components/payments/PurchaseTokensButton';

type SettingsView = 'account' | 'tokens';

interface SettingsPageProps {
  currentView?: SettingsView;
  onViewChange?: (view: SettingsView) => void;
}

export function SettingsPage({ currentView = 'account', onViewChange }: SettingsPageProps) {
  const user = useQuery(api.users.getCurrentUser);
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const getImageUrl = useMutation(api.users.getImageUrl);
  const initializeAccount = useMutation(api.accounts.initializeAccount);
  const syncAccountEmail = useMutation(api.accounts.syncAccountEmail);
  const userAccount = useQuery(api.accounts.getUserAccount);
  const tokenUsage = useQuery(api.accounts.getTokenUsage, { limit: 100 });
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Ensure a user account exists (needed for email-based Stripe crediting)
  useEffect(() => {
    if (!user || currentView !== 'tokens') return;

    if (userAccount === null) {
      initializeAccount().catch(() => {});
    } else if (userAccount && !userAccount.email && user.email) {
      syncAccountEmail().catch(() => {});
    }
  }, [user, currentView, userAccount, initializeAccount, syncAccountEmail]);

  // Handle Stripe return URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const success = params.get('success');
    const canceled = params.get('canceled');

    if (success === 'true' && sessionId) {
      toast({
        title: "Payment successful!",
        description: "Your tokens have been added to your account. Please refresh to see your updated balance.",
        variant: "success",
      });
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      // Refresh user account data
      // The webhook should have already credited tokens, but refresh to show updated balance
    } else if (canceled === 'true') {
      toast({
        title: "Payment cancelled",
        description: "Your payment was cancelled. No tokens were charged.",
        variant: "default",
      });
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [toast]);

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

    // Filter and calculate only USAGE (negative tokens), not purchases
    const usageOnly = tokenUsage.filter(u => u.tokensUsed < 0);
    
    const today = Math.abs(usageOnly
      .filter(u => now - u.createdAt < oneDay)
      .reduce((sum, u) => sum + Math.abs(u.tokensUsed), 0));
    
    const thisWeek = Math.abs(usageOnly
      .filter(u => now - u.createdAt < oneWeek)
      .reduce((sum, u) => sum + Math.abs(u.tokensUsed), 0));
    
    const thisMonth = Math.abs(usageOnly
      .filter(u => now - u.createdAt < oneMonth)
      .reduce((sum, u) => sum + Math.abs(u.tokensUsed), 0));
    
    const total = Math.abs(usageOnly.reduce((sum, u) => sum + Math.abs(u.tokensUsed), 0));
    const daysWithUsage = Math.max(1, Math.ceil((now - Math.min(...usageOnly.map(u => u.createdAt))) / oneDay));
    const averagePerDay = total / daysWithUsage;

    return { today, thisWeek, thisMonth, total, averagePerDay };
  }, [tokenUsage]);

  // Update local state when user data loads
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setImagePreview(user.image || null);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    // If there's a current user image, allow removing it
    // Set to null to indicate removal
    if (user?.image) {
      setImagePreview(null);
    } else {
      setImagePreview(null);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    setIsSaving(true);
    setIsUploading(true);
    try {
      let imageStorageId: string | undefined;

      // Upload file if a new one is selected
      if (selectedFile) {
        try {
          // Get upload URL
          const uploadUrl = await generateUploadUrl();
          
          // Upload file
          const result = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": selectedFile.type },
            body: selectedFile,
          });
          
          if (!result.ok) {
            throw new Error("Failed to upload image");
          }

          // Get storage ID from response (Convex returns it as plain text)
          const storageId = await result.text();
          imageStorageId = storageId;
        } catch (error) {
          toast({
            title: "Failed to upload image",
            description: "Please try again.",
            variant: "destructive",
          });
          setIsUploading(false);
          setIsSaving(false);
          return;
        }
      }

      // Update profile through Better Auth
      const updateData: { name?: string; image?: string | null } = {};
      
      if (name.trim()) {
        updateData.name = name.trim();
      }
      
      // Handle image update
      if (imageStorageId) {
        // Get URL from storage ID
        const imageUrl = await getImageUrl({ imageStorageId: imageStorageId as any });
        updateData.image = imageUrl;
      } else if (imagePreview === null && user?.image && !selectedFile) {
        // User removed the image
        updateData.image = null;
      }

      // Update user through Better Auth HTTP API
      await updateAuthUser(updateData);
      
      // Clear selected file after successful save
      setSelectedFile(null);
      
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
      setIsUploading(false);
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
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={imagePreview || undefined} alt={name || 'User'} />
                  <AvatarFallback className="text-2xl">
                    {name ? getInitials(name) : 'U'}
                  </AvatarFallback>
                </Avatar>
                {imagePreview && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={handleRemoveImage}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="space-y-2 flex-1">
                <Label htmlFor="profile-image">Profile Picture</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="profile-image"
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('profile-image')?.click()}
                    disabled={isSaving || isUploading}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {selectedFile ? 'Change Image' : 'Upload Image'}
                  </Button>
                  {selectedFile && (
                    <span className="text-sm text-muted-foreground">
                      {selectedFile.name}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Upload a profile picture (max 5MB, JPG, PNG, etc.)
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
                disabled={isSaving || isUploading}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {isUploading ? 'Uploading...' : isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentView === 'tokens') {
    // Get actual account data (no free plan)
    const dummyTokenBalance = userAccount?.tokens ?? 0;
    const dummyTotalPurchased = userAccount?.totalTokensPurchased ?? 0;
    const dummyPlanType = userAccount?.planType ?? 'none';

    // Check if balance is low (less than 100 tokens or less than 10% of initial)
    const isLowBalance = dummyTokenBalance < 100 || dummyTokenBalance < (dummyTotalPurchased * 0.1);
    const balancePercentage = dummyTotalPurchased > 0 ? (dummyTokenBalance / dummyTotalPurchased) * 100 : 100;

    // Token packages - 90% profit margin pricing
    const tokenPackages = [
      { 
        id: 'starter', 
        name: 'Starter', 
        tokens: 700, 
        price: 10.00, 
        popular: false,
        plans: 7,
        description: 'Perfect for trying out the service'
      },
      { 
        id: 'professional', 
        name: 'Professional', 
        tokens: 2000, 
        price: 25.00, 
        popular: true,
        plans: 20,
        bonus: '20% bonus',
        description: 'Best value for regular users'
      },
      { 
        id: 'enterprise', 
        name: 'Enterprise', 
        tokens: 4500, 
        price: 50.00, 
        popular: false,
        plans: 45,
        bonus: '29% bonus',
        description: 'Maximum value for power users'
      },
    ];

    // Operation costs per plan generation step
    const operationCosts = [
      { operation: 'Complete Plan Generation', tokens: 100, description: 'Full plan (all 7 steps: feasibility + framework + exercises + sessions + meals + shopping)', isComplete: true },
      { operation: 'Feasibility Assessment', tokens: 10, description: 'Step 1: Goal validation and safety assessment', isComplete: false },
      { operation: 'Strategic Framework', tokens: 15, description: 'Step 2: Training & nutrition approach', isComplete: false },
      { operation: 'Weekly Outlines', tokens: 10, description: 'Step 3: Weekly progression plans', isComplete: false },
      { operation: 'Exercise Library', tokens: 15, description: 'Step 4: Phase-specific exercises', isComplete: false },
      { operation: 'Session Templates', tokens: 15, description: 'Step 5: Workout session structures', isComplete: false },
      { operation: 'Meal Templates', tokens: 20, description: 'Step 6: Groq reasoning (most expensive)', isComplete: false },
      { operation: 'Shopping Lists', tokens: 15, description: 'Step 7: Groq cost estimation', isComplete: false },
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
                {dummyPlanType === 'none' ? 'Purchase tokens to get started' : 'Active subscription'}
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
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Your latest token transactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tokenUsage && tokenUsage.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Operation</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Tokens</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tokenUsage.slice(0, 10).map((usage) => {
                          const isPurchase = usage.operationType === "token_purchase" || usage.tokensUsed > 0;
                          const tokensDisplay = Math.abs(usage.tokensUsed);
                          const status = (usage as any).status || "success";
                          
                          return (
                            <TableRow key={usage._id}>
                              <TableCell className="text-muted-foreground">
                                {new Date(usage.createdAt).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="font-medium">
                                {formatOperationType(usage.operationType)}
                              </TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  status === 'success' ? 'bg-muted text-foreground' :
                                  status === 'failed' ? 'bg-destructive/10 text-destructive' :
                                  'bg-muted text-muted-foreground'
                                }`}>
                                  {status.charAt(0).toUpperCase() + status.slice(1)}
                                </span>
                              </TableCell>
                              <TableCell className={`text-right font-medium tabular-nums ${isPurchase ? 'text-green-600' : ''}`}>
                                {isPurchase ? '+' : '-'}{tokensDisplay.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No activity recorded yet</p>
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
                            <span className="text-3xl font-bold">${pkg.price.toFixed(2)}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {pkg.tokens.toLocaleString()} tokens
                          </p>
                          <p className="text-xs font-medium text-primary mt-1">
                            ~{pkg.plans} plan{pkg.plans !== 1 ? 's' : ''}
                          </p>
                          {pkg.bonus && (
                            <Badge variant="secondary" className="mt-1 text-xs">
                              {pkg.bonus}
                            </Badge>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            ${(pkg.price / pkg.tokens).toFixed(4)} per token
                          </p>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <PurchaseTokensButton
                          packageId={pkg.id as "starter" | "professional" | "enterprise"}
                          packageName={pkg.name}
                          tokens={pkg.tokens}
                          price={pkg.price}
                          variant={pkg.popular ? 'default' : 'outline'}
                          className="w-full"
                        />
                        <p className="text-xs text-muted-foreground text-center mt-2">
                          Secure payment via Stripe
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
                <CardTitle>Usage History</CardTitle>
                <CardDescription>
                  Complete log of all token transactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tokenUsage && tokenUsage.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Operation</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Tokens</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tokenUsage.map((usage) => {
                          const isPurchase = usage.operationType === "token_purchase" || usage.tokensUsed > 0;
                          const tokensDisplay = Math.abs(usage.tokensUsed);
                          const status = (usage as any).status || "success";

                          return (
                            <TableRow key={usage._id}>
                              <TableCell className="text-muted-foreground whitespace-nowrap">
                                {new Date(usage.createdAt).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </TableCell>
                              <TableCell className="font-medium">
                                {formatOperationType(usage.operationType)}
                              </TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  status === 'success' ? 'bg-muted text-foreground' :
                                  status === 'failed' ? 'bg-destructive/10 text-destructive' :
                                  'bg-muted text-muted-foreground'
                                }`}>
                                  {status.charAt(0).toUpperCase() + status.slice(1)}
                                </span>
                              </TableCell>
                              <TableCell className={`text-right font-medium tabular-nums ${isPurchase ? 'text-green-600' : ''}`}>
                                {isPurchase ? '+' : '-'}{tokensDisplay.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8">
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
                    <div 
                      key={index} 
                      className={`flex items-center justify-between p-4 border rounded-lg ${
                        cost.isComplete ? 'bg-primary/5 border-primary/20' : ''
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{cost.operation}</h4>
                          <Badge variant={cost.isComplete ? "default" : "secondary"}>
                            {cost.tokens} tokens
                          </Badge>
                          {cost.isComplete && (
                            <Badge variant="outline" className="text-xs">Complete Plan</Badge>
                          )}
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
                    <li>Each complete plan generation costs 100 tokens (includes all 7 steps)</li>
                    <li>If generation fails, tokens are refunded after review</li>
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
