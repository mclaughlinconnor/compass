import React from 'react';
import { spacing } from '@leafygreen-ui/tokens';
import { css, cx } from '@leafygreen-ui/emotion';
import { palette } from '@leafygreen-ui/palette';
import { useDarkMode } from '../hooks/use-theme';
import { Link, Icon, Body } from './leafygreen';

export type BreadcrumbItem = {
  name: string;
  onClick: () => void;
};

const breadcrumbStyles = css({
  display: 'flex',
  gap: spacing[1],
  alignItems: 'center',
  height: spacing[4],
  minWidth: 0,
});

const itemLightStyles = css({
  color: palette.green.dark2,
});

const itemDarkStyles = css({
  color: palette.green.base,
});

const breadcrumbButtonStyles = css({
  border: 'none',
  background: 'none',
  padding: 0,
  display: 'block',
});

const textStyles = css({
  fontWeight: 'bold',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const lastItemStylesLight = css({
  color: palette.gray.dark1,
});

const lastItemStylesDark = css({
  color: palette.gray.base,
});

const iconStyles = css({
  flexShrink: 0,
});

export const Breadcrumbs = ({ items }: { items: Array<BreadcrumbItem> }) => {
  const darkMode = useDarkMode();
  return (
    <div className={breadcrumbStyles} data-testid="breadcrumbs">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        if (isLast) {
          return (
            <Body
              className={cx(
                textStyles,
                darkMode ? lastItemStylesDark : lastItemStylesLight
              )}
            >
              {item.name}
            </Body>
          );
        }
        return (
          <>
            <Link
              key={item.name}
              as="button"
              hideExternalIcon={true}
              className={cx(breadcrumbButtonStyles, textStyles)}
              onClick={item.onClick}
              title={item.name}
            >
              <Body
                className={cx(
                  textStyles,
                  darkMode ? itemDarkStyles : itemLightStyles
                )}
              >
                {item.name}
              </Body>
            </Link>
            <Icon
              glyph="ChevronRight"
              size="small"
              color={palette.gray.light1}
              className={iconStyles}
            />
          </>
        );
      })}
    </div>
  );
};
