import type { Store } from 'redux';
import { createStore, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import toNS from 'mongodb-ns';
import { toJSString } from 'mongodb-query-parser';
import { AtlasService } from '@mongodb-js/atlas-service/renderer';
import type { PipelineBuilderThunkDispatch, RootState } from '../modules';
import reducer from '../modules';
import { fieldsChanged } from '../modules/fields';
import { refreshInputDocuments } from '../modules/input-documents';
import { openStoredPipeline } from '../modules/saved-pipeline';
import { PipelineBuilder } from '../modules/pipeline-builder/pipeline-builder';
import { generateAggregationFromQuery } from '../modules/pipeline-builder/pipeline-ai';
import type { SavedPipeline } from '@mongodb-js/my-queries-storage';
import { PipelineStorage } from '@mongodb-js/my-queries-storage';
import {
  mapBuilderStageToStoreStage,
  mapStoreStagesToStageIdAndType,
} from '../modules/pipeline-builder/stage-editor';
import { updatePipelinePreview } from '../modules/pipeline-builder/builder-helpers';
import type AppRegistry from 'hadron-app-registry';
import type { ENVS } from '@mongodb-js/mongodb-constants';
import {
  setCollectionFields,
  setCollections,
} from '../modules/collections-fields';
import type { CollectionInfo } from '../modules/collections-fields';
import { disableAIFeature } from '../modules/pipeline-builder/pipeline-ai';
import { INITIAL_STATE as SEARCH_INDEXES_INITIAL_STATE } from '../modules/search-indexes';
import { INITIAL_PANEL_OPEN_LOCAL_STORAGE_KEY } from '../modules/side-panel';
import preferencesAccess from 'compass-preferences-model';
import type { DataService } from '../modules/data-service';

export type ConfigureStoreOptions = {
  /**
   * Namespace to be used when running aggregations (required, only collection namespaces are supported)
   */
  namespace: string;
} & Partial<{
  /**
   * Should be provided if namespace is a view. Affects available stages
   */
  sourceName: string;
  /**
   * Current server version. Affects available stages
   */
  serverVersion: string;
  /**
   * Whether or not collection is a timeseries collection. Affects available
   * stages
   */
  isTimeSeries: boolean;
  /**
   * Whether or not collection is part of ADF (ex ADL). Used only to provide
   * correct explain plan verbosity
   */
  isDataLake: boolean;
  /**
   * Current connection env type. Affects available stages. Accepted values:
   * "atlas" | "on-prem" | "adl"
   */
  env: typeof ENVS[number] | null;
  /**
   * Namespace field values that will be used in autocomplete
   */
  fields: { name: string }[];
  /**
   * Function that overrides default handling of opening resulting namespace
   * of out stages ($out, $merge). When provided, will be called when user
   * clicks
   */
  outResultsFn: (namespace: string) => void;
  /**
   * Stored pipeline metadata. Can be provided to preload stored pipeline
   * right when the plugin is initialized
   */
  aggregation?: unknown;
  /**
   * Namespace for the view that is being edited. Needs to be provided with the
   * `pipeline` options
   */
  editViewName: string;
  /**
   * Initial pipeline that will be converted to a string to be used by the
   * aggregation builder. Takes precedence over `pipelineText` option
   */
  pipeline?: unknown[];
  /**
   * Initial pipeline text to be used by the aggregation builder
   */
  pipelineText?: string;
  /**
   * List of all the collections in the current database. It is used inside
   * the stage wizard to populate the dropdown for $lookup use-case.
   */
  collections: CollectionInfo[];
  /**
   * Storage service for saved aggregations
   */
  pipelineStorage: PipelineStorage;
  /**
   * Service for interacting with Atlas-only features
   */
  atlasService: AtlasService;
  /**
   * Whether or not search indexes are supported in the current environment
   */
  isSearchIndexesSupported: boolean;
}>;

export type AggregationsPluginServices = {
  dataService: DataService;
  localAppRegistry: Pick<
    AppRegistry,
    'on' | 'emit' | 'removeListener' | 'getStore'
  >;
  globalAppRegistry: Pick<
    AppRegistry,
    'on' | 'emit' | 'removeListener' | 'getStore'
  >;
};

export function activateAggregationsPlugin(
  options: ConfigureStoreOptions,
  {
    dataService,
    localAppRegistry,
    globalAppRegistry,
  }: AggregationsPluginServices
) {
  const cleanup: (() => void)[] = [];
  function on(
    eventEmitter: {
      on(ev: string, l: (...args: any[]) => void): void;
      removeListener(ev: string, l: (...args: any[]) => void): void;
    },
    ev: string,
    listener: (...args: any[]) => void
  ) {
    eventEmitter.on(ev, listener);
    cleanup.push(() => eventEmitter.removeListener(ev, listener));
  }

  if (options.editViewName && !options.pipeline) {
    throw new Error(
      'Option `editViewName` can be used only if `pipeline` is provided'
    );
  }

  const editingView = !!(options.editViewName && options.pipeline);

  const initialPipelineSource =
    (options.pipeline ? toJSString(options.pipeline) : options.pipelineText) ??
    undefined;

  const { collection } = toNS(options.namespace);

  if (!collection) {
    throw new Error("Aggregation plugin doesn't support database namespaces");
  }

  const pipelineBuilder = new PipelineBuilder(
    dataService,
    initialPipelineSource
  );

  const atlasService = options.atlasService ?? new AtlasService();

  const pipelineStorage = options.pipelineStorage ?? new PipelineStorage();

  const stages = pipelineBuilder.stages.map((stage, idx) =>
    mapBuilderStageToStoreStage(stage, idx)
  );

  const stagesIdAndType = mapStoreStagesToStageIdAndType(stages);

  const store: Store<RootState> & {
    dispatch: PipelineBuilderThunkDispatch;
  } = createStore(
    reducer,
    {
      // TODO: move this to thunk extra arg
      appRegistry: {
        localAppRegistry,
        globalAppRegistry,
      },
      // TODO: move this to thunk extra arg
      dataService: { dataService },
      namespace: options.namespace,
      serverVersion: options.serverVersion,
      isTimeSeries: options.isTimeSeries,
      isDataLake: options.isDataLake,
      env:
        // mms specifies options.env whereas we don't currently get this variable when
        // we use the aggregations plugin inside compass. In that use case we get it
        // from the instance model above.
        options.env ??
        // TODO: for now this is how we get to the env in compass as opposed to in
        // mms where it comes from options.env. Ideally options.env would be
        // required so we can always get it from there, but that's something for a
        // future task. In theory we already know the env by the time this code
        // executes, so it should be doable.
        (
          globalAppRegistry.getStore('App.InstanceStore') as Store | undefined
        )?.getState().instance.env,
      // options.fields is only used by mms, but always set to [] which is the initial value anyway
      fields: options.fields ?? [],
      // options.outResultsFn is only used by mms
      outResultsFn: options.outResultsFn,
      pipelineBuilder: {
        stageEditor: {
          stages,
          stagesIdAndType,
        },
      },
      sourceName: options.sourceName,
      editViewName: options.editViewName,
      searchIndexes: {
        ...SEARCH_INDEXES_INITIAL_STATE,
        isSearchIndexesSupported: Boolean(options.isSearchIndexesSupported),
      },
      // This is the initial state of the STAGE WIZARD side panel (NOT OPTIONS
      // side panel)
      sidePanel: {
        isPanelOpen:
          // if the feature is enabled in preferences, the state of the
          // panel is fetched and then kept in sync with a localStorage entry.
          // The initial state, if the localStorage entry is not set,
          // should be 'hidden'.
          preferencesAccess.getPreferences().enableStageWizard &&
          localStorage.getItem(INITIAL_PANEL_OPEN_LOCAL_STORAGE_KEY) === 'true',
      },
    },
    applyMiddleware(
      thunk.withExtraArgument({
        pipelineBuilder,
        pipelineStorage,
        atlasService,
      })
    )
  );

  on(atlasService, 'user-config-changed', (config) => {
    if (config.enabledAIFeature === false) {
      store.dispatch(disableAIFeature());
    }
  });

  const refreshInput = () => {
    void store.dispatch(refreshInputDocuments());
  };

  /**
   * Refresh documents on data refresh.
   */
  on(localAppRegistry, 'refresh-data', () => {
    refreshInput();
  });

  /**
   * When the schema fields change, update the state with the new
   * fields.
   *
   * @param {Object} fields - The fields.
   */
  on(localAppRegistry, 'fields-changed', (fields) => {
    store.dispatch(fieldsChanged(fields.autocompleteFields));
  });

  on(localAppRegistry, 'generate-aggregation-from-query', (data) => {
    store.dispatch(generateAggregationFromQuery(data));
  });

  /**
   * Refresh documents on global data refresh.
   */
  on(globalAppRegistry, 'refresh-data', () => {
    refreshInput();
  });

  on(globalAppRegistry, 'import-finished', ({ ns }) => {
    const { namespace } = store.getState();
    if (ns === namespace) {
      refreshInput();
    }
  });

  // If stored pipeline was passed through options and we are not editing,
  // restore pipeline
  if (!editingView && options.aggregation) {
    store.dispatch(
      openStoredPipeline(options.aggregation as SavedPipeline, false)
    );
  }

  cleanup.push(handleDatabaseCollections(store, options, globalAppRegistry));
  if (options.fields) {
    store.dispatch(
      setCollectionFields(
        collection,
        options.sourceName ? 'view' : 'collection',
        options.fields.map((x) => x.name)
      )
    );
  }

  refreshInput();

  store.dispatch(updatePipelinePreview());

  return {
    store,
    deactivate() {
      for (const cleaner of cleanup) cleaner();
    },
  };
}

type DbModel = {
  collections: Array<{
    _id: string;
    type: 'collection' | 'view';
  }>;
};

const handleDatabaseCollections = (
  store: Store<RootState> & {
    dispatch: PipelineBuilderThunkDispatch;
  },
  options: Pick<ConfigureStoreOptions, 'namespace' | 'collections'>,
  globalAppRegistry: Pick<
    AppRegistry,
    'on' | 'emit' | 'removeListener' | 'getStore'
  >
): (() => void) => {
  const { namespace, collections } = options;

  // Give precedence to passed list of collection
  if (collections && collections.length > 0) {
    store.dispatch(setCollections(collections));
  }

  const instance = (
    globalAppRegistry.getStore('App.InstanceStore') as Store | undefined
  )?.getState().instance;
  const ns = toNS(namespace);
  const db = instance?.databases?.get(ns.database);
  if (!db) {
    return () => {
      /* nothing */
    };
  }

  const onDatabaseCollectionStatusChange = (dbModel: DbModel) => {
    const collections = dbModel.collections.map((x) => ({
      name: toNS(x._id).collection,
      type: x.type,
    }));

    store.dispatch(setCollections(collections ?? []));
  };

  onDatabaseCollectionStatusChange(db);
  db.on('change:collectionsStatus', onDatabaseCollectionStatusChange);
  return () =>
    db.removeListener(
      'change:collectionsStatus',
      onDatabaseCollectionStatusChange
    );
};
