/* content.js - Content script that runs in the context of web pages.
This script allows users to select elements on a webpage. 
*/

// Store state of the selector mode
let selectorMode = false;
let highlightedElement = null;
let styleElement = null;
let overlay = null;

// Helper function to generate a unique CSS selector for an element
function generateUniqueSelector(element) {
  // Try with ID first
  if (element.id) {
    return `#${element.id}`;
  }
  
  // Try with class names
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\s+/);
    if (classes.length > 0 && classes[0] !== '') {
      // Get all elements with this class
      const elements = document.querySelectorAll(`.${classes[0]}`);
      // If it's unique, use it
      if (elements.length === 1) {
        return `.${classes[0]}`;
      }
    }
  }
  
  // If not, build a selector with tag name and position
  let selector = element.tagName.toLowerCase();
  
  if (element.parentNode) {
    // If there are siblings with the same tag, add :nth-child
    const siblings = Array.from(element.parentNode.children);
    const sameTagSiblings = siblings.filter(e => e.tagName === element.tagName);
    
    if (sameTagSiblings.length > 1) {
      const index = sameTagSiblings.indexOf(element);
      selector += `:nth-of-type(${index + 1})`;
    }
    
    // Add parent path for better specificity, but limit to 3 levels
    let parent = element.parentNode;
    let parentPath = '';
    let levels = 0;
    
    while (parent && parent !== document.body && parent.tagName && levels < 3) {
      let parentSelector = parent.tagName.toLowerCase();
      
      if (parent.id) {
        parentSelector = `#${parent.id}`;
        parentPath = `${parentSelector} > ${parentPath}`;
        break; // If we have an ID, we can stop
      } else if (parent.className && typeof parent.className === 'string') {
        const classes = parent.className.trim().split(/\s+/);
        if (classes.length > 0 && classes[0] !== '') {
          parentSelector += `.${classes[0]}`;
        }
      }
      
      parentPath = `${parentSelector} > ${parentPath}`;
      parent = parent.parentNode;
      levels++;
    }
    
    if (parentPath) {
      selector = parentPath + selector;
    }
  }
  
  return selector;
}

// Function to create a style element for hiding elements
function createStyleElement() {
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = 'element-hider-styles';
    document.head.appendChild(styleElement);
  }
  return styleElement;
}

// Function to apply hidden element styles
function applyHiddenElementStyles(selectors) {
  const style = createStyleElement();
  if (selectors.length > 0) {
    style.textContent = selectors.map(selector => 
      `${selector} { display: none !important; }`
    ).join('\n');
  } else {
    style.textContent = '';
  }
}

// Function to create overlay for element selection
function createOverlay() {
  overlay = document.createElement('div');
  overlay.id = 'element-hider-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: transparent;
    z-index: 2147483647;
    cursor: crosshair;
  `;
  document.body.appendChild(overlay);
  
  // Add info tooltip
  const tooltip = document.createElement('div');
  tooltip.id = 'element-hider-tooltip';
  tooltip.style.cssText = `
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    z-index: 2147483647;
  `;
  tooltip.textContent = 'Hover over elements and click to hide them. Press ESC to exit selection mode.';
  document.body.appendChild(tooltip);
  
  return overlay;
}

// Function to remove overlay
function removeOverlay() {
  if (overlay) {
    document.body.removeChild(overlay);
    overlay = null;
  }
  
  const tooltip = document.getElementById('element-hider-tooltip');
  if (tooltip) {
    document.body.removeChild(tooltip);
  }
}

// Function to highlight an element
function highlightElement(element) {
  // Clear previous highlight
  if (highlightedElement) {
    highlightedElement.style.outline = '';
  }
  
  // Highlight current element
  highlightedElement = element;
  if (highlightedElement) {
    // Save original outline
    const originalOutline = highlightedElement.style.outline;
    highlightedElement.dataset.originalOutline = originalOutline;
    highlightedElement.style.outline = '2px solid red';
  }
}

// Function to unhighlight the current element
function unhighlightElement() {
  if (highlightedElement) {
    highlightedElement.style.outline = highlightedElement.dataset.originalOutline || '';
    delete highlightedElement.dataset.originalOutline;
    highlightedElement = null;
  }
}

// Function to save a hidden element to storage
function saveHiddenElement(selector) {
  const url = new URL(window.location.href);
  const storageKey = url.origin + url.pathname;
  
  browser.storage.local.get(storageKey).then(data => {
    const hiddenSelectors = data[storageKey] || [];
    
    // Check if selector is already in the list
    if (!hiddenSelectors.includes(selector)) {
      hiddenSelectors.push(selector);
      
      // Save to storage
      const storageUpdate = {};
      storageUpdate[storageKey] = hiddenSelectors;
      browser.storage.local.set(storageUpdate);
      
      // Apply the updated styles
      applyHiddenElementStyles(hiddenSelectors);
    }
  });
}

// Function to activate selector mode
function activateSelectorMode() {
  if (selectorMode) return;
  
  selectorMode = true;
  
  // Create overlay
  const overlay = createOverlay();
  
  // Add event listener for hovering over elements
  overlay.addEventListener('mousemove', function(event) {
    // Get element under cursor, ignoring the overlay itself
    overlay.style.pointerEvents = 'none';
    const elementUnderCursor = document.elementFromPoint(event.clientX, event.clientY);
    overlay.style.pointerEvents = 'auto';
    
    if (elementUnderCursor && elementUnderCursor !== document.body && elementUnderCursor !== document.documentElement) {
      highlightElement(elementUnderCursor);
    } else {
      unhighlightElement();
    }
  });
  
  // Add event listener for clicking elements
  overlay.addEventListener('click', function(event) {
    event.preventDefault();
    event.stopPropagation();
    
    if (highlightedElement) {
      // Generate a unique selector for the element
      const selector = generateUniqueSelector(highlightedElement);
      
      // Save the hidden element
      saveHiddenElement(selector);
      
      // Hide the element
      highlightedElement.style.display = 'none';
      
      // Reset highlight
      unhighlightElement();
    }
  });
  
  // Add event listener for ESC key to exit selector mode
  document.addEventListener('keydown', exitOnEscape);
}

// Function to exit selector mode on ESC key press
function exitOnEscape(event) {
  if (event.key === 'Escape' && selectorMode) {
    deactivateSelectorMode();
  }
}

// Function to deactivate selector mode
function deactivateSelectorMode() {
  selectorMode = false;
  
  // Remove overlay
  removeOverlay();
  
  // Unhighlight element
  unhighlightElement();
  
  // Remove ESC key event listener
  document.removeEventListener('keydown', exitOnEscape);
}

// Listen for messages from the popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "activateSelector") {
    activateSelectorMode();
  } else if (message.action === "refreshPage") {
    // Apply the updated selectors
    applyHiddenElementStyles(message.updatedSelectors);
  }
});

// Initialize on page load
function initialize() {
  // Get the current URL
  const url = new URL(window.location.href);
  const storageKey = url.origin + url.pathname;
  
  // Check if there are any hidden elements for this page
  browser.storage.local.get(storageKey).then(data => {
    const hiddenSelectors = data[storageKey] || [];
    
    // Apply hidden element styles
    if (hiddenSelectors.length > 0) {
      applyHiddenElementStyles(hiddenSelectors);
    }
  });
}

// Run initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}