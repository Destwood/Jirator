const host = window.location.hostname;
const JIRA_ITEMS_KEY = `jirafy_jira_${host}`;
const JIRA_COLOR_KEY = `jirafy_jira_color_${host}`;

function getJiraData(callback) {
    chrome.storage.local.get([JIRA_ITEMS_KEY, JIRA_COLOR_KEY], (res) => {
        callback({
            items: res[JIRA_ITEMS_KEY] || [],
            color: res[JIRA_COLOR_KEY] || '#e71c1cff'
        });

    });
}
