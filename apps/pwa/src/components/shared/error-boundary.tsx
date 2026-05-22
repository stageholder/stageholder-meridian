import { Component, type ReactNode } from "react";
import { Button, Paragraph, YStack } from "@stageholder/ui";
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
          <YStack
            minH={200}
            items="center"
            justify="center"
            gap="$4"
            rounded="$lg"
            borderWidth={1}
            borderColor="$borderColor"
            bg="$card"
            p="$8"
          >
            <Paragraph fontSize="$3" color="$mutedForeground">
              Something went wrong.
            </Paragraph>
            <Button onPress={() => this.setState({ hasError: false })}>
              Try again
            </Button>
          </YStack>
        )
      );
    }

    return this.props.children;
  }
}
