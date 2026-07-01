import React from "react";

interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Future: send to Sentry
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-6 max-w-sm text-center border border-gray-100 shadow-lg">
            <div className="text-4xl mb-4">😔</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Что-то пошло не так</h2>
            <p className="text-sm text-gray-500 mb-4">
              Произошла ошибка. Попробуйте перезагрузить приложение.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: undefined });
                window.location.hash = "#/";
                window.location.reload();
              }}
              className="w-full py-3 rounded-xl bg-[#14B8A6] text-white font-semibold text-sm active:bg-[#0F766E] transition-colors"
            >
              Перезагрузить
            </button>
            {this.state.error && (
              <details className="mt-4 text-left">
                <summary className="text-xs text-gray-400 cursor-pointer">Подробности</summary>
                <pre className="mt-2 text-[10px] text-gray-400 overflow-auto max-h-24 bg-gray-50 p-2 rounded">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
