document.addEventListener('DOMContentLoaded', () => {
  const title = document.getElementById('title');
  const message = document.getElementById('message');
  const whitelistInput = document.getElementById('whitelist');
  const nonWhitelistedDomains = document.getElementById('nonWhitelistedDomains');
  const save = document.getElementById('save');
  const deleteNonWhitelisted = document.getElementById('deleteNonWhitelisted');
  const close = document.getElementById('close');

  async function initializeOptions() {
    title.textContent = chrome.runtime.getManifest().name;
    const { whitelist } = await chrome.storage.local.get({ whitelist: [] });
    whitelistInput.value = whitelist.join('\n');
    await chrome.runtime.sendMessage({ action: "getNonWhitelistedDomains" }, (response) => {
      nonWhitelistedDomains.textContent = response.nonWhitelistedDomains.join('\n');
    });
  }

  initializeOptions();

  save.addEventListener('click', () => {
    const whitelist = whitelistInput.value.split('\n').map(s => s.trim()).filter(Boolean);
    // Sort and dedupe before saving
    const sortedUniqueWhitelist = [...new Set(whitelist)].sort();
    chrome.storage.local.set({ whitelist: sortedUniqueWhitelist }, () => {
      message.textContent = 'Whitelist saved.';
    });
  });
  
  close.addEventListener('click', () => {
    window.close();
  });

  deleteNonWhitelisted.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "deleteNonWhitelisted" }, (response) => {
      message.textContent = response.message + '\n\n' + response.nonWhitelistedDomains.join('\n');
    });
  });
});
