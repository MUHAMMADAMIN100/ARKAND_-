import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from '../../shared/ui/feedback/States';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // В проде здесь Sentry.captureException(error)
    console.error('UI ErrorBoundary:', error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <ErrorState
            title="Ошибка приложения"
            hint="Обновите страницу. Если ошибка повторяется — сообщите администратору."
            onRetry={() => window.location.reload()}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
