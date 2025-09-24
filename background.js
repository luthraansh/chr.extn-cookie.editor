chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Get cookies for the current tab
  if (message.action === "getCookies") {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (!tabs.length) {
        sendResponse({ cookies: [], url: null });
        return;
      }

      const tab = tabs[0];
      const url = tab.url;

      chrome.cookies.getAll({ url }, cookies => {
        console.log("Loaded cookies:", cookies);
        sendResponse({ cookies, url });
      });
    });

    return true; // keep channel open
  }

  // Delete a single cookie
  if (message.action === "deleteCookie") {
    chrome.cookies.remove(
      { url: message.url, name: message.name },
      details => {
        sendResponse({ success: !!details });
      }
    );
    return true;
  }

  // Set or update a cookie
  if (message.action === "setCookie") {
    chrome.cookies.set(message.cookie, cookie => {
      sendResponse({ success: !!cookie });
    });
    return true;
  }

  // Delete all cookies for the current tab
  if (message.action === "deleteAllCookies") {
    chrome.cookies.getAll({ url: message.url }, cookies => {
      let pending = cookies.length;
      if (pending === 0) {
        sendResponse({ success: true });
        return;
      }

      cookies.forEach(cookie => {
        chrome.cookies.remove({ url: message.url, name: cookie.name }, () => {
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
