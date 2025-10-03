// perform cleanup on restart
chrome.runtime.onStartup.addListener(() => {
  console.log('Running extension on browser startup:', chrome.runtime.getManifest().name);
  chrome.storage.local.get('deleteOnStartup', (data) => {
    if (data.deleteOnStartup) {
      deleteNonWhitelisted().then(() => { return true; });
    } else {
      console.log('Skipping cleanup on startup as per user preference.');
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  if (request.action === "deleteNonWhitelisted") {
    // Call the async function and handle the response
    deleteNonWhitelisted().then((result) => {
      // Send a success response back to the popup
      sendResponse(result);
    });
    // Return true to indicate that you will send a response asynchronously.
    return true; // keep channel open 
  }

  if (request.action === "getNonWhitelistedDomains") {
    // Call the async function and handle the response
    getNonWhitelistedDomains().then((result) => {
      // Send a success response back to the popup
      sendResponse(result);
    });
    // Return true to indicate that you will send a response asynchronously.
    return true; // keep channel open 
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

    return true; // keep channel open
  }

  // Delete a single cookie
  if (request.action === "deleteIndividualCookie") {
    chrome.cookies.remove(
      { url: request.url, name: request.name },
      details => {
        sendResponse({ success: !!details });
      }
    );
    return true;
  }

  // Set or update a cookie
  if (request.action === "setCookie") {
    chrome.cookies.set(request.cookie, cookie => {
      sendResponse({ success: !!cookie });
    });
    return true;
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
    return true;
  }
});

async function deleteNonWhitelisted() {
  const allDomains = await getAllDomains();
  const whitelist = (await chrome.storage.local.get({ whitelist: [] })).whitelist;
  const nonWhitelistedDomains = allDomains.filter(domain => {
    return !whitelist.includes(getParentDomain(domain));
  });
  const whitelistDomains = whitelist.map(d => 'https://' + d).concat(whitelist.map(d => 'http://' + d));
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
  const message = `Non-Whitelisted cookies deleted (${nonWhitelistedDomains.length} domains)`;
  console.log(message, nonWhitelistedDomains);
  return { message, nonWhitelistedDomains };
}

async function getNonWhitelistedDomains() {
  const allDomains = await getAllDomains();
  const whitelist = (await chrome.storage.local.get({ whitelist: [] })).whitelist;
  const nonWhitelistedDomains = allDomains.filter(domain => {
    return !whitelist.includes(getParentDomain(domain));
  });
  return { nonWhitelistedDomains };
}

async function getAllDomains() {
  const allDomains = new Set();
  const cookies = await chrome.cookies.getAll({});
  cookies.forEach(cookie => {
    const protocol = cookie.secure ? 'https://' : 'http://';
    allDomains.add(protocol + cookie.domain);
  });
  return Array.from(allDomains);
}

function getParentDomain(url) {
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


