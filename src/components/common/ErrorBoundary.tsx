import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useRouteError } from 'react-router-dom'

/** 공통 오류 안내 화면 (한국어) */
function ErrorScreen({ error, onReset }: { error?: unknown; onReset?: () => void }) {
  const message = error instanceof Error ? error.message : undefined
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="text-5xl">⚠️</div>
      <h1 className="mt-5 text-xl font-bold text-gray-900">일시적인 오류가 발생했습니다</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-500">
        페이지를 표시하는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.
        문제가 계속되면 새로고침을 눌러 주세요.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => (onReset ? onReset() : window.location.reload())}
          className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          새로고침
        </button>
        <a
          href="/"
          className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          홈으로
        </a>
      </div>
      {import.meta.env.DEV && message && (
        <pre className="mt-6 max-w-lg overflow-x-auto rounded-lg bg-gray-100 p-4 text-left text-xs text-gray-600">
          {message}
        </pre>
      )}
    </div>
  )
}

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: unknown
}

/**
 * 전역 렌더 오류 방어. RouterProvider 바깥/안 어디서든 발생하는 렌더 예외를
 * 흰 화면 대신 안내 화면으로 대체한다.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      return <ErrorScreen error={this.state.error} onReset={this.handleReset} />
    }
    return this.props.children
  }
}

/** React Router의 route errorElement 용 — 라우트/로더/렌더 오류를 잡는다. */
export function RouteError() {
  const error = useRouteError()
  console.error('[RouteError]', error)
  return <ErrorScreen error={error} />
}
