// perform cleanup on restart
chrome.runtime.onStartup.addListener(() => {
  browserStartup();
});

chrome.runtime.onMessage.addListener( (request, sender, sendResponse) => {
  if (request.action === "getCurrentTabInfo") {
    getCurrentTabInfo().then((result) => {
      sendResponse(result);
    });
    return true; // to keep channel open and indicate async response 
  }

  if (request.action === "addCurrentTabToWhitelist") {
    addCurrentTabToWhitelist().then((result) => {
      sendResponse(result);
    });
    return true; // to keep channel open and indicate async response 
  }

  if (request.action === "toggleDomainWhitelist") {
    toggleDomainWhitelist(sendResponse);
    return true; // to keep channel open and indicate async response 
  }

  if (request.action === "simulateWithoutDelete") {
    deleteNonWhitelisted(false).then((result) => {
      sendResponse(result);
    });
    return true; // to keep channel open and indicate async response 
  }

  if (request.action === "deleteNonWhitelisted") {
    deleteNonWhitelisted(true).then((result) => {
      sendResponse(result);
    });
    return true; // to keep channel open and indicate async response 
  }

  if (request.action === "getNonWhitelistedDomains") {
    getNonWhitelistedDomainsWithCount().then((result) => {
      sendResponse(result);
    });
    return true; // to keep channel open and indicate async response 
  }

  if (request.action === "getWhitelist") {
    getWhitelist().then((result) => {
      sendResponse(result);
    });
    return true; // to keep channel open and indicate async response 
  }

  // Get cookies for the current tab
  if (request.action === "getCookies") {
    getCurrentTabCookies().then((result) => {
      sendResponse(result);
    });
    return true; // to keep channel open and indicate async response 
  }

  // Set or update a cookie
  if (request.action === "setCookie") {
    chrome.cookies.set(request.cookie, cookie => {
      sendResponse({ success: !!cookie });
    });
    return true; // to keep channel open and indicate async response 
  }

  // Delete all cookies for the current tab
  if (request.action === "deleteCurrentTabCookies") {
    deleteCurrentTabCookies(request.url).then((result) => {
      sendResponse(result);
    });
    return true; // to keep channel open and indicate async response 
  }

  // Delete a single cookie
  if (request.action === "deleteIndividualCookie") {
    chrome.cookies.remove(
      { url: request.url, name: request.name },
      details => {
        sendResponse({ success: !!details });
      }
    );
    return true; // to keep channel open and indicate async response 
  }

});

async function browserStartup() {
  console.log(new Date().toLocaleString(), ':', 'Running extension on browser startup:', chrome.runtime.getManifest().name);
  const deleteOnStartup = await chrome.storage.local.get('deleteOnStartup');
  if (deleteOnStartup) {
    await deleteNonWhitelisted(true);
  } else {
    console.log(new Date().toLocaleString(), ':', `No cookies deleted. Delete on startup checkbox is not checked.`);
  }
}

async function getCurrentTabCookies() {
  const currentTabInfo = await getCurrentTabInfo();
  const allCookies = await chrome.cookies.getAll({});
  const cookies = allCookies.filter(c => c.domain.includes(currentTabInfo.currentTabDomain));
  const url = currentTabInfo.url;
  const domain = currentTabInfo.currentTabDomain;
  return { domain, url, cookies };
}

async function getCurrentTabInfo() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (tab && tab.url) {
    const url = new URL(tab.url);
    const domain = getDomain(url.href);
    const whitelist = await getWhitelist();
    const isWhitelisted = whitelist.includes(domain);
    const allCookies = await chrome.cookies.getAll({});
    const cookies = allCookies.filter(c => c.domain.includes(domain));
    return { domain, url, isWhitelisted, cookies };
  }
}

async function toggleDomainWhitelist(sendResponse) {
  const currentTabInfo = await getCurrentTabInfo();
  const currentTabDomain = currentTabInfo.domain;
  const whitelist = await getWhitelist();
  const isWhitelisted = currentTabInfo.isWhitelisted;
  if (isWhitelisted) {
    const index = whitelist.indexOf(currentTabDomain);
    if (index > -1) {
      whitelist.splice(index, 1); // Remove domain from whitelist
    }
  } else {
    whitelist.push(currentTabDomain);
  }
  const sortedUniqueWhitelist = [...new Set(whitelist)].sort(); // Remove duplicates and sort
  chrome.storage.local.set({ whitelist: sortedUniqueWhitelist }, () => {
    sendResponse({ success: true, domain: currentTabDomain, isWhitelisted: !isWhitelisted }); // returning the new status since it has been toggled
  });
}

async function addCurrentTabToWhitelist() {
  const currentTabDomain = (await getCurrentTabInfo()).domain;
  const whitelist = await getWhitelist();
  whitelist.push(currentTabDomain);
  const sortedUniqueWhitelist = [...new Set(whitelist)].sort(); // Remove duplicates and sort
  await chrome.storage.local.set({ whitelist: sortedUniqueWhitelist }, () => {
    return { success: true };
  });
}

async function getWhitelist() {
  const whitelist = (await chrome.storage.local.get("whitelist")).whitelist || [];
  return whitelist;
}

async function getNonWhitelistedDomainsWithCount() {
  const whitelist = await getWhitelist();
  const cookies = await chrome.cookies.getAll({});
  const nonWhitelistedDomains = [];
  cookies.forEach(cookie => {
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

async function deleteCurrentTabCookies(url) {
  chrome.cookies.getAll({ url }, cookies => {
    cookies.forEach(cookie => {
      chrome.cookies.remove({ url, name: cookie.name, storeId: cookie.storeId });
    });
    return { success: true };
  });
}

async function deleteNonWhitelisted(shouldDelete) {
  const whitelist = await getWhitelist();
  if (whitelist.length === 0) {
    console.log(new Date().toLocaleString(), ':', 'Skipping deletion because whitelist is empty.');
    return;
  }
  const whitelistDomains = whitelist.map(d => 'https://' + d).concat(whitelist.map(d => 'http://' + d));
  const nonWhitelistedDomains = await getNonWhitelistedDomainsWithCount();
  if (shouldDelete) {
    console.log('attempting to delete');
    // chrome.browsingData.remove(
    //   {
    //     excludeOrigins: whitelistDomains,
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
  }
  console.log(new Date().toLocaleString(), ':', `Non-Whitelisted cookies deleted for ${nonWhitelistedDomains.length} domains.`);
  console.table(new Date().toLocaleString(), ':', nonWhitelistedDomains);
  return true;
}

function getDomain(url) {
  if (url.startsWith('chrome://') || url.startsWith('about:')) {
    const match = url.match(/^(chrome|about):\/\/[^\/\?]+/)
    return match[0];
  }
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


