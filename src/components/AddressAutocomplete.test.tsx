import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import AddressAutocomplete, {
    type AddressAutocompleteProps,
    type AddressSuggestion,
    type AddressValue,
} from './AddressAutocomplete'

describe('AddressAutocomplete', () => {
    const sampleSuggestion: AddressSuggestion = {
        id: '1',
        label: '10 Downing St',
        fullAddress: '10 Downing St, London SW1A 2AA, UK',
        lat: 51.5034,
        lng: -0.1276,
    }

    it('exposes the expected public contract types', () => {
        const suggestion: AddressSuggestion = sampleSuggestion
        const value: AddressValue = {
            fullAddress: '10 Downing St, London SW1A 2AA, UK',
            lat: sampleSuggestion.lat,
            lng: sampleSuggestion.lng,
            isManual: false,
        }
        const props: AddressAutocompleteProps = {
            label: 'Business address',
            placeholder: 'Start typing your address…',
            value,
            onChange: vi.fn(),
            onClear: vi.fn(),
            fetchSuggestions: async () => [suggestion],
            required: true,
            error: 'Address is required',
        }

        expectTypeOf(suggestion).toMatchTypeOf<AddressSuggestion>()
        expectTypeOf(value).toMatchTypeOf<AddressValue>()
        expectTypeOf(props).toMatchTypeOf<AddressAutocompleteProps>()
    })

    it('ignores overly short queries and keeps the list closed', async () => {
        const fetchSuggestions = vi.fn(async () => [sampleSuggestion])

        render(<AddressAutocomplete onChange={vi.fn()} fetchSuggestions={fetchSuggestions} />)

        const input = screen.getByRole('combobox', { name: /business address/i })
        fireEvent.change(input, { target: { value: 'a' } })

        await waitFor(() => {
            expect(fetchSuggestions).not.toHaveBeenCalled()
        })

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('renders suggestions for valid input and resolves the selected value', async () => {
        const onChange = vi.fn()
        const fetchSuggestions = vi.fn(async (query: string) => {
            if (query === 'downing') return [sampleSuggestion]
            return []
        })

        render(<AddressAutocomplete onChange={onChange} fetchSuggestions={fetchSuggestions} />)

        const input = screen.getByRole('combobox', { name: /business address/i })
        fireEvent.change(input, { target: { value: 'downing' } })

        await waitFor(() => {
            expect(fetchSuggestions).toHaveBeenCalledWith('downing')
            expect(screen.getByRole('listbox')).toBeInTheDocument()
        })

        const option = screen.getByRole('option', { name: /10 downing st/i })
        fireEvent.click(option)
        expect(input).toHaveValue('10 Downing St, London SW1A 2AA, UK')
        expect(onChange).toHaveBeenCalledWith({
            fullAddress: sampleSuggestion.fullAddress,
            lat: sampleSuggestion.lat,
            lng: sampleSuggestion.lng,
            isManual: false,
        })
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
        expect(screen.getByRole('status')).toHaveTextContent(`Selected: ${sampleSuggestion.fullAddress}`)
    })

    it('shows an empty result state when a valid query has no matches', async () => {
        render(<AddressAutocomplete onChange={vi.fn()} fetchSuggestions={async () => []} />)

        fireEvent.change(screen.getByRole('combobox', { name: /business address/i }), {
            target: { value: 'unknown place' },
        })

        expect(await screen.findByRole('listbox')).toBeInTheDocument()
        expect(screen.getByRole('option')).toHaveTextContent('No matching addresses found')
        expect(screen.getByRole('status')).toHaveTextContent('No suggestions found')
    })

    it('selects the active suggestion with the keyboard and closes on Escape', async () => {
        const secondSuggestion: AddressSuggestion = {
            ...sampleSuggestion,
            id: '2',
            label: '11 Downing St',
            fullAddress: '11 Downing St, London SW1A 2AA, UK',
        }
        const onChange = vi.fn()

        render(
            <AddressAutocomplete
                onChange={onChange}
                fetchSuggestions={async () => [sampleSuggestion, secondSuggestion]}
            />
        )

        const input = screen.getByRole('combobox', { name: /business address/i })
        fireEvent.change(input, { target: { value: 'downing' } })

        const listbox = await screen.findByRole('listbox')
        fireEvent.keyDown(input, { key: 'ArrowDown' })
        fireEvent.keyDown(input, { key: 'ArrowDown' })
        expect(input).toHaveAttribute('aria-activedescendant', expect.stringContaining('item-1'))
        fireEvent.keyDown(input, { key: 'ArrowUp' })
        expect(input).toHaveAttribute('aria-activedescendant', expect.stringContaining('item-0'))
        fireEvent.keyDown(input, { key: 'Enter' })

        expect(onChange).toHaveBeenCalledWith({
            fullAddress: sampleSuggestion.fullAddress,
            lat: sampleSuggestion.lat,
            lng: sampleSuggestion.lng,
            isManual: false,
        })
        expect(listbox).not.toBeInTheDocument()

        fireEvent.change(input, { target: { value: 'downing again' } })
        expect(await screen.findByRole('listbox')).toBeInTheDocument()
        fireEvent.keyDown(input, { key: 'Escape' })
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('surfaces a deterministic failure state when suggestions cannot be loaded', async () => {
        render(
            <AddressAutocomplete
                onChange={vi.fn()}
                fetchSuggestions={async () => {
                    throw new Error('network failure')
                }}
            />
        )

        const input = screen.getByRole('combobox', { name: /business address/i })
        fireEvent.change(input, { target: { value: 'berlin' } })

        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent('Could not fetch suggestions')
        })
    })

    it('toggles manual mode and saves a trimmed address without a map preview', () => {
        const onChange = vi.fn()

        render(<AddressAutocomplete onChange={onChange} />)

        const input = screen.getByRole('combobox', { name: /business address/i })
        fireEvent.click(screen.getByRole('button', { name: /enter manually/i }))
        fireEvent.change(input, { target: { value: '  123 Main St, Apt 4  ' } })

        const form = document.querySelector('.addr-manual-form') as HTMLFormElement
        fireEvent.submit(form)

        expect(onChange).toHaveBeenCalledWith({
            fullAddress: '123 Main St, Apt 4',
            isManual: true,
        })
        expect(screen.getByText(/address saved: 123 main st, apt 4/i)).toBeInTheDocument()
        expect(screen.queryByRole('img', { name: /map showing/i })).not.toBeInTheDocument()
    })

    it('does not submit a blank manual address', () => {
        const onChange = vi.fn()

        render(<AddressAutocomplete onChange={onChange} />)

        fireEvent.click(screen.getByRole('button', { name: /enter manually/i }))
        fireEvent.change(screen.getByRole('combobox', { name: /business address/i }), {
            target: { value: '   ' },
        })

        const saveButton = screen.getByRole('button', { name: /save address/i })
        expect(saveButton).toBeDisabled()
        fireEvent.submit(screen.getByRole('form', { name: /enter address manually/i }))
        expect(onChange).not.toHaveBeenCalled()
    })

    it('exposes required and external validation state accessibly', () => {
        render(
            <AddressAutocomplete
                onChange={vi.fn()}
                required
                error="Address is required"
            />
        )

        expect(screen.getByRole('combobox', { name: /business address/i })).toHaveAttribute('aria-required', 'true')
        expect(screen.getByRole('combobox', { name: /business address/i })).toHaveAttribute('aria-invalid', 'true')
        expect(screen.getByRole('alert')).toHaveTextContent('Address is required')
    })

    it('clears the value and notifies the parent when the clear button is used', async () => {
        const onClear = vi.fn()
        const onChange = vi.fn()

        render(
            <AddressAutocomplete
                onChange={onChange}
                onClear={onClear}
                fetchSuggestions={async () => []}
                value={{ fullAddress: '10 Downing St, London SW1A 2AA, UK', isManual: false }}
            />
        )

        const input = screen.getByRole('combobox', { name: /business address/i })
        fireEvent.change(input, { target: { value: 'downing' } })

        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent('No suggestions found')
        })

        const clearButton = document.querySelector('.addr-clear-btn') as HTMLButtonElement
        fireEvent.click(clearButton)

        expect(onClear).toHaveBeenCalledTimes(1)
        expect(input).toHaveValue('')
        expect(screen.getByRole('status')).toHaveTextContent('Address cleared')
    })
})

