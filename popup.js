document.addEventListener("DOMContentLoaded", () => {
  const message = document.getElementById('message');
  const deleteOnStartup = document.getElementById('deleteOnStartup');
  const addDomainToWhitelist = document.getElementById('addDomainToWhitelist');
  const removeDomainFromWhitelist = document.getElementById('removeDomainFromWhitelist');
  const options = document.getElementById('options');
  const cookieList = document.getElementById("cookieList");
  const currentUrl = document.getElementById("currentUrl");
  const deleteCurrentTabCookies = document.getElementById("deleteCurrentTabCookies");
  let currentParentDomain = null;

  async function loadWhitelist() {
      chrome.storage.local.get('deleteOnStartup', (data) => {
        deleteOnStartup.checked = data.deleteOnStartup || false;
      });
      const { whitelist } = await chrome.storage.local.get({ whitelist: [] });
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      addDomainToWhitelist.style.display = 'none';
      removeDomainFromWhitelist.style.display = 'none';
      if (tab && tab.url) {
        const url = new URL(tab.url);
        if (url.protocol.startsWith('http')) {
          currentParentDomain = getParentDomain(url.hostname);
          
          if (whitelist.includes(currentParentDomain)) {
            removeDomainFromWhitelist.innerHTML = `Remove <strong>${currentParentDomain}</strong> from Whitelist`;
            removeDomainFromWhitelist.style.display = 'block';
          } else {
            addDomainToWhitelist.innerHTML = `Add <strong>${currentParentDomain}</strong> to Whitelist`;
            addDomainToWhitelist.style.display = 'block';
          }
        }
      }
  }

  loadWhitelist();

  deleteOnStartup.addEventListener('change', () => {
    chrome.storage.local.set({ deleteOnStartup: deleteOnStartup.checked });
  });

  addDomainToWhitelist.addEventListener('click', async (e) => {
    e.preventDefault();
    const { whitelist } = await chrome.storage.local.get({ whitelist: [] });
    if (!whitelist.includes(currentParentDomain)) {
      whitelist.push(currentParentDomain);
      whitelist.sort();
      await chrome.storage.local.set({ whitelist });
      message.innerHTML = `<strong>${currentParentDomain}</strong> added to whitelist.`;
    } else {
      message.textContent = `${currentParentDomain} is already in the whitelist.`;
    }
    loadWhitelist();
  });

  removeDomainFromWhitelist.addEventListener('click', async (e) => {
    e.preventDefault();
    const { whitelist } = await chrome.storage.local.get({ whitelist: [] });
    const newWhitelist = whitelist.filter(domain => domain !== currentParentDomain);
    if (newWhitelist.length !== whitelist.length) {
      await chrome.storage.local.set({ whitelist: newWhitelist });
      message.innerHTML = `<strong>${currentParentDomain}</strong> removed from whitelist.`;
    } else {
      message.textContent = `${currentParentDomain} was not found in the whitelist.`;
    }
    loadWhitelist();
  });

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

  options.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
  });

  chrome.runtime.sendMessage({ action: "getCookies" }, response => {
    const { cookies, url } = response || {};
    currentUrl.textContent = url || "No active tab";
    deleteCurrentTabCookies.textContent = `Delete (${cookies.length})`;
    deleteCurrentTabCookies.addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "deleteCurrentTabCookies", url }, () => {
        message.textContent = `All cookies for the current tab deleted.`;
        deleteCurrentTabCookies.textContent = `Delete (0)`;
        cookieList.innerHTML = '';
      });
    });

    if (!cookies?.length) {
      cookieList.appendChild(document.createTextNode("No cookies found."));
      return;
    }

    cookies.forEach(c => {
      const item = buildCookieItem(c, url);
      cookieList.appendChild(item);
    });
  });

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