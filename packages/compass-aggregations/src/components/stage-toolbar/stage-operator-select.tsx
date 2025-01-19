import React, { useCallback, useEffect, useRef } from 'react';
import { withPreferences } from 'compass-preferences-model/provider';
import { connect } from 'react-redux';

import {
  Combobox,
  ComboboxOption,
  css,
  spacing,
} from '@mongodb-js/compass-components';

import type { RootState } from '../../modules';
import { changeStageOperator } from '../../modules/pipeline-builder/stage-editor';
import type { StoreStage } from '../../modules/pipeline-builder/stage-editor';

import { filterStageOperators } from '../../utils/stage';
import { isAtlasOnly } from '../../utils/stage';
import type { ServerEnvironment } from '../../modules/env';

const inputWidth = spacing[1400] * 3;
const inputHeight = spacing[600] - 2; // match other xs controls
// width of options popover
const comboxboxOptionsWidth = spacing[1200] * 10;
// left position of options popover wrt input. this aligns it with the start of input
const comboboxOptionsLeft = (comboxboxOptionsWidth - inputWidth) / 2;

const comboboxStyles = css({
  width: inputWidth,
  '& [role="combobox"]': {
    padding: 0,
    paddingLeft: spacing[100],
    height: inputHeight,
    '& > div': {
      minHeight: inputHeight,
    },
  },
  '> :popover-open': {
    width: comboxboxOptionsWidth,
    whiteSpace: 'normal',
    // -4px to count for the input focus outline.
    marginLeft: `${comboboxOptionsLeft - 4}px`,
  },
});

type StageOperatorSelectProps = {
  onChange: (index: number, name: string | null, snippet?: string) => void;
  index: number;
  selectedStage: string | null;
  isDisabled: boolean;
  stages: {
    name: string;
    env: ServerEnvironment[];
    description: string;
  }[];
  ref: React.Ref<ComboBox>;
};

// exported for tests
export const StageOperatorSelect = ({
  onChange,
  index,
  selectedStage,
  isDisabled,
  stages,
  setToFocusStageComboBox,
  toFocusStageComboBox,
}: StageOperatorSelectProps) => {
  const onStageOperatorSelected = useCallback(
    (name: string | null) => {
      onChange(index, name);
    },
    [onChange, index]
  );

  const ariaLabel = 'Select a stage operator';

  const stageRef = useRef(null);
  useEffect(() => {
    if (toFocusStageComboBox && stageRef?.current) {
      stageRef.current
        .querySelector(`input[aria-label="${ariaLabel}"]`)
        .focus();
    }
    setToFocusStageComboBox(false);
  }, [stageRef, toFocusStageComboBox]);

  return (
    <div ref={stageRef}>
      <Combobox
        value={selectedStage}
        disabled={isDisabled}
        aria-label={ariaLabel}
        onChange={onStageOperatorSelected}
        size="default"
        clearable={false}
        data-testid="stage-operator-combobox"
        className={comboboxStyles}
      >
        {stages.map((stage, index) => (
          <ComboboxOption
            data-testid={`combobox-option-stage-${stage.name}`}
            key={`combobox-option-stage-${index}`}
            value={stage.name}
            description={
              (isAtlasOnly(stage.env) ? 'Atlas only. ' : '') + stage.description
            }
          />
        ))}
      </Combobox>
    </div>
  );
};

export default withPreferences(
  connect(
    (
      state: RootState,
      ownProps: {
        index: number;
        readOnly: boolean;
        onChange?: (
          index: number,
          name: string | null,
          snippet?: string
        ) => void;
      }
    ) => {
      const stage = state.pipelineBuilder.stageEditor.stages[
        ownProps.index
      ] as StoreStage;

      const stages = filterStageOperators({
        serverVersion: state.serverVersion,
        env: state.env,
        isTimeSeries: state.isTimeSeries,
        sourceName: state.sourceName,
        preferencesReadOnly: ownProps.readOnly,
      });
      return {
        selectedStage: stage.stageOperator,
        isDisabled: stage.disabled,
        stages: stages,
      };
    },
    (dispatch: any, ownProps) => {
      return {
        onChange(index: number, name: string | null) {
          const snippet = dispatch(changeStageOperator(index, name ?? ''));
          ownProps.onChange?.(index, name, snippet);
        },
      };
    }
  )(StageOperatorSelect),
  ['readOnly']
);
