import { Component, type ReactNode } from "react";
import { Button } from "@stageholder/ui";
import { logger } from "@repo/core/platform/logger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error(
      `[ErrorBoundary] ${error.message}\n${error.stack ?? ""}\nComponent stack: ${info.componentStack ?? "N/A"}`,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card p-8">
            <p className="text-sm text-muted-foreground">
              Something went wrong.
            </p>
            <Button onPress={() => this.setState({ hasError: false })}>
              Try again
            </Button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
