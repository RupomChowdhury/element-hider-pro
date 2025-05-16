// popup.js - Handles the extension popup UI functionality

document.addEventListener('DOMContentLoaded', function() {
  const activateButton = document.getElementById('activateSelector');
  const clearAllButton = document.getElementById('clearAll');
  const hiddenItemsContainer = document.getElementById('hiddenItems');
  
  let currentUrl = '';
  
  // Get the current tab information
  browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
    const currentTab = tabs[0];
    
    // Extract the base URL (origin + pathname) to use as the storage key
    const url = new URL(currentTab.url);
    currentUrl = url.origin + url.pathname;
    
    // Load and display hidden elements for the current page
    loadHiddenElements(currentUrl);
    
    // Set up button event listeners
    activateButton.addEventListener('click', function() {
      // Send message to content script to activate selection mode
      browser.tabs.sendMessage(currentTab.id, { action: "activateSelector" });
      // Close the popup
      window.close();
    });
    
    clearAllButton.addEventListener('click', function() {
      clearAllHiddenElements(currentUrl, currentTab.id);
    });
  });
  
  // Function to load and display hidden elements for the current page
  function loadHiddenElements(url) {
    browser.storage.local.get(url).then(data => {
      const hiddenSelectors = data[url] || [];
      
      if (hiddenSelectors.length === 0) {
        hiddenItemsContainer.innerHTML = '<div class="no-items">No elements hidden on this page</div>';
        return;
      }
      
      hiddenItemsContainer.innerHTML = '';
      
      // Create list items for each hidden element
      hiddenSelectors.forEach((selector, index) => {
        const itemElement = document.createElement('div');
        itemElement.className = 'hidden-item';
        
        // Create element description
        const selectorInfo = document.createElement('div');
        selectorInfo.className = 'selector-info';
        
        // Create a user-friendly description
        const selectorText = selector.length > 40 ? 
                             selector.substring(0, 37) + '...' : 
                             selector;
        selectorInfo.textContent = `Element ${index + 1}: ${selectorText}`;
        
        // Create remove button
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-btn';
        removeButton.textContent = 'X';
        removeButton.dataset.selector = selector;
        removeButton.addEventListener('click', function() {
          removeHiddenElement(url, selector);
        });
        
        // Add elements to container
        itemElement.appendChild(selectorInfo);
        itemElement.appendChild(removeButton);
        hiddenItemsContainer.appendChild(itemElement);
      });
    });
  }
  
  // Function to remove a specific hidden element
  function removeHiddenElement(url, selector) {
    browser.storage.local.get(url).then(data => {
      const hiddenSelectors = data[url] || [];
      
      // Filter out the selector to remove
      const updatedSelectors = hiddenSelectors.filter(item => item !== selector);
      
      // Save the updated list
      const storageUpdate = {};
      storageUpdate[url] = updatedSelectors;
      
      browser.storage.local.set(storageUpdate).then(() => {
        // Refresh the list in the popup
        loadHiddenElements(url);
        
        // Notify content script to refresh the page
        browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
          browser.tabs.sendMessage(tabs[0].id, { 
            action: "refreshPage",
            updatedSelectors: updatedSelectors
          });
        });
      });
    });
  }
  
  // Function to clear all hidden elements for the current page
  function clearAllHiddenElements(url, tabId) {
    // Remove data from storage
    const storageUpdate = {};
    storageUpdate[url] = [];
    
    browser.storage.local.set(storageUpdate).then(() => {
      // Update the UI
      hiddenItemsContainer.innerHTML = '<div class="no-items">No elements hidden on this page</div>';
      
      // Notify content script to refresh the page
      browser.tabs.sendMessage(tabId, { 
        action: "refreshPage",
        updatedSelectors: []
      });
    });
  }
});