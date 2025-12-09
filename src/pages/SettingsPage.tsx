import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { updateUser as updateAuthUser } from '@/lib/auth-client';
import {
  Save,
  AlertTriangle,
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
      initializeAccount().catch(() => { });
    } else if (userAccount && !userAccount.email && user.email) {
      syncAccountEmail().catch(() => { });
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
    // Get actual account data
    const tokenBalance = userAccount?.tokens ?? 0;
    const totalPurchased = userAccount?.totalTokensPurchased ?? 0;

    // Check if balance is low (less than 100 tokens)
    const isLowBalance = tokenBalance < 100;
    
    // Calculate plans remaining (100 tokens per plan)
    const plansRemaining = Math.floor(tokenBalance / 100);

    // Format operation type for display - simplified
    const formatOperationType = (type: string) => {
      // Map internal types to user-friendly names
      const typeMap: Record<string, string> = {
        'token_purchase': 'Tokens Purchased',
        'plan_generation': 'Plan Generated',
        'feasibility_check': 'Plan Generated',
        'training_framework': 'Plan Generated',
        'exercise_library': 'Plan Generated',
        'session_templates': 'Plan Generated',
        'meal_templates': 'Plan Generated',
        'shopping_list': 'Plan Generated',
      };
      return typeMap[type] || type
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    };

    return (
      <div className="space-y-8">
        {/* Low Balance Warning */}
        {isLowBalance && tokenBalance > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Low Token Balance</AlertTitle>
            <AlertDescription>
              You have {tokenBalance.toLocaleString()} tokens remaining ({plansRemaining} plan{plansRemaining !== 1 ? 's' : ''}).
            </AlertDescription>
          </Alert>
        )}

        {/* Balance Overview - Clean, minimal design */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Primary: Token Balance */}
          <div className="col-span-2 p-6 rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <p className="text-sm font-medium text-muted-foreground">Available Tokens</p>
            <p className="text-5xl font-bold tracking-tight mt-1">
              {tokenBalance.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              ≈ {plansRemaining} plan{plansRemaining !== 1 ? 's' : ''} remaining
            </p>
          </div>

          {/* Secondary stats */}
          <div className="p-5 rounded-xl border bg-card">
            <p className="text-sm font-medium text-muted-foreground">Total Purchased</p>
            <p className="text-3xl font-bold tracking-tight mt-1">
              {totalPurchased.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-2">lifetime</p>
          </div>

          <div className="p-5 rounded-xl border bg-card">
            <p className="text-sm font-medium text-muted-foreground">Used This Month</p>
            <p className="text-3xl font-bold tracking-tight mt-1">
              {usageStats.thisMonth.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {Math.floor(usageStats.thisMonth / 100)} plan{Math.floor(usageStats.thisMonth / 100) !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Two-tab structure */}
        <Tabs defaultValue="purchase" className="space-y-6">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="purchase" className="flex-1 sm:flex-none">Buy Tokens</TabsTrigger>
            <TabsTrigger value="history" className="flex-1 sm:flex-none">History</TabsTrigger>
          </TabsList>

          {/* Purchase Tab */}
          <TabsContent value="purchase" className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold">Token Packages</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Each plan costs 100 tokens. Tokens never expire.
              </p>
            </div>

            <div className="max-w-sm">
              <div className="p-6 rounded-xl border-2 border-primary bg-primary/5">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-lg">Starter Pack</h4>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-bold">$10</span>
                    </div>
                  </div>

                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>700 tokens</p>
                    <p className="font-medium text-foreground">~7 plans</p>
                  </div>

                  <PurchaseTokensButton
                    packageId="starter"
                    packageName="Starter"
                    tokens={700}
                    price={10.00}
                    variant="default"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            {tokenUsage && tokenUsage.length > 0 ? (
              <div className="space-y-1">
                {/* Header */}
                <div className="flex items-center gap-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <span className="w-32 shrink-0">Date</span>
                  <span className="flex-1">Description</span>
                  <span>Tokens</span>
                </div>
                {tokenUsage.map((usage) => {
                  const isPurchase = usage.operationType === "token_purchase" || usage.tokensUsed > 0;
                  const tokensDisplay = Math.abs(usage.tokensUsed);
                  const date = new Date(usage.createdAt);

                  return (
                    <div 
                      key={usage._id}
                      className="flex items-center gap-4 py-2.5 text-sm"
                    >
                      <span className="text-muted-foreground tabular-nums w-32 shrink-0">
                        {date.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}, {date.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="flex-1">
                        {formatOperationType(usage.operationType)}
                      </span>
                      <span className={`font-medium tabular-nums ${isPurchase ? 'text-green-600' : ''}`}>
                        {isPurchase ? '+' : '−'}{tokensDisplay.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>No transactions yet</p>
                <p className="text-sm mt-1">Purchase tokens to get started</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return null;
}
