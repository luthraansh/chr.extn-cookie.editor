document.addEventListener("DOMContentLoaded", async () => {
  const message = document.getElementById('message');
  const toggleDomainWhitelist = document.getElementById('toggleDomainWhitelist');
  const openOptions = document.getElementById('openOptions');
  const currentTabDomain = document.getElementById("currentTabDomain");
  const whitelistStatus = document.getElementById("whitelistStatus");
  const currentTabCookies = document.getElementById("currentTabCookies");
  const deleteCurrentTabCookies = document.getElementById("deleteCurrentTabCookies");

  openOptions.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.sendMessage({ action: "openOptions" });
    // chrome.runtime.openOptionsPage();
  });

  // initialize current tab info
  const { url, domain, isWhitelisted, isHttp } = await chrome.runtime.sendMessage({ action: "getCurrentTabInfo" });
  currentTabDomain.innerHTML = domain.length <= 35 ? domain : domain.slice(0, 35) + '...';
  if (isHttp) {
    whitelistStatus.innerHTML = isWhitelisted ? "Whitelisted" : "Not Whitelisted";
    whitelistStatus.style.color = isWhitelisted ? "green" : "red";
    toggleDomainWhitelist.innerHTML = isWhitelisted ? "Remove domain from whitelist" : "Add domain to whitelist";
    await loadCookiesDetails();
  } else {
    whitelistStatus.innerHTML = "N/A";
    whitelistStatus.style.color = "";
    toggleDomainWhitelist.style.display = "none";
    deleteCurrentTabCookies.style.display = "none";
  }

  toggleDomainWhitelist.addEventListener('click', async (e) => {
    e.preventDefault();
    await chrome.runtime.sendMessage({ action: "toggleDomainWhitelist" });
    const { url, domain, isWhitelisted, isHttp } = await chrome.runtime.sendMessage({ action: "getCurrentTabInfo" });
    message.innerHTML = isWhitelisted ? `Domain added to whitelist.` : `Domain removed from whitelist.`;
    whitelistStatus.innerHTML = isWhitelisted ? "Whitelisted" : "Not Whitelisted";
    whitelistStatus.style.color = isWhitelisted ? "green" : "red";
    toggleDomainWhitelist.innerHTML = isWhitelisted ? "Remove domain from whitelist" : "Add domain to whitelist";
  });

  deleteCurrentTabCookies.addEventListener("click", async (e) => {
    e.preventDefault();
    await chrome.runtime.sendMessage({ action: "deleteCurrentTabCookies" });
    message.textContent = `All cookies for the current tab deleted.`;
    await loadCookiesDetails();
  });

  async function loadCookiesDetails() {
    currentTabCookies.innerHTML = '';
    const { cookies } = await chrome.runtime.sendMessage({ action: "getCurrentTabCookies" });
    deleteCurrentTabCookies.textContent = `Delete (${cookies.length})`;
    if (cookies.length === 0) {
      currentTabCookies.appendChild(document.createTextNode("No cookies found."));
      return;
    }
    cookies.forEach(c => {
      currentTabCookies.appendChild(buildCookieItem(c, url));
    });
  }

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