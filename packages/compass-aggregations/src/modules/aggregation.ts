import HadronDocument from 'hadron-document';
import type { Reducer } from 'redux';
import type { AggregateOptions, Document, MongoServerError } from 'mongodb';
import type { PipelineBuilderThunkAction } from '.';
import { DEFAULT_MAX_TIME_MS } from '../constants';
import { globalAppRegistryEmit } from '@mongodb-js/mongodb-redux-common/app-registry';
import { aggregatePipeline } from '../utils/cancellable-aggregation';
import type { WorkspaceChangedAction } from './workspace';
import { ActionTypes as WorkspaceActionTypes } from './workspace';
import { createLoggerAndTelemetry } from '@mongodb-js/compass-logging';
import type { NewPipelineConfirmedAction } from './is-new-pipeline-confirm';
import { ActionTypes as ConfirmNewPipelineActions } from './is-new-pipeline-confirm';
import {
  getPipelineFromBuilderState,
  mapPipelineModeToEditorViewType,
} from './pipeline-builder/builder-helpers';
import { getStageOperator } from '../utils/stage';
import { fetchExplainForPipeline } from './insights';
import { isAction } from '../utils/is-action';

const { log, mongoLogId, track } = createLoggerAndTelemetry(
  'COMPASS-AGGREGATIONS-UI'
);

export enum ActionTypes {
  RunAggregation = 'compass-aggeregations/runAggregation',
  AggregationStarted = 'compass-aggregations/aggregationStarted',
  AggregationFinished = 'compass-aggregations/aggregationFinished',
  AggregationFailed = 'compass-aggregations/aggregationFailed',
  AggregationCancelledByUser = 'compass-aggregations/aggregationCancelledByUser',
  LastPageReached = 'compass-aggregations/lastPageReached',
  ResultViewTypeChanged = 'compass-aggregations/resultViewTypeChanged',
}

type PreviousPageData = {
  page: number;
  isLast: boolean;
  documents: HadronDocument[];
};

export type RunAggregation = {
  type: ActionTypes.RunAggregation;
  pipeline: Document[];
};

export type AggregationStartedAction = {
  type: ActionTypes.AggregationStarted;
  abortController: AbortController;
};

export type AggregationFinishedAction = {
  type: ActionTypes.AggregationFinished;
  documents: HadronDocument[];
  page: number;
  isLast: boolean;
};

export type AggregationFailedAction = {
  type: ActionTypes.AggregationFailed;
  error: string;
  page: number;
};

export type AggregationCancelledAction = {
  type: ActionTypes.AggregationCancelledByUser;
};

export type LastPageReachedAction = {
  type: ActionTypes.LastPageReached;
  page: number;
};

export type ResultViewTypeChangedAction = {
  type: ActionTypes.ResultViewTypeChanged;
  viewType: 'document' | 'json';
};

export type Actions =
  | RunAggregation
  | AggregationStartedAction
  | AggregationFinishedAction
  | AggregationFailedAction
  | AggregationCancelledAction
  | LastPageReachedAction
  | ResultViewTypeChangedAction;

export type State = {
  pipeline: Document[];
  documents: HadronDocument[];
  page: number;
  limit: number;
  isLast: boolean;
  loading: boolean;
  abortController?: AbortController;
  error?: string;
  previousPageData?: PreviousPageData;
  resultsViewType: 'document' | 'json';
};

export const INITIAL_STATE: State = {
  pipeline: [],
  documents: [],
  page: 1,
  limit: 20,
  isLast: false,
  loading: false,
  resultsViewType: 'document',
};

