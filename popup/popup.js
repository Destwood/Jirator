document.addEventListener("DOMContentLoaded", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    const toggleJira = document.getElementById("toggle-jira");
    const jiraStatus = document.getElementById("jira-status");
    const colorInput = document.getElementById("jira-bg-color");
    const removeSavedBtn = document.getElementById("remove-saved-items");
    const reloadColorsBtn = document.getElementById("reload-colors");
    const jiraItemsList = document.getElementById("jira-items-list");

    // Helper to send messages safely and avoid "Could not establish connection" uncaught errors
    function safeSendMessage(msg, callback) {
        if (!tab?.id) return;
        console.log(`[Jirator Popup] Sending message: ${msg.type}`, msg);
        chrome.tabs.sendMessage(tab.id, msg, (response) => {
            if (chrome.runtime.lastError) {
                console.warn(`[Jirator Popup] Failed to send ${msg.type}. Content script may not be loaded.`);
                return;
            }
            if (callback) callback(response);
        });
    }

    function renderList(items) {
        console.log(`[Jirator Popup] Rendering list with ${items.length} items.`);
        jiraItemsList.innerHTML = '';
        items.forEach((item, idx) => {
            const div = document.createElement('div');
            div.className = 'jira-item';

            const nameInput = document.createElement('input');
            nameInput.value = item.name || `elem${idx + 1}`;
            nameInput.className = 'jira-name';
            nameInput.addEventListener('change', () => {
                console.log(`[Jirator Popup] Renaming item ${idx} to: ${nameInput.value}`);
                safeSendMessage({ type: 'UPDATE_ITEM_NAME', index: idx, name: nameInput.value });
            });

            const useGeneralBtn = document.createElement('button');
            useGeneralBtn.textContent = 'Use general';
            useGeneralBtn.className = 'jira-btn use-general';
            useGeneralBtn.addEventListener('click', () => {
                console.log(`[Jirator Popup] Resetting item ${idx} color to general.`);
                safeSendMessage({ type: 'USE_GENERAL_COLOR', index: idx });
            });

            const customColorInput = document.createElement('input');
            customColorInput.type = 'color';
            customColorInput.value = item.customColor || colorInput.value;
            customColorInput.className = 'jira-colorpicker';
            customColorInput.addEventListener('change', () => {
                console.log(`[Jirator Popup] Setting item ${idx} color to: ${customColorInput.value}`);
                safeSendMessage({ type: 'UPDATE_ITEM_COLOR', index: idx, color: customColorInput.value });
            });

            const delBtn = document.createElement('button');
            delBtn.textContent = 'x';
            delBtn.className = 'jira-btn delete-btn';
            delBtn.addEventListener('click', () => {
                console.log(`[Jirator Popup] Removing item at index: ${idx}`);
                safeSendMessage({ type: 'REMOVE_ITEM', index: idx });
            });

            // hover logic for page element
            div.addEventListener('mouseenter', () => {
                safeSendMessage({ type: 'HOVER_ITEM', index: idx });
            });
            div.addEventListener('mouseleave', () => {
                safeSendMessage({ type: 'UNHOVER_ITEM', index: idx });
            });

            div.appendChild(nameInput);
            div.appendChild(useGeneralBtn);
            div.appendChild(customColorInput);
            div.appendChild(delBtn);
            jiraItemsList.appendChild(div);
        });
    }

    toggleJira.addEventListener("click", () => {
        const active = toggleJira.textContent.includes("Enable");
        console.log(`[Jirator Popup] Toggle Jira Mode clicked. Setting to: ${active}`);
        toggleJira.textContent = active ? "Disable Jira Mode" : "Enable Jira Mode";
        jiraStatus.textContent = active ? "Mode ON" : "Mode OFF";

        safeSendMessage({ type: "TOGGLE_JIRA_MODE", active });
    });

    colorInput.addEventListener("change", () => {
        console.log(`[Jirator Popup] General color changed to: ${colorInput.value}`);
        safeSendMessage({ type: "UPDATE_JIRA_COLOR", color: colorInput.value });
    });

    removeSavedBtn.addEventListener("click", () => {
        console.log('[Jirator Popup] Remove All Items clicked.');
        safeSendMessage({ type: "REMOVE_ALL_ITEMS" });
    });

    reloadColorsBtn.addEventListener("click", () => {
        console.log('[Jirator Popup] Reload Colors clicked.');
        safeSendMessage({ type: "SYNC_DATA" });
    });

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === "UPDATE_LIST") {
            console.log('[Jirator Popup] Received updated list from content script.');
            if (msg.color) colorInput.value = msg.color;
            renderList(msg.items);
        }
    });


    console.log('[Jirator Popup] Loaded.');
    safeSendMessage({ type: "REQUEST_LIST" });
});

