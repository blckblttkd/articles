import { useSelector } from 'react-redux'
import { useReconcileErrors } from "./useReconcileErrors1";
import { ServerError } from "./ServerError";

export const Consumer = () => {
    const errors = useSelector<AppState, ServerErrors[]>(state => state.errors)
    const [errorsToShow, addViewedError] = useReconcileErrors(errors)

    return errorsToShow.map((error: ServerError) => {
        addViewedError(error)
        return <p>{error.message}</p>
    })
}

