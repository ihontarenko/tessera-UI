import { useEffect, useState } from "react"

/**
 * Reflects `value` only after it stops changing for `delayMilliseconds` — used to avoid
 * re-filtering or re-querying on every keystroke of a text search input. Shared by every list
 * page's search box (see `SearchInput`) plus `SearchPage` and `TransactionsPage`'s server-side
 * search, which pass the debounced value to their query hook instead of filtering locally.
 */
export function useDebouncedValue<Value>(value: Value, delayMilliseconds = 300): Value {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedValue(value), delayMilliseconds)
    return () => clearTimeout(timeoutId)
  }, [value, delayMilliseconds])

  return debouncedValue
}
