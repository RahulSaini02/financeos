"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

const HERO_TYPED = "finally intelligent";

export default function HeroSection () {
  const [typed, setTyped] = useState( "" );
  const [doneTyping, setDoneTyping] = useState( false );
  const [showCursor, setShowCursor] = useState( true );
  const sectionRef = useRef<HTMLElement>( null );
  const [pos, setPos] = useState( { x: 50, y: 15 } );

  const handleMouseMove = useCallback( ( e: React.MouseEvent<HTMLElement> ) => {
    const rect = sectionRef.current?.getBoundingClientRect();
    if ( !rect ) return;
    const x = ( ( e.clientX - rect.left ) / rect.width ) * 100;
    const y = ( ( e.clientY - rect.top ) / rect.height ) * 100;
    setPos( { x, y } );
  }, [] );

  const handleMouseLeave = useCallback( () => {
    setPos( { x: 50, y: 15 } );
  }, [] );

  useEffect( () => {
    let i = 0;
    const startDelay = setTimeout( () => {
      const interval = setInterval( () => {
        i++;
        setTyped( HERO_TYPED.slice( 0, i ) );
        if ( i >= HERO_TYPED.length ) {
          clearInterval( interval );
          setDoneTyping( true );
          setTimeout( () => setShowCursor( false ), 2500 );
        }
      }, 65 );
      return () => clearInterval( interval );
    }, 700 );

    return () => clearTimeout( startDelay );
  }, [] );

  return (
    <section
      id="hero"
      ref={sectionRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative min-h-screen flex items-center py-20 lg:py-0 bg-[var(--color-bg-primary)] overflow-hidden"
    >
      {/* Dot-grid background pattern */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
        }}
      />

      {/* Mouse-tracking primary orb */}
      <div
        aria-hidden
        className="pointer-events-none absolute w-[700px] h-[700px] rounded-full -translate-x-1/2 -translate-y-1/2"
        style={{
          left: `${ pos.x }%`,
          top: `${ pos.y }%`,
          background: "radial-gradient(circle, rgba(79,70,229,0.28) 0%, rgba(79,70,229,0.10) 60%, transparent 80%)",
          filter: "blur(80px)",
          transition: "left 0.18s ease, top 0.18s ease",
        }}
      />

      {/* Secondary counter-orb */}
      <div
        aria-hidden
        className="pointer-events-none absolute w-[400px] h-[400px] rounded-full -translate-x-1/2 -translate-y-1/2"
        style={{
          left: `${ 100 - pos.x }%`,
          top: `${ 100 - pos.y }%`,
          background: "radial-gradient(circle, rgba(245,158,11,0.14) 0%, transparent 70%)",
          filter: "blur(80px)",
          transition: "left 0.3s ease, top 0.3s ease",
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center w-full">
        {/* Left column — copy */}
        <div>
          {/* Badge with gradient border */}
          <div
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full mb-6 hero-fade-in"
            style={{
              animationDelay: "0ms",
              background: "linear-gradient(var(--color-bg-secondary), var(--color-bg-secondary)) padding-box, linear-gradient(135deg, rgba(79,70,229,0.6), rgba(245,158,11,0.4)) border-box",
              border: "1px solid transparent",
              color: "var(--color-text-muted)",
            }}
          >
            <span className="text-[var(--color-accent)]">✦</span>
            <span>MyFinOS · Powered by Claude AI</span>
          </div>

          {/* Headline */}
          <h1
            suppressHydrationWarning
            className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.05] text-[var(--color-text-primary)] hero-fade-in"
            style={{ animationDelay: "100ms" }}
          >
            Your finances,
            <br />
            <span suppressHydrationWarning className="bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-warning)] bg-clip-text text-transparent">
              {typed || HERO_TYPED}
            </span>
            {showCursor && (
              <span
                className={`inline-block w-[3px] h-[0.85em] rounded-sm align-middle ml-1 bg-[var(--color-accent)] ${ doneTyping ? "cursor-blink" : "" }`}
              />
            )}
          </h1>

          {/* Sub-copy */}
          <p
            className="text-lg text-[var(--color-text-secondary)] mt-5 hero-fade-in max-w-lg"
            style={{ animationDelay: "200ms" }}
          >
            Stop guessing where your money goes. MyFinOS tracks every account,
            auto-categorizes every dollar, and lets a Claude AI agent answer
            questions and set budgets on your behalf.
          </p>

          {/* CTAs */}
          <div
            className="flex gap-3 flex-wrap mt-8 hero-fade-in"
            style={{ animationDelay: "300ms" }}
          >
            <Link
              href="/login?signup=true"
              className="bg-[var(--color-accent)] text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity"
            >
              Start for free →
            </Link>
            <a
              href="#how-it-works"
              className="border border-[var(--color-border)] text-[var(--color-text-secondary)] px-6 py-3 rounded-xl hover:bg-[var(--color-bg-secondary)] transition-colors"
            >
              See how it works ↓
            </a>
          </div>

          {/* Trust line */}
          <p
            className="mt-4 text-xs text-[var(--color-text-muted)] hero-fade-in"
            style={{ animationDelay: "400ms" }}
          >
            No credit card · Privacy-first · No third-party ads
          </p>
        </div>

        {/* Right column — CSS mini dashboard widget */}
        <div
          className="relative hero-fade-in"
          style={{ animationDelay: "500ms" }}
        >
          {/* Floating chips */}
          <div className="absolute -top-8 -left-6 flex items-center gap-1.5 bg-[var(--color-bg-secondary)] border border-[var(--color-success)]/30 rounded-full px-3 py-1.5 shadow-lg float-chip" aria-hidden>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
            <span className="text-xs font-semibold text-[var(--color-success)]">+$1,240 this month</span>
          </div>
          <div className="absolute -bottom-8 -right-4 flex items-center gap-1.5 bg-[var(--color-bg-secondary)] border border-[var(--color-accent)]/30 rounded-full px-3 py-1.5 shadow-lg float-chip-delay" aria-hidden>
            <span className="text-xs font-semibold text-[var(--color-accent)]">✦ AI Review ready</span>
          </div>

          {/* Glow behind widget */}
          <div
            aria-hidden
            className="absolute inset-0 bg-[var(--color-accent)]/5 rounded-3xl blur-3xl -z-10"
          />

          <div className="relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5 shadow-2xl lg:rotate-1 hover:rotate-0 transition-transform duration-300">
            {/* Floating AI badge */}
            <div className="absolute top-3 right-3 pulse-badge">
              <span className="inline-flex items-center gap-1 bg-[var(--color-accent)]/20 text-[var(--color-accent)] text-xs px-2 py-0.5 rounded-full">
                ✦ 3 insights
              </span>
            </div>

            {/* Net Worth header */}
            <div className="mb-4 pr-28">
              <p className="text-xs text-[var(--color-text-muted)] mb-1">Net Worth</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                $47,284.50
              </p>
              <p className="text-sm text-[var(--color-success)] mt-0.5">
                +$1,240 this month
              </p>
            </div>

            <div className="border-t border-[var(--color-border)] my-4" />

            {/* Transactions list */}
            <div className="space-y-3">
              {[
                { dot: "bg-purple-500", name: "Coffee & Snacks", amount: "-$12.40", color: "text-[var(--color-danger)]" },
                { dot: "bg-green-500", name: "Direct Deposit", amount: "+$3,500.00", color: "text-[var(--color-success)]" },
                { dot: "bg-purple-500", name: "Netflix", amount: "-$15.99", color: "text-[var(--color-danger)]" },
                { dot: "bg-purple-500", name: "Groceries", amount: "-$84.22", color: "text-[var(--color-danger)]" },
              ].map( ( tx ) => (
                <div key={tx.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ tx.dot }`} />
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      {tx.name}
                    </span>
                  </div>
                  <span className={`text-sm font-medium ${ tx.color }`}>
                    {tx.amount}
                  </span>
                </div>
              ) )}
            </div>

            <div className="border-t border-[var(--color-border)] my-4" />

            {/* Budget bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Food &amp; Dining
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  $340 / $400
                </span>
              </div>
              <div className="w-full h-1.5 bg-[var(--color-bg-tertiary)] rounded-full">
                <div
                  className="h-1.5 bg-[var(--color-warning)] rounded-full"
                  style={{ width: "85%" }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
