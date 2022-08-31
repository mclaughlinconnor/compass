/* eslint-disable react/prop-types */
import React, { useCallback, useMemo } from 'react';
import {
  useHoverState,
  spacing,
  css,
  cx,
  ItemActionControls,
  SmallIcon,
} from '@mongodb-js/compass-components';
import type { ItemAction } from '@mongodb-js/compass-components';
import { DATABASE_ROW_HEIGHT } from './constants';
import { ItemContainer, ItemLabel } from './tree-item';
import type {
  VirtualListItemProps,
  TreeItemProps,
  NamespaceItemProps,
} from './tree-item';
import type { Actions } from './constants';

const buttonReset = css({
  padding: 0,
  margin: 0,
  background: 'none',
  border: 'none',
});

const expandButton = css({
  // Not using leafygreen spacing here because none of them allow to align the
  // button with the search bar content. This probably can go away when we are
  // rebuilding the search also
  padding: 7,
  transition: 'transform .16s linear',
  transform: 'rotate(0deg)',
  '&:hover': {
    cursor: 'pointer',
  },
});

const expanded = css({
  transform: 'rotate(90deg)',
});

const ExpandButton: React.FunctionComponent<{
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  isExpanded: boolean;
}> = ({ onClick, isExpanded }) => {
  return (
    <button
      type="button"
      // We don't want this button to be part of the navigation sequence as
      // this breaks the tab flow when navigating through the tree. If you
      // are focused on a particular item in the list, you can expand /
      // collapse it using keyboard, so the button is only valuable when
      // using a mouse
      tabIndex={-1}
      onClick={onClick}
      className={cx(buttonReset, expandButton, isExpanded && expanded)}
    >
      <SmallIcon glyph="CaretRight" mode="normal"></SmallIcon>
    </button>
  );
};

const databaseItem = css({
  height: DATABASE_ROW_HEIGHT,
  paddingRight: spacing[1],
});

const databaseItemOldSpacing = css({
  paddingLeft: spacing[1],
});

const databaseItemNewSpacing = css({
  paddingLeft: spacing[2],
});

const databaseItemLabelOldSpacing = css({
  marginLeft: spacing[1],
});

const databaseItemLabelNewSpacing = css({
  marginLeft: spacing[2],
});

const databaseActions = css({
  marginLeft: 'auto',
});

export const DatabaseItem: React.FunctionComponent<
  VirtualListItemProps &
    TreeItemProps &
    NamespaceItemProps & {
      isExpanded: boolean;
      onDatabaseExpand(id: string, isExpanded: boolean): void;
    }
> = ({
  id,
  name,
  posInSet,
  setSize,
  isExpanded,
  isActive,
  isReadOnly,
  isTabbable,
  style,
  onNamespaceAction,
  onDatabaseExpand,
}) => {
  const [hoverProps, isHovered] = useHoverState();

  const onExpandButtonClick = useCallback(
    (evt: React.MouseEvent<HTMLButtonElement>) => {
      evt.stopPropagation();
      onDatabaseExpand(id, !isExpanded);
    },
    [onDatabaseExpand, id, isExpanded]
  );

  const onDefaultAction = useCallback(
    (evt) => {
      onNamespaceAction(
        evt.currentTarget.dataset.id as string,
        'select-database'
      );
    },
    [onNamespaceAction]
  );

  const onAction = useCallback(
    (action: Actions) => {
      onNamespaceAction(id, action);
    },
    [id, onNamespaceAction]
  );

  const actions: ItemAction<Actions>[] = useMemo(() => {
    return [
      {
        action: 'create-collection',
        icon: 'Plus',
        label: 'Create collection',
      },
      {
        action: 'drop-database',
        icon: 'Trash',
        label: 'Drop database',
      },
    ];
  }, []);

  const useNewSidebar = process?.env?.COMPASS_SHOW_NEW_SIDEBAR === 'true';

  return (
    <ItemContainer
      id={id}
      data-testid={`sidebar-database-${id}`}
      level={1}
      setSize={setSize}
      posInSet={posInSet}
      isExpanded={isExpanded}
      isActive={isActive}
      isTabbable={isTabbable}
      onDefaultAction={onDefaultAction}
      className={cx(
        databaseItem,
        useNewSidebar ? databaseItemNewSpacing : databaseItemOldSpacing
      )}
      style={style}
      {...hoverProps}
    >
      <ExpandButton
        onClick={onExpandButtonClick}
        isExpanded={isExpanded}
      ></ExpandButton>
      {useNewSidebar && <SmallIcon glyph="Database" mode="inherit"></SmallIcon>}
      <ItemLabel
        className={
          useNewSidebar
            ? databaseItemLabelNewSpacing
            : databaseItemLabelOldSpacing
        }
      >
        {name}
      </ItemLabel>
      {!isReadOnly && (
        <ItemActionControls<Actions>
          className={databaseActions}
          onAction={onAction}
          isActive={isActive}
          isHovered={isHovered}
          actions={actions}
          mode="hovered"
        ></ItemActionControls>
      )}
    </ItemContainer>
  );
};