describe('AddressAutocomplete controlled value transitions', () => {
    const suggestion: AddressSuggestion = {
        id: 'controlled-1',
        label: '10 Downing St',
        fullAddress: '10 Downing St, London SW1A 2AA, UK',
        lat: 51.5034,
        lng: -0.1276,
    }

    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('starts in manual mode and suppresses autocomplete fetches while typing', async () => {
        const fetchSuggestions = vi.fn(async () => [suggestion])

        render(
            <AddressAutocomplete
                value={{ fullAddress: '', isManual: true }}
                onChange={vi.fn()}
                fetchSuggestions={fetchSuggestions}
            />
        )

        expect(screen.getByRole('form', { name: /enter address manually/i })).toBeInTheDocument()
        const input = screen.getByRole('combobox', { name: /business address/i })
        fireEvent.change(input, { target: { value: 'Downing' } })

        await act(async () => {
            vi.advanceTimersByTime(350)
        })

        expect(fetchSuggestions).not.toHaveBeenCalled()
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('syncs manual mode from prop changes and re-enables fetching when disabled', async () => {
        const fetchSuggestions = vi.fn(async () => [suggestion])
        const onChange = vi.fn()
        const { rerender } = render(
            <AddressAutocomplete
                value={{ fullAddress: '', isManual: false }}
                onChange={onChange}
                fetchSuggestions={fetchSuggestions}
            />
        )

        rerender(
            <AddressAutocomplete
                value={{ fullAddress: '', isManual: true }}
                onChange={onChange}
                fetchSuggestions={fetchSuggestions}
            />
        )
        expect(screen.getByRole('form', { name: /enter address manually/i })).toBeInTheDocument()

        const input = screen.getByRole('combobox', { name: /business address/i })
        fireEvent.change(input, { target: { value: 'Downing' } })
        await act(async () => {
            vi.advanceTimersByTime(350)
        })
        expect(fetchSuggestions).not.toHaveBeenCalled()

        rerender(
            <AddressAutocomplete
                value={{ fullAddress: 'Downing', isManual: false }}
                onChange={onChange}
                fetchSuggestions={fetchSuggestions}
            />
        )
        expect(screen.queryByRole('form', { name: /enter address manually/i })).not.toBeInTheDocument()

        fireEvent.change(input, { target: { value: 'Downing Street' } })
        await act(async () => {
            vi.advanceTimersByTime(350)
        })
        await act(async () => {
            await Promise.resolve()
        })

        expect(fetchSuggestions).toHaveBeenCalledWith('Downing Street')
        expect(screen.getByRole('listbox')).toBeInTheDocument()
    })

    it('syncs the input text when the external address value changes', () => {
        const { rerender } = render(
            <AddressAutocomplete
                value={{ fullAddress: 'Original address', isManual: false }}
                onChange={vi.fn()}
            />
        )
        const input = screen.getByRole('combobox', { name: /business address/i })

        rerender(
            <AddressAutocomplete
                value={{ fullAddress: 'Updated address', isManual: false }}
                onChange={vi.fn()}
            />
        )

        expect(input).toHaveValue('Updated address')
    })
})
