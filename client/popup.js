document.addEventListener('DOMContentLoaded', () => {
    const checkbox = document.getElementById('enableFactCheck');
    const status = document.getElementById('status');
    
    // Load saved settings
    chrome.storage.sync.get(['enableFactCheck'], (data) => {
        checkbox.checked = data.enableFactCheck !== false;
    });
    
    // Save settings on change
    checkbox.addEventListener('change', () => {
        chrome.storage.sync.set({ enableFactCheck: checkbox.checked }, () => {
            // Show status message
            status.textContent = 'Settings saved!';
            status.style.color = '#4CAF50';
            setTimeout(() => {
                status.textContent = '';
            }, 2000);
            
            // Notify content script of the change
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        type: 'SETTING_CHANGED',
                        enableFactCheck: checkbox.checked
                    });
                }
            });
        });
    });
});