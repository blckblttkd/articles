import { useCallback, useEffect, useReducer, useRef } from 'react'
import differenceBy from 'lodash/differenceBy'
import intersectionBy from 'lodash/intersectionBy'
import uniqBy from 'lodash/uniqBy'
import { ServerError } from './ServerError'

type ReconcileErrorsReturn = [ServerError[], (viewedError: ServerError) => void]

type RedisplayTimerMap = Partial<Record<string, NodeJS.Timer>>

const ONE_MINUTE = 60000

enum ErrorActionType {
    addError = 'addError',
    addViewedError = 'addViewedError',
    redisplayErrors = 'redisplayErrors',
    replaceErrors = 'replaceErrors',
    replaceViewedErrors = 'replaceViewedErrors',
}

type ErrorAction = {
    type: ErrorActionType,
    payload: ServerError | ServerError[],
}

type ErrorState = {
    errorsToShow: ServerError[],
    viewedErrors: ServerError[],
}

const redisplayError = (state: ErrorState, redisplayTheseErrors: ServerError[]) => {
    const { errorsToShow, viewedErrors } = state
    if (redisplayTheseErrors.length === 0) {
        return state
    }

    const newViewedErrors = differenceBy(viewedErrors, redisplayTheseErrors, 'errorId')

    return {
        errorsToShow: errorsToShow.concat(redisplayTheseErrors),
        viewedErrors: newViewedErrors,
    }
}

const viewedError = (state:ErrorState, newlyViewedErrors: ServerError[]) => {
    const { errorsToShow, viewedErrors } = state
    const newViewedErrors = viewedErrors.concat(newlyViewedErrors)
    const newErrorsToShow = differenceBy(errorsToShow, newViewedErrors, 'errorId')
    return {
        errorsToShow: newErrorsToShow,
        viewedErrors: newViewedErrors,
    }
}

const errorsReducer = (state: ErrorState, action: ErrorAction) => {
    const { errorsToShow, viewedErrors } = state
    const { payload, type } = action

    let retVal: ErrorState = {
        errorsToShow,
        viewedErrors,
    }

    const aryPayload = Array.isArray(payload) ? payload : [payload]
    switch (type) {
        case ErrorActionType.addError:
            retVal = {
                errorsToShow: errorsToShow.concat(aryPayload),
                viewedErrors,
            }
            break
        case ErrorActionType.addViewedError:
            retVal = viewedError(state, aryPayload)
            break
        case ErrorActionType.redisplayErrors:
            retVal = redisplayError(state, aryPayload)
            break
        case ErrorActionType.replaceErrors:
            retVal = {
                errorsToShow: aryPayload,
                viewedErrors,
            }
            break;
        case ErrorActionType.replaceViewedErrors:
            retVal = {
                errorsToShow,
                viewedErrors: aryPayload,
            }
            break;
        default:
            return state
    }

    return {
        errorsToShow: uniqBy(retVal.errorsToShow, 'errorId'),
        viewedErrors: uniqBy(retVal.viewedErrors, 'errorId'),
    }
}

export const useReconcileErrors = (errors: ServerError[]): ReconcileErrorsReturn => {
    const [{errorsToShow, viewedErrors }, dispatch] = useReducer(errorsReducer, {
        errorsToShow: errors,
        viewedErrors: []
    })
    // NEW CODE: redisplay map
    const errorRedisplayMap = useRef<RedisplayTimerMap>({})

    useEffect(() => {
        // Clear out the previously viewed errors in case error conditions were cleared up.
        const newViewedErrors = intersectionBy(viewedErrors, errors, 'errorId')
        dispatch({ type: ErrorActionType.replaceViewedErrors, payload: newViewedErrors })

        // Figure out what errors need to be shown that haven't been viewed yet.
        const newErrorsToShow = differenceBy(errors, newViewedErrors, 'errorId')
        dispatch({ type: ErrorActionType.replaceErrors, payload: newErrorsToShow })

        newViewedErrors.forEach(error => {
            const intervalId: number = errorRedisplayMap[error.errorId]
            // Check if there is already a timer for this error.
            if (!intervalId) {
                // If the error doesn't have a timer yet, create one.
                errorRedisplayMap[error.errorId] = setInterval(() => {
                    dispatch({ type: ErrorActionType.redisplayErrors, payload: error })
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
        dispatch({ type: ErrorActionType.addViewedError, payload: viewedError })
    }, [])

    return [errorsToShow, addViewedError]
}

