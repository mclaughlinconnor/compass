import React, { useMemo, useRef } from 'react';
import type { Signal } from '@mongodb-js/compass-components';
import {
  css,
  cx,
  useFocusRing,
  palette,
  spacing,
  SignalPopover,
} from '@mongodb-js/compass-components';
import type {
  Command,
  CompletionWithServerInfo,
} from '@mongodb-js/compass-editor';
import {
  CodemirrorInlineEditor as InlineEditor,
  createQueryAutocompleter,
} from '@mongodb-js/compass-editor';
import { connect } from 'react-redux';
import { usePreference } from 'compass-preferences-model';

import type { RootState } from '../stores/query-bar-store';

const editorContainerStyles = css({
  position: 'relative',
  display: 'flex',
  width: '100%',
  minWidth: spacing[7],
  // To match codemirror editor with leafygreen inputs.
  paddingTop: 1,
  paddingBottom: 1,
  paddingLeft: 4,
  paddingRight: 0,
  border: '1px solid transparent',
  borderRadius: spacing[1],
  overflow: 'visible',
});

const editorWithErrorStyles = css({
  '&:after': {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    zIndex: 2,
    borderRadius: spacing[1],
    border: `1px solid ${palette.red.base}`,
    pointerEvents: 'none',
  },
  '&:focus-within': {
    borderColor: palette.gray.base,
  },
});

const queryBarEditorOptionInsightsStyles = css({
  alignSelf: 'flex-start',
  // To align the icon in the middle of the first line of the editor input
  // (<input height> - <insight badge height>) / 2
  paddingTop: 3,
  paddingBottom: 3,
  paddingLeft: 3,
  paddingRight: 3,

  // We make container the size of the collapsed insight to avoid additional
  // shrinking of the editor content when hoveing over the icon. In this case
  // it's okay for the content to be hidden by the expanded badge as user is
  // interacting with the badge
  width: spacing[4],
  height: spacing[4],
  overflow: 'visible',
  display: 'flex',
  justifyContent: 'flex-end',
});

const insightsBadgeStyles = css({
  flex: 'none',
});

type OptionEditorProps = {
  hasError: boolean;
  id: string;
  onChange: (value: string) => void;
  onApply?(): void;
  placeholder?: string | HTMLElement;
  schemaFields?: CompletionWithServerInfo[];
  serverVersion?: string;
  value?: string;
  ['data-testid']?: string;
  insights?: Signal | Signal[];
};

const OptionEditor: React.FunctionComponent<OptionEditorProps> = ({
  hasError,
  id,
  onChange,
  onApply,
  placeholder,
  schemaFields = [],
  serverVersion = '3.6.0',
  value = '',
  ['data-testid']: dataTestId,
  insights,
}) => {
  const showInsights = usePreference('showInsights', React);

  const editorContainerRef = useRef<HTMLDivElement>(null);

  const focusRingProps = useFocusRing({
    outer: true,
    focusWithin: true,
    hover: true,
  });

  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;

  const commands = useMemo<Command[]>(() => {
    return [
      {
        key: 'Enter',
        run() {
          onApplyRef.current?.();
          return true;
        },
        preventDefault: true,
      },
    ];
  }, []);

  const completer = useMemo(() => {
    return createQueryAutocompleter({
      fields: schemaFields
        .filter(
          (field): field is { name: string } & CompletionWithServerInfo =>
            !!field.name
        )
        .map((field) => ({
          name: field.name,
          description: field.description,
        })),
      serverVersion,
    });
  }, [schemaFields, serverVersion]);

  return (
    <div
      className={cx(
        editorContainerStyles,
        focusRingProps.className,
        hasError && editorWithErrorStyles
      )}
      ref={editorContainerRef}
    >
      <InlineEditor
        id={id}
        text={value}
        onChangeText={onChange}
        placeholder={placeholder}
        completer={completer}
        commands={commands}
        data-testid={dataTestId}
      />
      {showInsights && insights && (
        <div className={queryBarEditorOptionInsightsStyles}>
          <SignalPopover
            className={insightsBadgeStyles}
            signals={insights}
          ></SignalPopover>
        </div>
      )}
    </div>
  );
};

const ConnectedOptionEditor = connect((state: RootState) => {
  return {
    schemaFields: state.queryBar.schemaFields as CompletionWithServerInfo[],
    serverVersion: state.queryBar.serverVersion,
  };
})(OptionEditor);

export default ConnectedOptionEditor;
