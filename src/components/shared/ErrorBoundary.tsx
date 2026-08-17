'use client'

import { Component, type ReactNode, type ErrorInfo } from 'react'
import * as Sentry from '@sentry/nextjs'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } }) // no-op sin DSN
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div
          className="flex flex-col items-center justify-center min-h-60 rounded-2xl p-8 text-center bg-surface-card border border-[rgba(239,85,84,0.15)]"
        >
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl mb-4 bg-[rgba(239,85,84,0.08)]"
          >
            <AlertTriangle size={22} className="text-coral" />
          </div>
          <p
            className="text-base font-semibold text-navy mb-1 font-display"
          >
            Algo salió mal
          </p>
          <p
            className="text-sm text-navy-light/70 mb-5 max-w-xs font-body"
          >
            {this.state.error?.message ?? 'Ocurrió un error inesperado.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white transition-colors bg-coral font-body"
          >
            <RotateCcw size={14} />
            Intentar de nuevo
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
