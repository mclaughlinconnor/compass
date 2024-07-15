import React from 'react';
import { expect } from 'chai';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OptionEditor } from './option-editor';
import type { SinonSpy } from 'sinon';
import { applyFromHistory } from '../stores/query-bar-reducer';
import sinon from 'sinon';

class MockPasteEvent extends window.Event {
  constructor(private text: string) {
    super('paste', { bubbles: true, cancelable: true });
  }
  clipboardData = {
    getData: () => {
      return this.text;
    },
  };
}

describe('OptionEditor', function () {
  beforeEach(function () {
    if ((process as any).type === 'renderer') {
      // Skipping due to COMPASS-7103
      this.skip();
    }
  });

  afterEach(function () {
    cleanup();
  });

  describe('with autofix enabled', function () {
    it('fills the input with an empty object "{}" when empty on focus', async function () {
      render(
        <OptionEditor
          namespace="test.test"
          insertEmptyDocOnFocus
          onChange={() => {}}
          value=""
          savedQueries={[]}
          onApplyQuery={applyFromHistory}
        ></OptionEditor>
      );

      expect(screen.getByRole('textbox').textContent).to.eq('');

      userEvent.click(screen.getByRole('textbox'));

      await waitFor(() => {
        expect(screen.getByRole('textbox').textContent).to.eq('{}');
      });
    });

    it('does not change input value when empty on focus', async function () {
      render(
        <OptionEditor
          namespace="test.test"
          insertEmptyDocOnFocus
          onChange={() => {}}
          value="{ foo: 1 }"
          savedQueries={[]}
          onApplyQuery={applyFromHistory}
        ></OptionEditor>
      );

      expect(screen.getByRole('textbox').textContent).to.eq('{ foo: 1 }');

      userEvent.click(screen.getByRole('textbox'));

      await waitFor(() => {
        expect(screen.getByRole('textbox').textContent).to.eq('{ foo: 1 }');
      });
    });

    it('should adjust pasted query if pasting over empty brackets with the cursor in the middle', async function () {
      render(
        <OptionEditor
          namespace="test.test"
          insertEmptyDocOnFocus
          onChange={() => {}}
          value=""
          savedQueries={[]}
          onApplyQuery={applyFromHistory}
        ></OptionEditor>
      );

      userEvent.tab();

      await waitFor(() => {
        expect(screen.getByRole('textbox').textContent).to.eq('{}');
      });

      screen
        .getByRole('textbox')
        .dispatchEvent(new MockPasteEvent('{ foo: 1 }'));

      await waitFor(() => {
        expect(screen.getByRole('textbox').textContent).to.eq('{ foo: 1 }');
      });
    });

    it('should not modify user text whe pasting when cursor moved', async function () {
      render(
        <OptionEditor
          namespace="test.test"
          insertEmptyDocOnFocus
          onChange={() => {}}
          value=""
          savedQueries={[]}
          onApplyQuery={applyFromHistory}
        ></OptionEditor>
      );

      userEvent.tab();

      await waitFor(() => {
        expect(screen.getByRole('textbox').textContent).to.eq('{}');
      });

      userEvent.keyboard('{arrowright}');

      screen
        .getByRole('textbox')
        .dispatchEvent(new MockPasteEvent('{ foo: 1 }'));

      await waitFor(() => {
        expect(screen.getByRole('textbox').textContent).to.eq('{}{ foo: 1 }');
      });
    });

    it('should not modify user text when pasting in empty input', async function () {
      render(
        <OptionEditor
          namespace="test.test"
          insertEmptyDocOnFocus
          onChange={() => {}}
          value=""
          savedQueries={[]}
          onApplyQuery={applyFromHistory}
        ></OptionEditor>
      );

      userEvent.tab();
      userEvent.keyboard('{arrowright}{backspace}{backspace}{backspace}');

      screen
        .getByRole('textbox')
        .dispatchEvent(new MockPasteEvent('{ foo: 1 }'));

      await waitFor(() => {
        expect(screen.getByRole('textbox').textContent).to.eq('{ foo: 1 }');
      });
    });
  });

  describe('createQueryWithHistoryAutocompleter', function () {
    let onApplySpy: SinonSpy;

    afterEach(function () {
      cleanup();
    });

    it('filter applied correctly when autocomplete option is clicked', async function () {
      onApplySpy = sinon.spy();
      render(
        <OptionEditor
          namespace="test.test"
          insertEmptyDocOnFocus
          onChange={() => {}}
          value=""
          savedQueries={[
            {
              _id: '1',
              _ns: '1',
              filter: { a: 1 },
              _lastExecuted: new Date(),
            },
            {
              _id: '1',
              _ns: '1',
              filter: { a: 2 },
              sort: { a: -1 },
              _lastExecuted: new Date(),
            },
          ]}
          onApplyQuery={onApplySpy}
        ></OptionEditor>
      );

      userEvent.click(screen.getByRole('textbox'));
      await waitFor(() => {
        expect(screen.getAllByText('{ a: 1 }')[0]).to.be.visible;
        expect(screen.getAllByText('{ a: 1 }')[1]).to.be.visible;
        expect(screen.getByText('{ a: 2 }, sort: { a: -1 }')).to.be.visible;
      });

      // Simulate selecting the autocomplete option
      userEvent.click(screen.getByText('{ a: 2 }, sort: { a: -1 }'));
      await waitFor(() => {
        expect(onApplySpy.lastCall).to.be.calledWithExactly({
          filter: { a: 2 },
          sort: { a: -1 },
        });
      });
    });
  });
});
