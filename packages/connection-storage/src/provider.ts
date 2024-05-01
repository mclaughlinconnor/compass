import { createContext, useContext } from 'react';
import { createServiceLocator } from 'hadron-app-registry';
import {
  type ConnectionStorage,
  type ConnectionInfo,
  type AtlasClusterMetadata,
  type AutoConnectPreferences,
  ConnectionStorageEvents,
} from './connection-storage';
import { InMemoryConnectionStorage } from './in-memory-connection-storage';

export { ConnectionStorageEvents, InMemoryConnectionStorage };

export type {
  ConnectionStorage,
  ConnectionInfo,
  AtlasClusterMetadata,
  AutoConnectPreferences,
};

export const ConnectionStorageContext = createContext<ConnectionStorage | null>(
  null
);

export const ConnectionStorageProvider = ConnectionStorageContext.Provider;

// TODO(COMPASS-7397): storage context should not be leaking out of the service
// provider export, but the way the connection plugin is currently implemented
// prevents us from avoiding this
export function useConnectionStorageContext(): ConnectionStorage {
  const connectionStorage = useContext(ConnectionStorageContext);
  if (!connectionStorage) {
    if (process.env.NODE_ENV === 'test') {
      return new InMemoryConnectionStorage();
    }
    throw new Error(
      'Could not find the current ConnectionStorage. Did you forget to setup the ConnectionStorageProvider?'
    );
  }
  return connectionStorage;
}

export const connectionStorageLocator = createServiceLocator(
  useConnectionStorageContext,
  'connectionStorageLocator'
);
