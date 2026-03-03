let jiraMode = false;
let clickHandler = null;
let mouseOverHandler = null;
let mouseOutHandler = null;
let lastHovered = null;
let generalColor = '#e71c1cff';
let jiraItems = [];

function logToPage(message) {
    let logWrapper = document.getElementById('jirator-log-wrapper');
    if (!logWrapper) {
        logWrapper = document.createElement('div');
        logWrapper.id = 'jirator-log-wrapper';
        logWrapper.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            z-index: 100000;
            pointer-events: none;
        `;

        const logContainer = document.createElement('div');
        logContainer.id = 'jirator-page-logs';
        logContainer.style.cssText = `
            width: 300px;
            max-height: 40vh;
            overflow-y: auto;
            background-color: rgba(0,0,0,0.85);
            color: #00ff00;
            font-size: 11px;
            padding: 8px;
            font-family: 'Consolas', monospace;
            border-radius: 4px;
            margin-bottom: 5px;
            display: none;
            pointer-events: auto;
            border: 1px solid #333;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        `;

        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'jirator-log-toggle';
        toggleBtn.textContent = 'Logs';
        toggleBtn.style.cssText = `
            padding: 4px 8px;
            background: #222;
            color: #888;
            border: 1px solid #444;
            border-radius: 4px;
            font-size: 10px;
            cursor: pointer;
            pointer-events: auto;
            opacity: 0.6;
            transition: all 0.2s;
        `;
        toggleBtn.onmouseenter = () => toggleBtn.style.opacity = '1';
        toggleBtn.onmouseleave = () => toggleBtn.style.opacity = '0.6';
        toggleBtn.onclick = () => {
            const isHidden = logContainer.style.display === 'none';
            logContainer.style.display = isHidden ? 'block' : 'none';
            toggleBtn.style.background = isHidden ? '#333' : '#222';
            toggleBtn.style.color = isHidden ? '#fff' : '#888';
        };

        logWrapper.appendChild(logContainer);
        logWrapper.appendChild(toggleBtn);
        document.body.appendChild(logWrapper);
    }

    const logContainer = document.getElementById('jirator-page-logs');
    const msg = document.createElement('div');
    msg.style.marginBottom = '2px';
    msg.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
    msg.style.paddingBottom = '2px';
    msg.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logContainer.appendChild(msg);
    logContainer.scrollTop = logContainer.scrollHeight;
}


function init() {
    logToPage('[Jirator] Initializing content script...');
    getJiraData((data) => {
        jiraItems = data.items;
        generalColor = data.color;
        logToPage(`[Jirator] Loaded ${jiraItems.length} items from storage.`);
        initHoverStyle();
        applyJiraItems();
        initJiraObserver();
    });
}

function initHoverStyle() {
    let style = document.getElementById('jirator-hover-style');
    if (!style) {
        style = document.createElement('style');
        style.id = 'jirator-hover-style';
        document.head.appendChild(style);
    }
    style.textContent = `
        .added-item-mover {
            outline: 3px solid ${generalColor} !important;
            outline-offset: -3px;
            box-shadow: 0 0 15px ${generalColor}80 !important;
            background-color: ${generalColor}20 !important;
            transition: all 0.2s ease-in-out;
        }
        .jirator-cursor-hover {
            background-color: ${generalColor}33 !important;
            cursor: copy !important;
            outline: 1px solid white;
        }
    `;
}

function applyJiraItems() {
    getJiraData((data) => {
        jiraItems = data.items;
        generalColor = data.color;
        initHoverStyle(); // Update colors in hover styles

        let styleTag = document.getElementById('jirator-persistent-styles');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'jirator-persistent-styles';
            (document.head || document.documentElement).appendChild(styleTag);
        }

        const cssRules = jiraItems.map((item, index) => {
            const color = item.customColor || generalColor;
            return `${item.selector} { background: ${color} !important; }`;
        }).join('\n');

        styleTag.textContent = cssRules;
        logToPage(`[Jirator] Styles sync complete (${jiraItems.length} items).`);
        sendList();
    });
}

function initJiraObserver() {
    const itemSelector = '[data-testid="issue-line-card.card-container"]';
    
    function attachHover(el) {
        if (el.dataset.jiratorObserved) return;
        el.dataset.jiratorObserved = 'true';
        
        el.addEventListener('mouseenter', () => {
            if (!jiraMode) el.classList.add('added-item-mover');
        });
        el.addEventListener('mouseleave', () => {
            el.classList.remove('added-item-mover');
        });
        logToPage(`[Jirator] Attached hover to Jira card.`);
    }

    // Init existing
    document.querySelectorAll(itemSelector).forEach(attachHover);

    // Watch for new ones
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.matches(itemSelector)) attachHover(node);
                    node.querySelectorAll(itemSelector).forEach(attachHover);
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

function sendList() {
    chrome.runtime.sendMessage({ 
        type: "UPDATE_LIST", 
        items: jiraItems, 
        color: generalColor 
    });
}


