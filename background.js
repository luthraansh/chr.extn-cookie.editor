// perform cleanup on restart
chrome.runtime.onStartup.addListener(() => {
  browserStartup();
});

// onActivated and onUpdated - fire-forget type of listener, no message expected, no need to return true
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const { url, domain, isWhitelisted, isHttp } = await getCurrentTabInfo();
  await setExtensionIcon(isWhitelisted);
});
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    const { url, domain, isWhitelisted, isHttp } = await getCurrentTabInfo();
    await setExtensionIcon(isWhitelisted);
  }
});

// onMessage - request-response type of listener, sendResponse is necessary, also need to return true to keep channel open
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async() => {
    if (request.action === "getCurrentTabInfo") {
      const result = await getCurrentTabInfo();
      sendResponse(result);
    } else if (request.action === "openOptions") {
      const result = await openOptions();
      sendResponse(result);
    } else if (request.action === "toggleDomainWhitelist") {
      const result = await toggleDomainWhitelist();
      sendResponse(result);
    } else if (request.action === "deleteNonWhitelisted") {
      const result = await deleteNonWhitelisted();
      sendResponse(result);
    } else if (request.action === "getNonWhitelistedDomainsWithCount") {
      const result = await getNonWhitelistedDomainsWithCount();
      sendResponse(result);
    } else if (request.action === "getWhitelist") {
      const result = await getWhitelist();
      sendResponse(result);
    } else if (request.action === "getCurrentTabCookies") {
      const result = await getCurrentTabCookies();
      sendResponse(result);
    } else if (request.action === "deleteCurrentTabCookies") {
      const result = await deleteCurrentTabCookies();
      sendResponse(result);
    } else if (request.action === "setCookie") {
      chrome.cookies.set(request.cookie, cookie => {
        sendResponse({ success: !!cookie });
      });
    } else if (request.action === "deleteIndividualCookie") {
      chrome.cookies.remove({ url: request.url, name: request.name }, details => {
        sendResponse({ success: !!details });
      });
    }
  })();
  return true; // to keep channel open and indicate async response
});

async function setExtensionIcon(isWhitelisted) {
  const iconPath = isWhitelisted ? "icon.png" : "icon.nonwhitelisted.png";
  chrome.action.setIcon({path: 
    {
      "16": iconPath,
      "48": iconPath,
      "128": iconPath
    }
  });
}

async function browserStartup() {
  console.log(new Date().toLocaleString(), ':', 'Running extension on browser startup:', chrome.runtime.getManifest().name);
  const deleteOnStartup = await chrome.storage.local.get('deleteOnStartup');
  if (deleteOnStartup) {
    await deleteNonWhitelisted();
  }
}

async function getCurrentTabCookies() {
  const { url, domain, isWhitelisted, isHttp } = await getCurrentTabInfo();
  if (!isHttp) return { cookies: [] };
  const allCookies = await chrome.cookies.getAll({});
  const cookies = allCookies.filter(c => c.domain.includes(domain));
  return { cookies };
}

async function getCurrentTabInfo() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab.url;
  const currentTabInfo = { url, domain: url, isWhitelisted: true, isHttp: false };
  if (url?.startsWith("http")) {
    const whitelist = await getWhitelist();
    currentTabInfo.domain = getDomain(url);
    currentTabInfo.isWhitelisted = whitelist.includes(currentTabInfo.domain);
    currentTabInfo.isHttp = true;
  }
  return currentTabInfo;
}

async function openOptions() {
  const optionsPage = chrome.runtime.getManifest().options_page;
  const optionsUrl = chrome.runtime.getURL(optionsPage);

  // Find any non-incognito tab already showing the options page
  const windows = await chrome.windows.getAll({ populate: true });
  for (const window of windows) {
    const foundTab = window.tabs.find(tab => tab.url === optionsUrl);
    if (foundTab) {
      chrome.tabs.update(foundTab.id, { active: true });
      chrome.windows.update(window.id, { focused: true });
      return;
    }
  }
  chrome.tabs.create({ url: optionsUrl, active: true });
}

async function toggleDomainWhitelist() {
  const { url, domain, isWhitelisted, isHttp } = await getCurrentTabInfo();
  const whitelist = await getWhitelist();
  if (isWhitelisted) {
    const index = whitelist.indexOf(domain);
    if (index > -1) {
      whitelist.splice(index, 1); // Remove domain from whitelist
    }
  } else {
    whitelist.push(domain);
  }
  const sortedUniqueWhitelist = [...new Set(whitelist)].sort(); // Remove duplicates and sort
  chrome.storage.local.set({ whitelist: sortedUniqueWhitelist }, () => {
    setExtensionIcon(!isWhitelisted); // flipping the value as it was just toggled
    return { success: true };
  });
}

async function getWhitelist() {
  const whitelist = (await chrome.storage.local.get("whitelist")).whitelist || [];
  return whitelist;
}

async function getNonWhitelistedDomainsWithCount() {
  const whitelist = await getWhitelist();
  const allCookies = await chrome.cookies.getAll({});
  const nonWhitelistedDomains = [];
  allCookies.forEach(cookie => {
    const domain = getDomain(cookie.domain);
    if (!whitelist.includes(domain)) {
      const match = nonWhitelistedDomains.find(d => d.domain === domain);
      if (match) {
        match.cookieCount += 1;
      } else {
        const cookieCount = 1;
        nonWhitelistedDomains.push({ domain, cookieCount });
      }
    }
  });
  return nonWhitelistedDomains.sort((a, b) => a.domain.localeCompare(b.domain));;
}

async function deleteCurrentTabCookies() {
  const { cookies } = await getCurrentTabCookies();
  cookies.forEach(cookie => {
    const url = (cookie.secure ? "https://" : "http://") + cookie.domain + cookie.path;
    chrome.cookies.remove({ url, name: cookie.name, storeId: cookie.storeId }, () => {});
  });
}

async function deleteNonWhitelisted() {
  const whitelist = await getWhitelist();
  if (whitelist.length === 0) {
    console.log(new Date().toLocaleString(), ':', 'Skipping deletion because whitelist is empty.');
    return;
  }
  const whitelistWithHttp = whitelist.map(d => 'https://' + d).concat(whitelist.map(d => 'http://' + d));
  const nonWhitelistedDomains = await getNonWhitelistedDomainsWithCount();
  // chrome.browsingData.remove(
  //   {
  //     excludeOrigins: whitelistWithHttp,
  //   }, {
  //     "appcache": true,
  //     "cacheStorage": true,
  //     "cookies": true,
  //     "fileSystems": true,
  //     "indexedDB": true,
  //     "localStorage": true,
  //     "serviceWorkers": true,
  //     "webSQL": true,
  //   }
  // );
  console.log(new Date().toLocaleString(), ':', `Non-Whitelisted cookies deleted for ${nonWhitelistedDomains.length} domains.`);
  console.log(new Date().toLocaleString(), ':', nonWhitelistedDomains);
}

function getDomain(url) {
  // Remove the protocol (http:// or https://) if it exists
  const domain = url.replace(/^https?:\/\//, '').split('/')[0]; // Strip protocol and path
  // Remove leading dot if it exists
  const cleanDomain = domain.startsWith('.') ? domain.substring(1) : domain;
  // Split the domain into parts (subdomains and the main domain + TLD)
  const domainParts = cleanDomain.split('.');
  // If the domain has more than two parts, assume the last two parts are the parent domain
  if (domainParts.length > 2) {
      return domainParts.slice(domainParts.length - 2).join('.');
  }
  // If it's already a simple domain (e.g., github.com or example.com)
  return cleanDomain;
}


