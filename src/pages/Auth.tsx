import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, Mail, Lock, User, AlertCircle, CheckCircle } from "lucide-react";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from "@/lib/constants";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(8, "Password must be at least 8 characters");
const nameSchema = z.string().min(2, "Name must be at least 2 characters").max(50, "Name is too long");

const Auth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const [activeTab, setActiveTab] = useState(initialMode);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + getRedirectTarget(),
      },
    });

    if (error) {
      setMessage({ type: "error", text: "Couldn't start Google sign-in. Please try again." });
      setIsLoading(false);
    }
  };

  // Get the redirect target from ?next= param (validated for security)
  const getRedirectTarget = () => {
    const nextUrl = searchParams.get("next");
    // Security: only allow relative URLs, prevent open redirects
    if (nextUrl && nextUrl.startsWith("/") && !nextUrl.includes("//")) {
      return nextUrl;
    }
    return "/dashboard";
  };

  useEffect(() => {
    const redirectTarget = getRedirectTarget();
    
    // Check if user is already logged in
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate(redirectTarget);
      }
    };
    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate(redirectTarget);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, searchParams]);

  const validateForm = (isSignUp: boolean) => {
    const newErrors: Record<string, string> = {};

    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }

    if (isSignUp) {
      const nameResult = nameSchema.safeParse(fullName);
      if (!nameResult.success) {
        newErrors.fullName = nameResult.error.errors[0].message;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) return;

    setIsLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      let errorMessage = "Something went wrong. Please try again.";
      if (error.message.includes("Invalid login credentials")) {
        errorMessage = "Hmm, those details don't match. Double-check your email and password?";
      } else if (error.message.includes("Email not confirmed")) {
        errorMessage = "Please confirm your email before signing in.";
      }
      setMessage({ type: "error", text: errorMessage });
    }

    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(true)) return;

    setIsLoading(true);
    setMessage(null);

    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      let errorMessage = "Something went wrong. Please try again.";
      if (error.message.includes("already registered")) {
        errorMessage = "Looks like you've already got an account! Try signing in instead.";
      }
      setMessage({ type: "error", text: errorMessage });
    } else {
      setMessage({ 
        type: "success", 
        text: "Brilliant! Check your email to confirm your account. We promise it's not spam." 
      });
      toast({
        title: "Account created!",
        description: "Check your email to confirm your account.",
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background hero-pattern p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Back to Home */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        {/* Auth Card */}
        <Card className="border-0 shadow-card">
          <CardHeader className="space-y-4">
            <div className="flex justify-center">
              <Link to="/" className="flex items-center gap-3 group">
                <div className="relative">
                  <div className="w-12 h-12 bg-primary border-4 border-foreground shadow-brutal flex items-center justify-center group-hover:-translate-y-0.5 group-hover:-translate-x-0.5 group-hover:shadow-brutal-lg transition-all duration-150">
                    <span className="font-display text-2xl text-primary-foreground">O</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="font-display text-2xl tracking-tight">OCCTA</span>
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                    Telecom That Gets It
                  </span>
                </div>
              </Link>
            </div>
            <CardTitle className="text-2xl font-display">
              {activeTab === "signin" ? "Welcome back!" : "Join the club"}
            </CardTitle>
            <CardDescription>
              {activeTab === "signin" 
                ? "Good to see you again. Let's get you logged in." 
                : "Create an account to manage your services, view bills, and more."
              }
            </CardDescription>
          </CardHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <CardContent className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.12c-.22-.66-.35-1.36-.35-2.12s.13-1.46.35-2.12V7.04H2.18A10.99 10.99 0 0 0 1 12c0 1.77.42 3.45 1.18 4.96l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
                </svg>
                Continue with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              {/* Messages */}
              {message && (
                <div className={`flex items-start gap-3 p-4 rounded-lg ${
                  message.type === "success" 
                    ? "bg-success/10 text-success border border-success/20" 
                    : "bg-destructive/10 text-destructive border border-destructive/20"
                }`}>
                  {message.type === "success" ? (
                    <CheckCircle className="w-5 h-5 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 mt-0.5" />
                  )}
                  <p className="text-sm">{message.text}</p>
                </div>
              )}

              <TabsContent value="signin" className="space-y-4 mt-0">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signin-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                  </div>
                  <Button type="submit" variant="hero" className="w-full" disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4 mt-0">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Your name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Min. 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                  </div>
                  <Button type="submit" variant="hero" className="w-full" disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
          
          <CardFooter className="flex flex-col space-y-4">
            <p className="text-xs text-center text-muted-foreground">
              By continuing, you agree to our{" "}
              <Link to="/terms" className="underline hover:text-primary">Terms of Service</Link>
              {" "}and{" "}
              <Link to="/privacy" className="underline hover:text-primary">Privacy Policy</Link>
              .
            </p>
          </CardFooter>
        </Card>

        {/* Help Text */}
        <p className="text-center text-sm text-muted-foreground">
          Need help? Call us free on{" "}
          <a href={CONTACT_PHONE_TEL} className="font-medium text-primary hover:underline">
            {CONTACT_PHONE_DISPLAY}
          </a>
        </p>
      </div>
    </div>
  );
};

export default Auth;
