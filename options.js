document.addEventListener('DOMContentLoaded', async () => {
  const title = document.getElementById('title');
  const deleteOnStartup = document.getElementById('deleteOnStartup');
  const message = document.getElementById('message');
  const whitelistTextArea = document.getElementById('whitelistTextArea');
  const nonWhitelistTextArea = document.getElementById('nonWhitelistTextArea');
  const saveWhitelist = document.getElementById('saveWhitelist');
  const deleteNonWhitelisted = document.getElementById('deleteNonWhitelisted');

  // initialize title
  title.textContent = chrome.runtime.getManifest().name;

  // initialize deleteOnStartup checkbox
  chrome.storage.local.get('deleteOnStartup', (data) => {
    deleteOnStartup.checked = data.deleteOnStartup || false;
  });

  // initialize whitelist input
  chrome.runtime.sendMessage({ action: "getWhitelist" }, (response) => {
    const whitelist = response || [];
    whitelistTextArea.value = whitelist.join('\n');
  });

  // initialize non-whitelisted domains input
  chrome.runtime.sendMessage({ action: "getNonWhitelistedDomainsWithCount" }, (response) => {
    nonWhitelistTextArea.value = response.map(d => `${d.domain} - ${d.cookieCount} cookies`).join('\n');
  });

  // handle deleteOnStartup checkbox change
  deleteOnStartup.addEventListener('change', async () => {
    await chrome.storage.local.set({ deleteOnStartup: deleteOnStartup.checked });
  });

  // handle Save button click
  saveWhitelist.addEventListener('click', () => {
    const newWhitelist = whitelistTextArea.value
      .split('\n')              // Split by newline
      .map(line => line.trim()) // Trim each line
      .filter(line => line)     // Remove empty lines
      .map(getDomain);          // Normalize to parent domains
    const sortedUniqueWhitelist = [...new Set(newWhitelist)].sort(); // Remove duplicates and sort
    chrome.storage.local.set({ whitelist: sortedUniqueWhitelist }, () => {
      message.textContent = 'Whitelist saved.';
    });
    whitelistTextArea.value = sortedUniqueWhitelist.join('\n');
    chrome.runtime.sendMessage({ action: "getNonWhitelistedDomainsWithCount" }, (response) => {
      nonWhitelistTextArea.value = response.map(d => `${d.domain} - ${d.cookieCount} cookies`).join('\n');
    });
  });

  // handle Delete Non-Whitelisted button click
  deleteNonWhitelisted.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "deleteNonWhitelisted" }, (response) => {
      message.textContent = "Non-whitelisted cookies deleted.";
      chrome.runtime.sendMessage({ action: "getNonWhitelistedDomainsWithCount" }, (response) => {
        nonWhitelistTextArea.value = response.map(d => `${d.domain} - ${d.cookieCount} cookies`).join('\n');
      });
    });
  });

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
});
