import type { CompassBrowser } from '../compass-browser';
import * as Selectors from '../selectors';

async function navigateToCollection(
  browser: CompassBrowser,
  // TODO(COMPASS-8002): take connectionName into account
  dbName: string,
  collectionName: string,

  // Close all the workspace tabs to get rid of all the state we
  // might have accumulated. This is the only way to get back to the zero
  // state of Schema, and Validation tabs without re-connecting.
  closeExistingTabs = true
): Promise<void> {
  const collectionSelector = Selectors.sidebarCollection(
    dbName,
    collectionName
  );

  if (closeExistingTabs) {
    await browser.closeWorkspaceTabs();
  }

  // search for the collection and wait for the collection to be there and visible
  await browser.clickVisible(Selectors.SidebarFilterInput);
  await browser.setValueVisible(Selectors.SidebarFilterInput, collectionName);
  const collectionElement = await browser.$(collectionSelector);

  await collectionElement.waitForDisplayed();

  // click it and wait for the collection header to become visible
  await browser.clickVisible(collectionSelector);
  await waitUntilActiveCollectionTab(browser, dbName, collectionName);
}

export async function navigateToCollectionTab(
  browser: CompassBrowser,
  // TODO(COMPASS-8002): take connectionName into account
  dbName: string,
  collectionName: string,
  tabName:
    | 'Documents'
    | 'Aggregations'
    | 'Schema'
    | 'Indexes'
    | 'Validation' = 'Documents',
  closeExistingTabs = true
): Promise<void> {
  await navigateToCollection(
    browser,
    dbName,
    collectionName,
    closeExistingTabs
  );
  await navigateWithinCurrentCollectionTabs(browser, tabName);
}

export async function navigateWithinCurrentCollectionTabs(
  browser: CompassBrowser,
  // TODO(COMPASS-8002): take connectionName into account
  tabName:
    | 'Documents'
    | 'Aggregations'
    | 'Schema'
    | 'Indexes'
    | 'Validation' = 'Documents'
): Promise<void> {
  const tab = browser.$(Selectors.collectionSubTab(tabName));
  const selectedTab = browser.$(Selectors.collectionSubTab(tabName, true));

  if (await selectedTab.isExisting()) {
    return;
  }

  // otherwise select the tab and wait for it to become selected
  await browser.clickVisible(tab);
  await waitUntilActiveCollectionSubTab(browser, tabName);
}

export async function waitUntilActiveCollectionTab(
  browser: CompassBrowser,
  // TODO(COMPASS-8002): take connectionName into account
  dbName: string,
  collectionName: string,
  tabName:
    | 'Documents'
    | 'Aggregations'
    | 'Schema'
    | 'Indexes'
    | 'Validation'
    | null = null
) {
  await browser
    .$(Selectors.collectionWorkspaceTab(`${dbName}.${collectionName}`, true))
    .waitForDisplayed();
  if (tabName) {
    await waitUntilActiveCollectionSubTab(browser, tabName);
  }
}

export async function waitUntilActiveCollectionSubTab(
  browser: CompassBrowser,
  // TODO(COMPASS-8002): take connectionName into account
  tabName:
    | 'Documents'
    | 'Aggregations'
    | 'Schema'
    | 'Indexes'
    | 'Validation' = 'Documents'
) {
  await browser.$(Selectors.collectionSubTab(tabName, true)).waitForDisplayed();
}

export async function getActiveTabNamespace(browser: CompassBrowser) {
  const activeWorkspaceNamespace = await browser
    .$(Selectors.workspaceTab(null, true))
    .getAttribute('data-namespace');
  return activeWorkspaceNamespace || null;
}
