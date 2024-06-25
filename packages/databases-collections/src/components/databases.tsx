import React, { useCallback } from 'react';
import { connect } from 'react-redux';
import {
  Banner,
  BannerVariant,
  EmptyContent,
  Link,
  css,
  spacing,
} from '@mongodb-js/compass-components';
import { DatabasesList } from '@mongodb-js/databases-collections-list';
import { usePreference } from 'compass-preferences-model/provider';
import { ZeroGraphic } from './zero-graphic';
import type { Database, DatabasesState } from '../modules/databases';
import {
  createDatabase,
  dropDatabase,
  refreshDatabases,
} from '../modules/databases';
import { useOpenWorkspace } from '@mongodb-js/compass-workspaces/provider';
import { useConnectionInfo } from '@mongodb-js/compass-connections/provider';
import {
  useTrackOnChange,
  type TrackFunction,
} from '@mongodb-js/compass-telemetry/provider';

const errorContainerStyles = css({
  padding: spacing[3],
});

const nonGenuineErrorContainerStyles = css({
  width: '100%',
});

const NON_GENUINE_SUBTEXT =
  'This server or service appears to be emulating' +
  ' MongoDB. Some documented MongoDB features may work differently, may be' +
  ' entirely missing or incomplete, or may have unexpectedly different' +
  ' performance characteristics than would be found when connecting to a' +
  ' real MongoDB server or service.';

const DOCUMENTATION_LINK = 'https://www.mongodb.com/atlas/database';

const ERROR_WARNING = 'An error occurred while loading databases';

function NonGenuineZeroState() {
  return (
    <div
      className={nonGenuineErrorContainerStyles}
      data-testid="databases-non-genuine-warning"
    >
      <EmptyContent
        icon={ZeroGraphic}
        title="Unable to display databases and collections"
        subTitle={NON_GENUINE_SUBTEXT}
        callToActionLink={
          <Link href={DOCUMENTATION_LINK}>Try MongoDB Atlas</Link>
        }
      />
    </div>
  );
}

type DatabasesProps = {
  databases: ReturnType<Database['toJSON']>[];
  databasesLoadingStatus: string;
  databasesLoadingError: string | null;
  isWritable: boolean;
  isGenuineMongoDB: boolean;
  isDataLake: boolean;
  onDeleteDatabaseClick(connectionId: string, ns: string): void;
  onCreateDatabaseClick(connectionId: string): void;
  onRefreshClick(): void;
};

const Databases: React.FunctionComponent<DatabasesProps> = ({
  databases,
  databasesLoadingStatus,
  databasesLoadingError,
  isWritable,
  isDataLake,
  isGenuineMongoDB,
  onDeleteDatabaseClick: _onDeleteDatabaseClick,
  onCreateDatabaseClick: _onCreateDatabaseClick,
  onRefreshClick,
}) => {
  const { id: connectionId } = useConnectionInfo();
  const isPreferencesReadOnly = usePreference('readOnly');
  const { openCollectionsWorkspace } = useOpenWorkspace();

  const onDatabaseClick = useCallback(
    (ns: string) => {
      openCollectionsWorkspace(connectionId, ns);
    },
    [connectionId, openCollectionsWorkspace]
  );

  const onDeleteDatabaseClick = useCallback(
    (ns: string) => {
      _onDeleteDatabaseClick(connectionId, ns);
    },
    [connectionId, _onDeleteDatabaseClick]
  );

  const onCreateDatabaseClick = useCallback(() => {
    _onCreateDatabaseClick(connectionId);
  }, [connectionId, _onCreateDatabaseClick]);

  useTrackOnChange((track: TrackFunction) => {
    track('Screen', { name: 'databases' });
  }, []);

  if (databasesLoadingStatus === 'error') {
    return (
      <div className={errorContainerStyles}>
        <Banner variant={BannerVariant.Danger}>
          {databasesLoadingError
            ? `${ERROR_WARNING}: ${databasesLoadingError}`
            : ERROR_WARNING}
        </Banner>
      </div>
    );
  }

  if (databases.length === 0 && !isGenuineMongoDB) {
    return <NonGenuineZeroState />;
  }

  const editable = isWritable && !isPreferencesReadOnly;
  const actions = Object.assign(
    {
      onDatabaseClick,
      onRefreshClick,
    },
    editable && !isDataLake
      ? {
          onDeleteDatabaseClick,
          onCreateDatabaseClick,
        }
      : {}
  );

  return <DatabasesList databases={databases} {...actions} />;
};

const mapStateToProps = (state: DatabasesState) => {
  return {
    databases: state.databases,
    databasesLoadingStatus: state.databasesLoadingStatus.status,
    databasesLoadingError: state.databasesLoadingStatus.error,
    isWritable: state.instance.isWritable,
    isDataLake: state.instance.isDataLake,
    isGenuineMongoDB: state.instance.isGenuineMongoDB,
  };
};

const mapDispatchToProps = {
  onRefreshClick: refreshDatabases,
  onDeleteDatabaseClick: dropDatabase,
  onCreateDatabaseClick: createDatabase,
};

/**
 * Connect the redux store to the component.
 * (dispatch)
 */
const ConnectedDatabases = connect(
  mapStateToProps,
  mapDispatchToProps
)(Databases) as React.FunctionComponent<Record<string, never>>;

export default ConnectedDatabases;
export { Databases };
