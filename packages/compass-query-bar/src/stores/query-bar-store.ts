import type AppRegistry from 'hadron-app-registry';
import {
  createStore as _createStore,
  applyMiddleware,
  combineReducers,
} from 'redux';
import thunk from 'redux-thunk';
import type { AnyAction } from 'redux';
import type { ThunkAction, ThunkDispatch } from 'redux-thunk';
import type { DataService } from '@mongodb-js/compass-connections/provider';
import { DEFAULT_FIELD_VALUES } from '../constants/query-bar-store';
import { mapQueryToFormFields } from '../utils/query';
import {
  queryBarReducer,
  INITIAL_STATE as INITIAL_QUERY_BAR_STATE,
  QueryBarActions,
} from './query-bar-reducer';
import { aiQueryReducer, disableAIFeature } from './ai-query-reducer';
import { getQueryAttributes } from '../utils';
import type { PreferencesAccess } from 'compass-preferences-model';
import type { CollectionTabPluginMetadata } from '@mongodb-js/compass-collection';
import type { ActivateHelpers } from 'hadron-app-registry';
import type { MongoDBInstance } from 'mongodb-instance-model';
import { QueryBarStoreContext } from './context';
import type { LoggerAndTelemetry } from '@mongodb-js/compass-logging/provider';
import type { AtlasAuthService } from '@mongodb-js/atlas-service/provider';
import type { AtlasAiService } from '@mongodb-js/compass-generative-ai/provider';
import type {
  FavoriteQueryStorageAccess,
  FavoriteQueryStorage,
  RecentQueryStorageAccess,
  RecentQueryStorage,
} from '@mongodb-js/my-queries-storage/provider';

// Partial of DataService that mms shares with Compass.
type QueryBarDataService = Pick<DataService, 'sample' | 'getConnectionString'>;

type QueryBarServices = {
  instance: MongoDBInstance;
  globalAppRegistry: AppRegistry;
  localAppRegistry: AppRegistry;
  dataService: QueryBarDataService;
  preferences: PreferencesAccess;
  logger: LoggerAndTelemetry;
  atlasAuthService: AtlasAuthService;
  atlasAiService: AtlasAiService;
  favoriteQueryStorageAccess?: FavoriteQueryStorageAccess;
  recentQueryStorageAccess?: RecentQueryStorageAccess;
};

// TODO(COMPASS-7412): this doesn't have service injector
// implemented yet, so we're keeping it separate from the type above
type QueryBarExtraServices = {
  atlasAuthService?: AtlasAuthService;
  favoriteQueryStorage?: FavoriteQueryStorage;
  recentQueryStorage?: RecentQueryStorage;
};

export type QueryBarStoreOptions = CollectionTabPluginMetadata;

export const rootQueryBarReducer = combineReducers({
  queryBar: queryBarReducer,
  aiQuery: aiQueryReducer,
});

export type RootState = ReturnType<typeof rootQueryBarReducer>;

export type QueryBarExtraArgs = {
  globalAppRegistry: AppRegistry;
  localAppRegistry: AppRegistry;
  dataService: Pick<QueryBarDataService, 'sample'>;
  atlasAuthService: AtlasAuthService;
  preferences: PreferencesAccess;
  favoriteQueryStorage?: FavoriteQueryStorage;
  recentQueryStorage?: RecentQueryStorage;
  logger: LoggerAndTelemetry;
  atlasAiService: AtlasAiService;
};

export type QueryBarThunkDispatch<A extends AnyAction = AnyAction> =
  ThunkDispatch<RootState, QueryBarExtraArgs, A>;

export type QueryBarThunkAction<
  R,
  A extends AnyAction = AnyAction
> = ThunkAction<R, RootState, QueryBarExtraArgs, A>;

export function configureStore(
  initialState: Partial<RootState['queryBar']> = {},
  services: QueryBarExtraArgs
) {
  return _createStore(
    rootQueryBarReducer,
    {
      queryBar: {
        ...INITIAL_QUERY_BAR_STATE,
        ...initialState,
      },
    },
    applyMiddleware(thunk.withExtraArgument(services))
  );
}

export function activatePlugin(
  options: QueryBarStoreOptions,
  services: QueryBarServices & QueryBarExtraServices,
  { on, cleanup }: ActivateHelpers
) {
  const { serverVersion, query, namespace } = options;

  const {
    localAppRegistry,
    globalAppRegistry,
    instance,
    dataService,
    preferences,
    logger,
    atlasAuthService,
    atlasAiService,
    favoriteQueryStorageAccess,
    recentQueryStorageAccess,
  } = services;

  const favoriteQueryStorage = favoriteQueryStorageAccess?.getStorage();
  const recentQueryStorage = recentQueryStorageAccess?.getStorage();
  const store = configureStore(
    {
      namespace: namespace ?? '',
      host: dataService?.getConnectionString().hosts.join(','),
      serverVersion: serverVersion ?? '3.6.0',
      fields: mapQueryToFormFields(preferences.getPreferences(), {
        ...DEFAULT_FIELD_VALUES,
        ...getQueryAttributes(query ?? {}),
      }),
      isReadonlyConnection: !instance.isWritable,
    },
    {
      dataService: services.dataService ?? {
        sample: () => {
          /* no-op for environments where dataService is not provided at all. */
          return Promise.resolve([]);
        },
      },
      localAppRegistry,
      globalAppRegistry,
      recentQueryStorage,
      favoriteQueryStorage,
      atlasAuthService,
      preferences,
      logger,
      atlasAiService,
    }
  );

  on(instance, 'change:isWritable', () => {
    store.dispatch({
      type: QueryBarActions.ChangeReadonlyConnectionStatus,
      readonly: !instance.isWritable,
    });
  });

  on(atlasAuthService, 'user-config-changed', (config) => {
    if (config.enabledAIFeature === false) {
      store.dispatch(disableAIFeature());
    }
  });

  return { store, deactivate: cleanup, context: QueryBarStoreContext };
}
