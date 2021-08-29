import { useCallback, useEffect, useState } from 'react'
import differenceBy from 'lodash/differenceBy'
import intersectionBy from 'lodash/intersectionBy'
import { ServerError } from './ServerError'

type ReconcileErrorsReturn = [ServerError[], (viewedError: ServerError) => void]

export const useReconcileErrors = (errors: ServerError[]): ReconcileErrorsReturn => {
    const [errorsToShow, setErrorsToShow] = useState<ServerError[]>(errors)
    const [viewedErrors, setViewedErrors] = useState<ServerError[]>([])

    useEffect(() => {
        // Clear out the previously viewed errors in case error conditions were cleared up.
        const newViewedErrors = intersectionBy(viewedErrors, errors, 'errorId')
        setViewedErrors(newViewedErrors)

        // Figure out what errors need to be shown that haven't been viewed yet.
        const newErrorsToShow = differenceBy(errors, newViewedErrors, 'errorId')
        setErrorsToShow(newErrorsToShow)

        // intentionally leave this as a partial list to prevent infinite updates
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [errors])

    const addViewedError = useCallback((viewedError: ServerError) => {
        // Add the newly viewed error to the list of viewed errors.
        const newViewedErrors = viewedErrors.concat([viewedError])
        setViewedErrors(newViewedErrors)

        // Reconcile the errors to show based on the newly viewed error list.
        const newErrorsToShow = differenceBy(errorsToShow, newViewedErrors, 'errorId')
        setErrorsToShow(newErrorsToShow)
    }, [errorsToShow, viewedErrors])

    return [errorsToShow, addViewedError]
}