function updateHandler() {
    if (clickHandler) {
        document.removeEventListener("click", clickHandler, true);
        document.removeEventListener("mouseover", mouseOverHandler, true);
        document.removeEventListener("mouseout", mouseOutHandler, true);
        clickHandler = null;
        mouseOverHandler = null;
        mouseOutHandler = null;
        if (lastHovered) lastHovered.classList.remove('jirator-cursor-hover');
        lastHovered = null;
        document.body.style.cursor = "default";
    }
    if (jiraMode) {
        logToPage('[Jirator] Jira Mode: ON (Picking enabled)');
        clickHandler = (e) => {
            if (e.target.closest('#jirafy-ui')) return;
            e.preventDefault();
            e.stopPropagation();

            const selector = getUniqueSelector(e.target);
            logToPage(`[Jirator] Element clicked, selector: ${selector}`);

            if (!jiraItems.find(i => i.selector === selector)) {
                jiraItems.push({ selector, name: `elem${jiraItems.length + 1}` });
                chrome.storage.local.set({ [JIRA_ITEMS_KEY]: jiraItems }, () => {
                    logToPage('[Jirator] Item added and saved.');
                    applyJiraItems();
                });
            } else {
                logToPage('[Jirator] Item already exists. Skipping.');
            }
        };

        mouseOverHandler = (e) => {
            if (e.target.closest('#jirafy-ui')) return;
            if (lastHovered) lastHovered.classList.remove('jirator-cursor-hover');
            lastHovered = e.target;
            lastHovered.classList.add('jirator-cursor-hover');
        };

        mouseOutHandler = (e) => {
            if (lastHovered) {
                lastHovered.classList.remove('jirator-cursor-hover');
                lastHovered = null;
            }
        };

        document.addEventListener("click", clickHandler, true);
        document.addEventListener("mouseover", mouseOverHandler, true);
        document.addEventListener("mouseout", mouseOutHandler, true);
        document.body.style.cursor = "copy";
    } else {
        logToPage('[Jirator] Jira Mode: OFF (Styles remain active)');
    }
}

// MESSAGE LISTENER
chrome.runtime.onMessage.addListener((msg) => {
    logToPage(`[Jirator] Message Received: ${msg.type}`);

    switch (msg.type) {
        case "TOGGLE_JIRA_MODE":
            jiraMode = msg.active;
            logToPage(`[Jirator] Toggling Jira Mode: ${jiraMode ? 'ON' : 'OFF'}`);
            updateHandler();
            applyJiraItems();
            break;

        case "SYNC_DATA":
        case "REQUEST_LIST":
            logToPage(`[Jirator] Sync requested: ${msg.type}`);
            applyJiraItems();
            break;

        case "UPDATE_JIRA_COLOR":
            generalColor = msg.color;
            logToPage(`[Jirator] Updating general color in storage: ${generalColor}`);
            chrome.storage.local.set({ [JIRA_COLOR_KEY]: generalColor }, () => {
                applyJiraItems();
            });
            break;

        case "UPDATE_ITEM_NAME":
            if (jiraItems[msg.index]) {
                logToPage(`[Jirator] Renaming item ${msg.index} to ${msg.name}`);
                jiraItems[msg.index].name = msg.name;
                chrome.storage.local.set({ [JIRA_ITEMS_KEY]: jiraItems }, () => {
                    applyJiraItems();
                });
            }
            break;

        case "UPDATE_ITEM_COLOR":
            if (jiraItems[msg.index]) {
                logToPage(`[Jirator] Custom color for item ${msg.index}: ${msg.color}`);
                jiraItems[msg.index].customColor = msg.color;
                chrome.storage.local.set({ [JIRA_ITEMS_KEY]: jiraItems }, () => {
                    applyJiraItems();
                });
            }
            break;

        case "USE_GENERAL_COLOR":
            if (jiraItems[msg.index]) {
                logToPage(`[Jirator] Resetting item ${msg.index} to general color.`);
                delete jiraItems[msg.index].customColor;
                chrome.storage.local.set({ [JIRA_ITEMS_KEY]: jiraItems }, () => {
                    applyJiraItems();
                });
            }
            break;

        case "REMOVE_ITEM":
            logToPage(`[Jirator] Starting REMOVE_ITEM at index: ${msg.index}`);
            if (msg.index < 0 || msg.index >= jiraItems.length) {
                logToPage(`[Jirator] Error: Index ${msg.index} out of bounds (0-${jiraItems.length-1})`);
                break;
            }
            jiraItems.splice(msg.index, 1);
            chrome.storage.local.set({ [JIRA_ITEMS_KEY]: jiraItems }, () => {
                if (chrome.runtime.lastError) {
                    logToPage(`[Jirator] Storage ERROR: ${chrome.runtime.lastError.message}`);
                } else {
                    logToPage(`[Jirator] Item removed. Remaining: ${jiraItems.length}`);
                    applyJiraItems(); // This will re-fetch and refresh everything
                }
            });
            break;

        case "REMOVE_ALL_ITEMS":
            logToPage('[Jirator] Starting REMOVE_ALL_ITEMS');
            jiraItems = [];
            chrome.storage.local.remove(JIRA_ITEMS_KEY, () => {
                if (chrome.runtime.lastError) {
                    logToPage(`[Jirator] Storage ERROR: ${chrome.runtime.lastError.message}`);
                } else {
                    logToPage('[Jirator] All items wiped.');
                    applyJiraItems();
                }
            });
            break;


        case "HOVER_ITEM":
            const hItem = jiraItems[msg.index];
            if (hItem) {
                const el = document.querySelector(hItem.selector);
                if (el) {
                    const color = hItem.customColor || generalColor;
                    el.style.outline = `3px solid ${color}`;
                    el.style.outlineOffset = '-3px';
                    el.classList.add('added-item-mover');
                }
            }
            break;

        case "UNHOVER_ITEM":
            const uItem = jiraItems[msg.index];
            if (uItem) {
                const el = document.querySelector(uItem.selector);
                if (el) {
                    el.style.outline = '';
                    el.style.outlineOffset = '';
                    el.classList.remove('added-item-mover');
                }
            }
            break;
    }
});


init();
