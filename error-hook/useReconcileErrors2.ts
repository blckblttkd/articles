import { useCallback, useEffect, useRef, useState } from 'react'
import differenceBy from 'lodash/differenceBy'
import intersectionBy from 'lodash/intersectionBy'
import { ServerError } from './ServerError'

type ReconcileErrorsReturn = [ServerError[], (viewedError: ServerError) => void]

type RedisplayTimerMap = Partial<Record<string, NodeJS.Timer>>

const ONE_MINUTE = 60000

export const useReconcileErrors = (errors: ServerError[]): ReconcileErrorsReturn => {
    const [errorsToShow, setErrorsToShow] = useState<ServerError[]>(errors)
    const [viewedErrors, setViewedErrors] = useState<ServerError[]>([])
    // NEW CODE: redisplay map
    const errorRedisplayMap = useRef<RedisplayTimerMap>({})

    useEffect(() => {
        // Clear out the previously viewed errors in case error conditions were cleared up.
        const newViewedErrors = intersectionBy(viewedErrors, errors, 'errorId')
        setViewedErrors(newViewedErrors)

        // Figure out what errors need to be shown that haven't been viewed yet.
        const newErrorsToShow = differenceBy(errors, newViewedErrors, 'errorId')
        setErrorsToShow(newErrorsToShow)

        newViewedErrors.forEach(error => {
            const intervalId: number = errorRedisplayMap[error.errorId]
            // Check if there is already a timer for this error.
            if (!intervalId) {
                // If the error doesn't have a timer yet, create one.
                errorRedisplayMap.current[error.errorId] = setInterval(() => {
                    // This should look familiar, but in the opposite direction as the
                    // "addViewedError".
                    // Notice the use of closures here at the time timer is created.
                    // The values for "errorsToShow" and "viewedErrors" will be wrong.
                    const newErrorsToShow = errorsToShow.concat([error])
                    setErrorsToShow(newErrorsToShow)

                    const newViewedErrors = viewedErrors.filter(e => e.errorId !== error.errorId)
                    setViewedErrors(newViewedErrors)
                }, ONE_MINUTE)
            }
        })

        // Check for errors that no longer need timers, and clear them out.
        Object.keys(errorRedisplayMap.current).forEach(errorCode => {
            if (!errors.find(error => error.errorId === errorCode)) {
                clearInterval(errorRedisplayMap.current[errorCode])
                delete errorRedisplayMap.current[errorCode]
            }
        })

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

