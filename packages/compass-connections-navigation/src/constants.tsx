import { spacing } from '@mongodb-js/compass-components';

// TODO: Currently we show placeholder for every collection/database item in the list, but
// do we want to / need to?
export const MAX_COLLECTION_PLACEHOLDER_ITEMS = Infinity;
export const MAX_DATABASE_PLACEHOLDER_ITEMS = Infinity;
export const MIN_DATABASE_PLACEHOLDER_ITEMS = 5;
export const ROW_HEIGHT = spacing[800];
export const SIDEBAR_COLLAPSE_ICON_WIDTH = 26;
// export const COLLETIONS_MARGIN_BOTTOM = spacing[1];

export type Actions =
  // connection item related actions
  | 'open-shell'
  | 'select-connection'
  | 'edit-connection'
  | 'duplicate-connection'
  | 'remove-connection'
  | 'connection-connect'
  | 'connection-disconnect'
  | 'connection-performance-metrics'
  | 'open-connection-info'
  | 'copy-connection-string'
  | 'connection-toggle-favorite'
  // database item related actions
  | 'select-database'
  | 'create-database'
  | 'drop-database'
  // collection item related action
  | 'select-collection'
  | 'create-collection'
  | 'drop-collection'
  | 'open-in-new-tab'
  | 'duplicate-view'
  | 'modify-view'
  | 'rename-collection';