const reducer: Reducer<State> = (state = INITIAL_STATE, action) => {
  if (
    isAction<WorkspaceChangedAction>(
      action,
      WorkspaceActionTypes.WorkspaceChanged
    ) ||
    isAction<NewPipelineConfirmedAction>(
      action,
      ConfirmNewPipelineActions.NewPipelineConfirmed
    )
  ) {
    return INITIAL_STATE;
  }
  if (isAction<RunAggregation>(action, ActionTypes.RunAggregation)) {
    return {
      ...state,
      pipeline: action.pipeline,
    };
  }
  if (
    isAction<AggregationStartedAction>(action, ActionTypes.AggregationStarted)
  ) {
    return {
      ...state,
      loading: true,
      error: undefined,
      documents: [],
      abortController: action.abortController,
      previousPageData: {
        page: state.page,
        documents: state.documents,
        isLast: state.isLast,
      },
    };
  }
  if (
    isAction<AggregationFinishedAction>(action, ActionTypes.AggregationFinished)
  ) {
    return {
      ...state,
      isLast: action.isLast,
      page: action.page,
      documents: action.documents,
      loading: false,
      abortController: undefined,
      error: undefined,
      previousPageData: undefined,
    };
  }
  if (
    isAction<AggregationFailedAction>(action, ActionTypes.AggregationFailed)
  ) {
    return {
      ...state,
      documents: [],
      loading: false,
      abortController: undefined,
      error: action.error,
      page: action.page,
      previousPageData: undefined,
    };
  }
  if (
    isAction<AggregationCancelledAction>(
      action,
      ActionTypes.AggregationCancelledByUser
    )
  ) {
    return {
      ...state,
      loading: false,
      abortController: undefined,
      documents: state.previousPageData?.documents || [],
      page: state.previousPageData?.page || 1,
      isLast: state.previousPageData?.isLast || false,
      previousPageData: undefined,
    };
  }
  if (isAction<LastPageReachedAction>(action, ActionTypes.LastPageReached)) {
    return {
      ...state,
      isLast: true,
      loading: false,
      page: action.page,
    };
  }
  if (
    isAction<ResultViewTypeChangedAction>(
      action,
      ActionTypes.ResultViewTypeChanged
    )
  ) {
    return {
      ...state,
      resultsViewType: action.viewType,
    };
  }
  return state;
};

export const runAggregation = (): PipelineBuilderThunkAction<Promise<void>> => {
  return (dispatch, getState, { pipelineBuilder }) => {
    const pipeline = getPipelineFromBuilderState(getState(), pipelineBuilder);
    void dispatch(fetchExplainForPipeline());
    dispatch({
      type: ActionTypes.RunAggregation,
      pipeline,
    });
    track('Aggregation Executed', () => ({
      num_stages: pipeline.length,
      editor_view_type: mapPipelineModeToEditorViewType(getState()),
    }));
    return dispatch(fetchAggregationData());
  };
};

export const fetchPrevPage = (): PipelineBuilderThunkAction<
  Promise<void>,
  Actions
> => {
  return async (dispatch, getState) => {
    const {
      aggregation: { page },
    } = getState();
    if (page <= 1) {
      return;
    }
    return dispatch(fetchAggregationData(page - 1));
  };
};

export const fetchNextPage = (): PipelineBuilderThunkAction<
  Promise<void>,
  Actions
> => {
  return async (dispatch, getState) => {
    const {
      aggregation: { isLast, page },
    } = getState();
    if (isLast) {
      return;
    }
    return dispatch(fetchAggregationData(page + 1));
  };
};

export const retryAggregation = (): PipelineBuilderThunkAction<
  Promise<void>,
  Actions
> => {
  return (dispatch, getState) => {
    const {
      aggregation: { page },
    } = getState();
    return dispatch(fetchAggregationData(page));
  };
};

export const cancelAggregation = (): PipelineBuilderThunkAction<
  void,
  Actions
> => {
  return (dispatch, getState) => {
    track('Aggregation Canceled');
    const {
      aggregation: { abortController },
    } = getState();
    _abortAggregation(abortController);
    // In order to avoid the race condition between user cancel and cancel triggered
    // in fetchAggregationData, we dispatch ActionTypes.AggregationCancelledByUser here.
    dispatch({
      type: ActionTypes.AggregationCancelledByUser,
    });
  };
};

