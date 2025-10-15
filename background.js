// perform cleanup on restart
chrome.runtime.onStartup.addListener(() => {
  browserStartup();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "deleteNonWhitelisted") {
    deleteNonWhitelisted().then((result) => {
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
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (!tabs.length) {
        sendResponse({ cookies: [], url: null });
        return;
      }

      const tab = tabs[0];
      const url = tab.url;

      chrome.cookies.getAll({ url }, cookies => {
        sendResponse({ cookies, url });
      });
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

  // Set or update a cookie
  if (request.action === "setCookie") {
    chrome.cookies.set(request.cookie, cookie => {
      sendResponse({ success: !!cookie });
    });
    return true; // to keep channel open and indicate async response 
  }

  // Delete all cookies for the current tab
  if (request.action === "deleteCurrentTabCookies") {
    chrome.cookies.getAll({ url: request.url }, cookies => {
      let pending = cookies.length;
      if (pending === 0) {
        sendResponse({ success: true });
        return;
      }

      cookies.forEach(cookie => {
        chrome.cookies.remove({ url: request.url, name: cookie.name }, () => {
          pending--;
          if (pending === 0) {
            sendResponse({ success: true });
          }
        });
      });
    });
    return true; // to keep channel open and indicate async response 
  }
});

async function browserStartup() {
  console.log('Running extension on browser startup:', chrome.runtime.getManifest().name);
  const deleteOnStartup = await chrome.storage.local.get('deleteOnStartup');
  if (deleteOnStartup) {
    await deleteNonWhitelisted();
  } else {
    console.log(`No cookies deleted. Delete on startup checkbox is not checked.`);
  }
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

async function deleteNonWhitelisted() {
  const whitelist = await getWhitelist();
  if (whitelist.length === 0) {
    console.log('Skipping deletion because whitelist is empty.');
    return;
  }
  const whitelistDomains = whitelist.map(d => 'https://' + d).concat(whitelist.map(d => 'http://' + d));
  const nonWhitelistedDomains = await getNonWhitelistedDomainsWithCount();
  chrome.browsingData.remove(
    {
      excludeOrigins: whitelistDomains,
    }, {
      "appcache": true,
      "cacheStorage": true,
      "cookies": true,
      "fileSystems": true,
      "indexedDB": true,
      "localStorage": true,
      "serviceWorkers": true,
      "webSQL": true,
    }
  );
  console.log(`Non-Whitelisted cookies deleted for ${nonWhitelistedDomains.length} domains.`);
  console.table(nonWhitelistedDomains);
  return true;
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


