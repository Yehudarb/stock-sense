import React from 'react'

export default class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false })
    }
  }

  componentDidCatch(error) {
    console.error('Chart render failed:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full min-h-24 flex items-center justify-center rounded-lg border border-red-900 bg-red-950/40 px-3 text-sm text-red-300">
          הגרף לא נטען כרגע.
        </div>
      )
    }

    return this.props.children
  }
}
