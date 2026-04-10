"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export function LoginForm () {
  const router = useRouter();
  const [email, setEmail] = useState( "" );
  const [password, setPassword] = useState( "" );
  const [showPassword, setShowPassword] = useState( false );
  const [isLoading, setIsLoading] = useState( false );
  const [isSignUp, setIsSignUp] = useState( false );
  const [fullName, setFullName] = useState( "" );
  const [error, setError] = useState<string | null>( null );
  const [message, setMessage] = useState<string | null>( null );

  async function handleSubmit ( e: React.FormEvent ) {
    e.preventDefault();
    setError( null );
    setMessage( null );
    setIsLoading( true );

    const supabase = createClient();

    try {
      if ( isSignUp ) {
        const { error } = await supabase.auth.signUp( {
          email,
          password,
          options: { data: { full_name: fullName } },
        } );
        if ( error ) throw error;
        setMessage( "Check your email for a confirmation link." );
      } else {
        const { error } = await supabase.auth.signInWithPassword( { email, password } );
        if ( error ) throw error;
        router.push( "/dashboard" );
        router.refresh();
      }
    } catch ( err: unknown ) {
      setError( err instanceof Error ? err.message : "An error occurred" );
    } finally {
      setIsLoading( false );
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-[var(--color-bg-primary)] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">FinanceOS</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {isSignUp ? "Create your account" : "Sign in to your account"}
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Full Name</label>
                <input
                  type="text"
                  className="w-full h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 text-sm"
                  placeholder="Rahul Saini"
                  value={fullName}
                  onChange={( e ) => setFullName( e.target.value )}
                  required={isSignUp}
                />
              </div>
            )}

            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Email</label>
              <input
                type="email"
                className="w-full h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 text-sm"
                placeholder="you@example.com"
                value={email}
                onChange={( e ) => setEmail( e.target.value )}
                required
              />
            </div>

            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 pr-10 text-sm"
                  placeholder="••••••••"
                  value={password}
                  onChange={( e ) => setPassword( e.target.value )}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                  onClick={() => setShowPassword( !showPassword )}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-[var(--color-danger)] bg-[var(--color-danger)]/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {message && (
              <p className="text-xs text-[var(--color-success)] bg-[var(--color-success)]/10 rounded-lg px-3 py-2">
                {message}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isSignUp ? "Create Account" : "Sign In"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              className="text-xs text-[var(--color-accent)] hover:underline"
              onClick={() => { setIsSignUp( !isSignUp ); setError( null ); setMessage( null ); }}
            >
              {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
            </button>
          </div>
        </Card>

        <p className="text-center text-xs text-[var(--color-text-muted)] mt-6">
          Secure authentication powered by Supabase
        </p>
      </div>
    </div>
  );
}
