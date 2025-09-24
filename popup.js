document.addEventListener("DOMContentLoaded", () => {
  chrome.runtime.sendMessage({ action: "getCookies" }, response => {
    const { cookies, url } = response || {};
    document.getElementById("currentUrl").textContent = url || "No active tab";

    const list = document.getElementById("cookieList");
    list.innerHTML = "";

    // Add Delete All button with cookie count in the label
    const deleteAllBtn = document.createElement("button");
    deleteAllBtn.id = "deleteAllBtn";
    deleteAllBtn.textContent = `Delete (${cookies.length})`;
    deleteAllBtn.className = "delete-btn";
    deleteAllBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "deleteAllCookies", url }, () => {
        list.innerHTML = "All cookies deleted.";
      });
    });
    list.appendChild(deleteAllBtn);

    if (!cookies?.length) {
      list.appendChild(document.createTextNode("No cookies found."));
      return;
    }

    cookies.forEach(c => {
      const expires = c.expirationDate
        ? new Date(c.expirationDate * 1000).toLocaleString()
        : "Session";

      const item = document.createElement("div");
      item.className = "cookie-item";

      const header = document.createElement("div");
      header.className = "cookie-header";
      header.textContent = `${c.domain} → ${c.name}`;

      const details = document.createElement("div");
      details.className = "cookie-details hidden";
      details.innerHTML = `
        <div><strong>Value:</strong> ${c.value}</div>
        <div><strong>Path:</strong> ${c.path}</div>
        <div><strong>Expires:</strong> ${expires}</div>
        <button class="delete-btn">Delete</button>
      `;

      header.addEventListener("click", () => {
        details.classList.toggle("hidden");
      });

      details.querySelector(".delete-btn").addEventListener("click", e => {
        e.stopPropagation();
        chrome.runtime.sendMessage(
          { action: "deleteCookie", url, name: c.name },
          () => {
            item.remove();
          }
        );
      });

      item.appendChild(header);
      item.appendChild(details);
      list.appendChild(item);
    });
  });
});
