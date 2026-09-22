"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "./ErrorState";

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Custom fallback; receives the caught error and a reset callback. */
  fallback?: (error: unknown, reset: () => void) => ReactNode;
  /** Re-mounts children when any of these values change (e.g. route params). */
  resetKeys?: readonly unknown[];
  onError?: (error: unknown, info: ErrorInfo) => void;
  variant?: "inline" | "page";
};

type ErrorBoundaryState = { error: unknown | null };

/**
 * Class-based boundary for client subtrees (widgets, sections) so a failing section
 * never blanks the whole page. Route-level failures are handled by `error.tsx`.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  componentDidUpdate(previousProps: ErrorBoundaryProps) {
    if (this.state.error === null) return;
    const previous = previousProps.resetKeys ?? [];
    const next = this.props.resetKeys ?? [];
    const changed = previous.length !== next.length || previous.some((value, index) => value !== next[index]);
    if (changed) this.reset();
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error === null) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
    return <ErrorState error={this.state.error} onRetry={this.reset} variant={this.props.variant ?? "inline"} />;
  }
}
