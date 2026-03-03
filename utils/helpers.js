function getUniqueSelector(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return '';

    let path = [];
    let current = el;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
        let name = current.tagName.toLowerCase();

        // 1. Try ID
        if (current.id && !current.id.includes(':')) {
            const idSelector = `#${current.id}`;
            if (document.querySelectorAll(idSelector).length === 1) {
                path.unshift(idSelector);
                break;
            }
        }

        // 2. Try data-testid
        const testId = current.getAttribute('data-testid') || current.getAttribute('data-test-id');
        if (testId) {
            const testIdSelector = `${name}[data-testid="${testId}"]`;
            if (document.querySelectorAll(testIdSelector).length === 1) {
                path.unshift(testIdSelector);
                break;
            } else {
                // Not unique, so we include it as part of a larger path
                name = testIdSelector;
            }
        }

        // 3. Classes (Cleaned)
        if (current.className && typeof current.className === 'string') {
            const classes = current.className.trim().split(/\s+/).filter(c => {
                // Skip randomized Jira classes
                return !c.startsWith('_') && c.length < 20 && !/\d{3,}/.test(c);
            });
            if (classes.length > 0) {
                name += '.' + classes.join('.');
            }
        }

        // 4. Positional uniqueness (CRITICAL for lists)
        const parent = current.parentNode;
        if (parent && parent.nodeType === Node.ELEMENT_NODE) {
            const siblings = Array.from(parent.children);
            // We use nth-child relative to ALL siblings to match CSS logic
            const index = siblings.indexOf(current) + 1;
            if (siblings.length > 1) {
                name += `:nth-child(${index})`;
            }
        }

        path.unshift(name);
        if (name.startsWith('body') || name.startsWith('html')) break;
        current = current.parentNode;
    }

    return path.join(' > ');
}
