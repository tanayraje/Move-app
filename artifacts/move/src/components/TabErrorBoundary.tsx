import React from "react";
import { Button } from "@/components/ui";

interface Props {
  /** Shown in the message, e.g. "Timeline". */
  label: string;
  children: React.ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * Keeps a crash inside one tab. The header and the dock stay usable, and the
 * tab shows a quiet retry state instead of a blank screen.
 */
export class TabErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error(`${this.props.label} tab crashed`, error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-2 px-8 text-center">
        <p className="font-display text-lg font-bold text-foreground">{this.props.label} could not be shown</p>
        <p className="text-sm text-muted-foreground">Something went wrong on this screen. Your trip is safe.</p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => this.setState({ failed: false })}>
          Try again
        </Button>
      </div>
    );
  }
}
