import { FormEvent, useState } from "react";
import { BrainCircuit, Chrome, Loader2, LockKeyhole, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

const Auth = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: displayName || email },
          },
        });
        if (signUpError) throw signUpError;
        setMessage("Check your email to confirm your account.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        navigate("/workspace");
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) setError(result.error.message);
  };

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <Card className="w-full max-w-md animate-fade-up overflow-hidden">
        <CardHeader>
          <div className="mb-3 grid size-14 place-items-center rounded-lg bg-gradient-accent text-primary-foreground shadow-glow">
            <BrainCircuit className="size-7" />
          </div>
          <CardTitle className="text-3xl">Access CANAI</CardTitle>
          <CardDescription>Secure workspace login for diagnostics, fleet records, and saved analysis history.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={mode} onValueChange={(value) => setMode(value as "signin" | "signup")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>
            <TabsContent value={mode}>
              <form className="mt-5 space-y-4" onSubmit={submit}>
                {mode === "signup" ? (
                  <div className="space-y-2">
                    <Label htmlFor="display-name">Display name</Label>
                    <Input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Alex Rivera" maxLength={100} />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="pl-9" required maxLength={255} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="pl-9" required minLength={8} maxLength={128} />
                  </div>
                </div>
                {error ? <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
                {message ? <div className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">{message}</div> : null}
                <Button type="submit" variant="analyzer" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="animate-spin" /> : null}
                  {mode === "signup" ? "Create account" : "Login"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          <Button type="button" variant="outline" className="mt-4 w-full" onClick={signInWithGoogle}>
            <Chrome className="size-4" /> Continue with Google
          </Button>
        </CardContent>
      </Card>
    </main>
  );
};

export default Auth;
