document.addEventListener("DOMContentLoaded", () => {
  const message = document.getElementById('message');
  const toggleDomainWhitelist = document.getElementById('toggleDomainWhitelist');
  const options = document.getElementById('options');
  const currentTabDomain = document.getElementById("currentTabDomain");
  const currentTabCookies = document.getElementById("currentTabCookies");
  const deleteCurrentTabCookies = document.getElementById("deleteCurrentTabCookies");

  options.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // initialize current tab info
  chrome.runtime.sendMessage({ action: "getCurrentTabInfo" }, (response) => {
    const { domain, url, isWhitelisted, cookies } = response || {};
    currentTabDomain.innerHTML = `<b>Current domain: </b>${domain} (${isWhitelisted ? 'Whitelisted' : 'Not Whitelisted'})`;
    toggleDomainWhitelist.innerHTML = isWhitelisted ? 'Remove domain from whitelist' : 'Add domain to whitelist';
    deleteCurrentTabCookies.textContent = `Delete (${cookies.length})`;
    if (cookies.length === 0) {
      currentTabCookies.appendChild(document.createTextNode("No cookies found."));
      return;
    }
    cookies.forEach(c => {
      currentTabCookies.appendChild(buildCookieItem(c, url));
    });
  });

  toggleDomainWhitelist.addEventListener('click', async (e) => {
    e.preventDefault();
    chrome.runtime.sendMessage({ action: "toggleDomainWhitelist" }, (response) => {
      isWhitelisted = response.isWhitelisted;
      message.textContent = `Domain ${isWhitelisted ? 'added to' : 'removed from'} whitelist.`;
      currentTabDomain.innerHTML = `<b>Current domain: </b>${response.domain} (${isWhitelisted ? 'Whitelisted' : 'Not Whitelisted'})`;
      toggleDomainWhitelist.innerHTML = isWhitelisted ? 'Remove domain from whitelist' : 'Add domain to whitelist';
    });
  });

  deleteCurrentTabCookies.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "deleteCurrentTabCookies", url }, () => {
      message.textContent = `All cookies for the current tab deleted.`;
      deleteCurrentTabCookies.textContent = `Delete (0)`;
      currentTabCookies.innerHTML = '';
    });
  });

  // build HTML for the cookie
  function buildCookieItem(c, url) {
    const expires = c.expirationDate
      ? new Date(c.expirationDate * 1000).toLocaleString()
      : "Session";

    const details = document.createElement("div");
    details.className = "cookie-details hidden";
    details.innerHTML = `
          <div><strong>Value:</strong> ${c.value}</div>
          <div><strong>Path:</strong> ${c.path}</div>
          <div><strong>Expires:</strong> ${expires}</div>
          <button class="delete-btn">Delete</button>
        `;
    details.querySelector(".delete-btn").addEventListener("click", e => {
      e.stopPropagation();
      chrome.runtime.sendMessage(
        { action: "deleteIndividualCookie", url, name: c.name },
        () => {
          item.remove();
        }
      );
    });

    const header = document.createElement("div");
    header.className = "cookie-header";
    header.textContent = `${c.domain} → ${c.name}`;
    header.addEventListener("click", () => {
      details.classList.toggle("hidden");
    });

    const item = document.createElement("div");
    item.className = "cookie-item";
    item.appendChild(header);
    item.appendChild(details);
    return item;
  }
});