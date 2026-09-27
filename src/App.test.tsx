import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'

function renderApp(path = '/') {
    window.history.pushState({}, '', path)
    return render(<App />)
}

describe('App', () => {
    beforeEach(() => {
        window.localStorage.clear()
        document.documentElement.lang = 'en'
        document.documentElement.dir = 'ltr'
    })

    it('wraps the app shell and redirects the root route to the dashboard', () => {
        renderApp('/')

        expect(screen.getByRole('button', { name: /language: english/i })).toBeInTheDocument()
        expect(screen.getByText(/dashboard content view/i)).toBeInTheDocument()
        expect(window.location.pathname).toBe('/dashboard')
    })

    it('renders the dashboard and supports top-level route transitions', () => {
        renderApp('/dashboard')

        expect(screen.getByText(/dashboard content view/i)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('link', { name: /revenue sources/i }))
        expect(screen.getByRole('heading', { name: /revenue sources/i, level: 1 })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('link', { name: /attestations/i }))
        expect(screen.getByRole('heading', { name: /attestations/i, level: 1 })).toBeInTheDocument()
    })

    it('renders the settings route and keeps the app navigation mounted', () => {
        renderApp('/settings')

        expect(screen.getByRole('heading', { name: /settings/i, level: 1 })).toBeInTheDocument()
        expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
    })

    it('renders the provider step for the connect-source wizard', () => {
        renderApp('/connect-source/provider')

        expect(screen.getByRole('heading', { name: /guide teams through a safer connection flow/i })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: /select provider/i })).toBeInTheDocument()
        expect(screen.getByRole('radio', { name: /stripe/i })).toBeInTheDocument()
    })

    it('keeps invalid routes deterministic and non-crashing', () => {
        renderApp('/totally-unknown-route')

        expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
        expect(screen.queryByText(/dashboard content view/i)).not.toBeInTheDocument()
    })
})
