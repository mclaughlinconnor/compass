import type { CompassBrowser } from '../compass-browser';
import * as Selectors from '../selectors';

import Debug from 'debug';

const debug = Debug('compass-e2e-tests');

async function isToastContainerVisible(
  browser: CompassBrowser
): Promise<boolean> {
  const toastContainer = await browser.$(Selectors.LGToastContainer);
  return await toastContainer.isDisplayed();
}

export async function hideAllVisibleToasts(
  browser: CompassBrowser
): Promise<void> {
  // If there's some race condition where something else is closing the toast at
  // the same time we're trying to close the toast, then make it error out
  // quickly so it can be ignored and we move on.
  const waitOptions = { timeout: 2_000 };

  // LG toasts are stacked in scroll container and we need to close them all.
  if (!(await isToastContainerVisible(browser))) {
    return;
  }

  const toasts = await browser.$(Selectors.LGToastContainer).$$('div');
  for (const _toast of toasts) {
    // if they all went away at some point, just stop
    if (!(await isToastContainerVisible(browser))) {
      return;
    }

    const toastTestId = await _toast.getAttribute('data-testid');
    const toastSelector = `[data-testid=${toastTestId}]`;

    try {
      await browser.hover(Selectors.LGToastContainer);
      const isToastVisible = await browser.$(toastSelector).isDisplayed();
      if (!isToastVisible) {
        continue;
      }
      debug('closing toast', toastTestId);
      await browser.clickVisible(
        `${toastSelector} ${Selectors.LGToastCloseButton}`,
        waitOptions
      );
      debug('waiting for toast to go away', toastTestId);
      await browser
        .$(toastSelector)
        .waitForExist({ ...waitOptions, reverse: true });
    } catch (err) {
      // if the toast disappears by itself in the meantime, that's fine
      debug('ignoring', err);
    }
    debug('done closing', toastTestId);
  }
}
