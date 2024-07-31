import chai from 'chai';
import { MongoClient } from 'mongodb';
import type { CompassBrowser } from '../helpers/compass-browser';
import {
  init,
  cleanup,
  screenshotIfFailed,
  DEFAULT_CONNECTION_STRING,
  skipForWeb,
  TEST_MULTIPLE_CONNECTIONS,
  DEFAULT_CONNECTION_NAME,
} from '../helpers/compass';
import type { Compass } from '../helpers/compass';
import * as Selectors from '../helpers/selectors';
import { createNumbersCollection } from '../helpers/insert-data';

const { expect } = chai;

describe('Instance sidebar', function () {
  let compass: Compass;
  let browser: CompassBrowser;
  let connectionId: string | undefined;

  before(async function () {
    compass = await init(this.test?.fullTitle());
    browser = compass.browser;
  });

  beforeEach(async function () {
    await createNumbersCollection();
    await browser.connectWithConnectionString();
    connectionId = await browser.getConnectionIdByName(DEFAULT_CONNECTION_NAME);
  });

  after(async function () {
    await cleanup(compass);
  });

  afterEach(async function () {
    await screenshotIfFailed(compass, this.currentTest);
  });

  it('has a connection info modal with connection info', async function () {
    skipForWeb(this, "these actions don't exist in compass-web");

    if (TEST_MULTIPLE_CONNECTIONS) {
      await browser.selectConnectionMenuItem(
        DEFAULT_CONNECTION_NAME,
        Selectors.Multiple.ClusterInfoItem
      );
    } else {
      await browser.clickVisible(Selectors.Single.ShowTitleActionsButton);
      await browser.clickVisible(Selectors.Single.ClusterInfoItem);
    }

    const modal = await browser.$(Selectors.ConnectionInfoModal);
    await modal.waitForDisplayed();

    await browser.screenshot('connection-info-modal.png');

    await browser.clickVisible(Selectors.ConnectionInfoModalCloseButton);
    await modal.waitForDisplayed({ reverse: true });
  });

  it('contains a dbs/collections tree view', async function () {
    const dbName = 'test';
    const collectionName = 'numbers';
    const dbElement = await browser.$(
      Selectors.sidebarDatabase(connectionId, dbName)
    );
    await dbElement.waitForDisplayed();

    await browser.clickVisible(
      Selectors.sidebarDatabaseToggle(connectionId, dbName)
    );

    const collectionSelector = Selectors.sidebarCollection(
      connectionId,
      dbName,
      collectionName
    );
    await browser.scrollToVirtualItem(
      Selectors.SidebarNavigationTree,
      collectionSelector,
      'tree'
    );
    const collectionElement = await browser.$(collectionSelector);
    await collectionElement.waitForDisplayed();
  });

  it('can search for a collection', async function () {
    // wait for something to appear so we can be sure that things went away vs just not appearing yet
    await browser.waitUntil(async () => {
      const treeItems = await browser.$$(Selectors.SidebarTreeItems);
      return treeItems.length > 0;
    });

    // search for something that cannot be found to get the results to a known empty state
    await browser.clickVisible(Selectors.SidebarFilterInput);
    await browser.setValueVisible(
      Selectors.SidebarFilterInput,
      'this does not exist'
    );

    // make sure there's nothing visible
    await browser.waitUntil(async () => {
      const treeItems = await browser.$$(Selectors.SidebarTreeItems);
      return treeItems.length === 0;
    });

    // now search for something specific
    await browser.setValueVisible(Selectors.SidebarFilterInput, 'numbers');

    await browser.waitUntil(async () => {
      const treeItems = await browser.$$(Selectors.SidebarTreeItems);
      // connection, database, collection for multiple connections, otherwise just database and collection
      const expectedCount = TEST_MULTIPLE_CONNECTIONS ? 3 : 2;
      return treeItems.length === expectedCount;
    });

    const dbElement = await browser.$(
      Selectors.sidebarDatabase(connectionId, 'test')
    );
    expect(await dbElement.isDisplayed()).to.be.true;

    const collectionSelector = Selectors.sidebarCollection(
      connectionId,
      'test',
      'numbers'
    );
    await browser.scrollToVirtualItem(
      Selectors.SidebarNavigationTree,
      collectionSelector,
      'tree'
    );

    const collectionElement = await browser.$(collectionSelector);
    expect(await collectionElement.isDisplayed()).to.be.true;

    await browser.setValueVisible(Selectors.SidebarFilterInput, '*');

    // wait for something that didn't match the previous search to show up to make sure that it reset
    // (otherwise future tests will fail because the new dbs/collections won't match the filter)
    const adminElement = await browser.$(
      Selectors.sidebarDatabase(connectionId, 'admin')
    );
    await adminElement.waitForDisplayed();
  });

  it('can create a database and drop it', async function () {
    // TODO(COMPASS-7086): flaky test
    this.retries(5);

    const Sidebar = TEST_MULTIPLE_CONNECTIONS
      ? Selectors.Multiple
      : Selectors.Single;

    const dbName = `my-sidebar-database-${Date.now()}`;
    const collectionName = 'my-collection';

    if (TEST_MULTIPLE_CONNECTIONS) {
      // navigate to the databases tab so that the connection is
      // active/highlighted and then the add button and three dot menu will
      // display without needing to hover
      await browser.navigateToConnectionTab(
        DEFAULT_CONNECTION_NAME,
        'Databases'
      );
    }

    // open the create database modal from the sidebar
    if (TEST_MULTIPLE_CONNECTIONS) {
      await browser.selectConnectionMenuItem(
        DEFAULT_CONNECTION_NAME,
        Sidebar.CreateDatabaseButton,
        false
      );
    } else {
      await browser.clickVisible(Sidebar.CreateDatabaseButton);
    }

    await browser.addDatabase(dbName, collectionName);

    // the app should land on the collection's documents tab
    const headerSelector = Selectors.CollectionHeader;
    await browser.$(headerSelector).waitForDisplayed();
    await browser
      .$(Selectors.collectionSubTab('Documents', true))
      .waitForDisplayed();

    await browser.clickVisible(Selectors.sidebarDatabase(connectionId, dbName));

    // wait for it to appear
    const collectionElement = await browser.$(
      Selectors.sidebarCollection(connectionId, dbName, collectionName)
    );
    await collectionElement.waitForDisplayed();

    await browser.dropDatabaseFromSidebar(DEFAULT_CONNECTION_NAME, dbName);
  });

  it('can create a collection and drop it', async function () {
    const dbName = 'test'; // existing db
    const collectionName = 'my-sidebar-collection';

    await browser.clickVisible(Selectors.SidebarFilterInput);
    await browser.setValueVisible(Selectors.SidebarFilterInput, dbName);

    const dbElement = await browser.$(
      Selectors.sidebarDatabase(connectionId, dbName)
    );
    await dbElement.waitForDisplayed();

    await browser.hover(Selectors.sidebarDatabase(connectionId, dbName));

    await browser.clickVisible(Selectors.CreateCollectionButton);

    await browser.addCollection(collectionName);

    // the app should land on the collection's documents tab
    const headerSelector = Selectors.CollectionHeader;
    await browser.$(headerSelector).waitForDisplayed();
    const tabSelectedSelector = Selectors.collectionSubTab('Documents', true);
    await browser.$(tabSelectedSelector).waitForDisplayed();

    await browser.dropCollectionFromSidebar(
      DEFAULT_CONNECTION_NAME,
      dbName,
      collectionName
    );
  });

  it('can refresh the databases', async function () {
    const db = 'test';
    const coll = `coll_${Date.now()}`;

    // expand the database entry in the sidebar
    await browser.clickVisible(Selectors.sidebarDatabase(connectionId, db));

    // wait until the collections finish loading
    const numbersCollectionElement = await browser.$(
      Selectors.sidebarCollection(connectionId, db, 'numbers')
    );
    await numbersCollectionElement.waitForDisplayed();

    const mongoClient = new MongoClient(DEFAULT_CONNECTION_STRING);
    await mongoClient.connect();
    try {
      const database = mongoClient.db(db);
      await database.createCollection(coll);
    } finally {
      await mongoClient.close();
    }

    if (TEST_MULTIPLE_CONNECTIONS) {
      await browser.selectConnectionMenuItem(
        DEFAULT_CONNECTION_NAME,
        Selectors.Multiple.RefreshDatabasesItem
      );
    } else {
      await browser.clickVisible(Selectors.Single.RefreshDatabasesButton);
    }

    // wait for the new collection we added via the driver to appear.
    const newCollectionElement = await browser.$(
      Selectors.sidebarCollection(connectionId, db, coll)
    );
    await newCollectionElement.waitForDisplayed();
  });
});
