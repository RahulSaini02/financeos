"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eye, EyeOff, Loader2 } from "lucide-react";

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export function LoginForm () {
  const [email, setEmail] = useState( "" );
  const [password, setPassword] = useState( "" );
  const [showPassword, setShowPassword] = useState( false );
  const [isLoading, setIsLoading] = useState( false );
  const [isGoogleLoading, setIsGoogleLoading] = useState( false );
  const [isNavigating, setIsNavigating] = useState( false );
  const [isSignUp, setIsSignUp] = useState( false );
  const [fullName, setFullName] = useState( "" );
  const [error, setError] = useState<string | null>( null );
  const [message, setMessage] = useState<string | null>( null );

  // Show overlay for at least 400ms so it's visible, then navigate
  useEffect( () => {
    if ( !isNavigating ) return;
    const id = setTimeout( () => {
      window.location.href = "/dashboard";
    }, 400 );
    return () => clearTimeout( id );
  }, [isNavigating] );

  async function handleGoogleSignIn() {
    setIsGoogleLoading( true );
    setError( null );
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth( {
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    } );
    if ( error ) {
      setError( error.message );
      setIsGoogleLoading( false );
    }
    // On success, Supabase immediately redirects the browser to Google's consent page —
    // keep isGoogleLoading=true (spinner stays) and let Supabase handle the redirect
  }

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
        setIsLoading( false );
      } else {
        const { error } = await supabase.auth.signInWithPassword( { email, password } );
        if ( error ) throw error;
        setIsNavigating( true );
      }
    } catch ( err: unknown ) {
      setError( err instanceof Error ? err.message : "An error occurred" );
      setIsLoading( false );
    }
  }

  if ( isNavigating ) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-[var(--color-bg-primary)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-accent)]" />
        <p className="text-sm text-[var(--color-text-secondary)]">Signing you in…</p>
      </div>
    );
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

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--color-border)]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[var(--color-bg-secondary)] px-2 text-xs text-[var(--color-text-muted)]">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading}
            className="w-full flex items-center justify-center gap-2.5 h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-primary)] transition-colors disabled:opacity-50"
          >
            {isGoogleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
            Continue with Google
          </button>

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
