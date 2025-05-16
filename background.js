/* This background script is minimal since most functionality
is handled by the popup and content scripts. We include it
because it's required in the manifest. */

browser.runtime.onInstalled.addListener(details => {
  console.log('Keep Hiding..xD!');
});

browser.runtime.setUninstallURL('https://rupom.dev/element-hider-pro/uninstall-feedback/');