const navigationDataFactory = require('./apiNavigationDataFactory');
const contentDataFactory = require('./apiContentDataFactory');
const helper = require('./apiDataFactoryHelper');

let navItems = [];
let searchItems = [];
let etcItems = [];

let navMap = {};
let contentMap = {};

/**
 * Make of base date
 * @param {string} name - original name
 * @param {string} kind - current item kind
 * @returns {string} replaced name
 */
function makeName(name, kind) {
  let replacedName = name.replace(/"/g, '');

  if (kind === 'module') {
    replacedName = replacedName.replace('module:', '');
  }

  return replacedName;
}

/**
 * Make base date for using each list item
 * @param {Object} item - current doc-data
 * @returns {Object} base data
 */
function makeBaseData(item) {
  const {
    name,
    kind,
    memberof
  } = item;
  const replacedName = makeName(name, kind, memberof);
  const pid = helper.makePid(replacedName);

  return {
    pid,
    kind,
    name: replacedName
  };
}

/**
 * Add data to navigation list
 * @param {Object} data - parent data
 */
function addNavItem(data) {
  const customItem = navigationDataFactory.makeNavData(data);

  navItems.push(customItem);
}

/**
 * Add data to sub-navigation list
 * @param {Array.<Object>} item - current doc-data
 * @param {Object} parent - parent data
 */
function addSubNavItems(item, parent) {
  const customItems = navigationDataFactory.makeSubNavData(item, parent);
  const parentId = parent.pid;

  if (!navMap[parentId]) {
    navMap[parentId] = [];
  }

  navMap[parentId] = navMap[parentId].concat(customItems);
}

/**
 * Add data to content list
 * @param {Array.<Object>} item - current doc-data
 * @param {Object} data - base data
 */
function addContentItem(item, data) {
  const {
    pid,
    kind
  } = data;
  const customItem = contentDataFactory.makeContentData(pid, kind, item);

  contentMap[pid] = customItem;
}

/**
 * Circulate doc-data generated by documentation.js to parse
 * @param {Array.<Object>} items - doc-data list
 */
function circulateItems(items) {
  items.forEach(item => { // eslint-disable-line complexity
    const {kind} = item;

    if (kind === 'module' || kind === 'external' ||
      kind === 'class' || kind === 'namespace' ||
      kind === 'mixin' || kind === 'global' ||
      kind === 'typedef') {
      const data = makeBaseData(item);

      addNavItem(data);
      addSubNavItems(item, data);
      addContentItem(item, data);
    } else { // module item, external item, typedef, event
      etcItems.push(item);
    }
  });
}

/**
 * Add each item data to navigation and content list
 * @param {string} name - item name
 * @param {string} parentPid - item pid
 * @param {Array.<Object>} item - current doc-data
 */
function addEachChildItem(name, parentPid, item) {
  const {
    kind,
    scope
  } = item;

  // add navigation data
  let navItem = navigationDataFactory.makeMemberItem({
    name,
    parentPid,
    kind,
    scope
  });

  if (!navMap[parentPid]) {
    navMap[parentPid] = [];
  }

  navMap[parentPid].push(navItem);

  // add content data
  let contentItem = contentDataFactory.makeMemberItem(item);

  if (!contentMap[parentPid]) {
    contentMap[parentPid] = {
      items: []
    };

    if (parentPid === 'global') {
      contentMap[parentPid].pid = 'global';
      contentMap[parentPid].parentPid = 'global';
      contentMap[parentPid].title = 'Global';
    }
  }

  contentMap[parentPid].items.push(contentItem);
}

/**
 * Post proccessing using etc items
 */
function postProccessing() {
  etcItems.forEach(item => { // eslint-disable-line complexity
    const {
      name,
      kind,
      memberof
    } = item;
    const isModule = !!(memberof && memberof.split('module:').length > 1);
    const isExternal = !!(name && name.split('external:').length > 1);
    const isEvent = kind === 'event';
    const isTypedef = kind === 'typedef';
    const isMember = contentMap[memberof];

    if (isModule) {
      const parentPid = memberof.split('module:').pop().replace('/', '_');
      const itemName = name;

      addEachChildItem(itemName, parentPid, item);
    } else if (isExternal) {
      const splitedName = name.split('external:').pop().split('#');
      const parentPid = splitedName[0];
      const itemName = splitedName[1];

      addEachChildItem(itemName, parentPid, item);
    } else if (isEvent) {
      const splitedName = name.split('#');
      const parentPid = splitedName[0];
      const itemName = splitedName[1];

      addEachChildItem(itemName, parentPid, item);
    } else if (isTypedef) {
      addEachChildItem(name, 'global', item);
    } else if (isMember) {
      addEachChildItem(name, memberof, item);
    }
  });
}

/**
 * Make data of search keywords
 */
function makeNavigationData() {
  navItems.forEach(item => {
    const {pid} = item;

    if (navMap[pid]) {
      item.childNodes = helper.sort(navMap[pid]);
    }
  });

  navItems = helper.sort(navItems);

  if (navMap.global) {
    navItems.push({
      pid: 'global',
      parentPid: 'global',
      name: 'global',
      opened: false,
      type: 'api'
    });
  }
}

/**
 * Make data of search keywords
 * @param {Array.<Object>} items - navigation data list
 */
function makeSearchData(items) {
  items = items || navItems;

  items.forEach(item => {
    const {
      pid,
      name,
      parentPid,
      childNodes
    } = item;

    if (childNodes && childNodes.length) {
      makeSearchData(childNodes);
    }

    searchItems.push({
      pid,
      name,
      parentPid
    });
  });
}

/**
 * Make data using in api page
 */
function makeContentData() {
  for (let pid in contentMap) {
    if ({}.hasOwnProperty.call(contentMap, pid)) {
      contentDataFactory.makeApiPageDataFile(contentMap[pid]);
    }
  }
}

module.exports = {
  createData: function(items) {
    circulateItems(items);
    postProccessing();

    makeNavigationData();
    makeSearchData();
    makeContentData();

    return {
      navigation: navItems,
      searchKeywords: searchItems
    };
  }
};
