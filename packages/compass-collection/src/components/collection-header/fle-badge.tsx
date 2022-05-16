import React from 'react';
import {
  Badge,
  BadgeVariant,
  css,
  spacing,
  Icon,
} from '@mongodb-js/compass-components';

const collectionHeaderBadgeStyles = css({
  marginLeft: spacing[2],
});

const FLEBadge = (): React.ReactElement => (
  <Badge
    data-testid="collection-badge-fle"
    className={collectionHeaderBadgeStyles}
    variant={BadgeVariant.DarkGray}
  >
    {/* Queryable Encryption is the user-facing name of FLE2 */}
    <Icon glyph="Key" title="Queryable Encryption" size="small" />
    &nbsp;Queryable Encryption
  </Badge>
);

export default FLEBadge;