const _abortAggregation = (controller?: AbortController): void => {
  controller?.abort();
};

const fetchAggregationData = (
  page = 1
): PipelineBuilderThunkAction<Promise<void>> => {
  return async (dispatch, getState) => {
    const {
      id,
      namespace,
      maxTimeMS,
      dataService: { dataService },
      aggregation: { limit, abortController: _abortController, pipeline },
      collationString: { value: collation },
    } = getState();

    if (!dataService) {
      return;
    }

    // Cancel the existing aggregate
    _abortAggregation(_abortController);

    try {
      const abortController = new AbortController();
      const signal = abortController.signal;

      dispatch({
        type: ActionTypes.AggregationStarted,
        abortController,
      });

      const options: AggregateOptions = {
        maxTimeMS: maxTimeMS ?? DEFAULT_MAX_TIME_MS,
        collation: collation ?? undefined,
      };

      const lastStage = pipeline[pipeline.length - 1];

      const isMergeOrOut = ['$merge', '$out'].includes(
        getStageOperator(lastStage) ?? ''
      );

      const documents = await aggregatePipeline({
        dataService,
        signal,
        namespace,
        pipeline,
        options,
        ...(!isMergeOrOut && {
          skip: (page - 1) * limit,
          limit,
        }),
      });

      if (isMergeOrOut) {
        dispatch(globalAppRegistryEmit('agg-pipeline-out-executed', { id }));
      }

      if (documents.length === 0) {
        dispatch({ type: ActionTypes.LastPageReached, page });
      } else {
        dispatch({
          type: ActionTypes.AggregationFinished,
          documents: documents.map((doc) => new HadronDocument(doc)),
          page,
          isLast: documents.length < limit,
        });
      }
    } catch (e) {
      // User cancel is handled in cancelAggregation
      if (dataService.isCancelError(e)) {
        return;
      }
      // Server errors are surfaced to the user
      if ((e as MongoServerError).code) {
        dispatch({
          type: ActionTypes.AggregationFailed,
          error: (e as Error).message,
          page,
        });
        if ((e as MongoServerError).codeName === 'MaxTimeMSExpired') {
          track('Aggregation Timed Out', { max_time_ms: maxTimeMS ?? null });
        }
        log.warn(
          mongoLogId(1001000106),
          'Aggregations',
          'Failed to run aggregation',
          { message: (e as Error).message }
        );
        return;
      }
      // Anything else is not expected, throw
      throw e;
    }
  };
};

export const exportAggregationResults =
  (): PipelineBuilderThunkAction<void> => {
    return (dispatch, getState, { pipelineBuilder }) => {
      const {
        namespace,
        maxTimeMS,
        countDocuments: { count },
        collationString: { value: collation },
      } = getState();

      const pipeline = getPipelineFromBuilderState(getState(), pipelineBuilder);

      const options: AggregateOptions = {
        maxTimeMS: maxTimeMS ?? DEFAULT_MAX_TIME_MS,
        allowDiskUse: true,
        collation: collation ?? undefined,
      };

      dispatch(
        globalAppRegistryEmit('open-export', {
          namespace,
          aggregation: {
            stages: pipeline,
            options,
          },
          origin: 'aggregations-toolbar',
          count,
        })
      );
    };
  };

export const changeViewType = (newViewType: 'document' | 'json') => {
  return {
    type: ActionTypes.ResultViewTypeChanged,
    viewType: newViewType,
  };
};

export const expandPipelineResults = (): PipelineBuilderThunkAction<void> => {
  return (dispatch, getState) => {
    const {
      aggregation: { documents },
    } = getState();

    documents.forEach((doc) => doc.expand());
  };
};

export const collapsePipelineResults = (): PipelineBuilderThunkAction<void> => {
  return (dispatch, getState) => {
    const {
      aggregation: { documents },
    } = getState();

    documents.forEach((doc) => doc.collapse());
  };
};

export default reducer;
