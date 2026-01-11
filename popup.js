// Load saved settings and setup event listeners
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🟢 Popup script loaded - DOMContentLoaded fired');
  
  // Load saved settings
  const result = await chrome.storage.local.get(['geminiApiKey', 'captureMode', 'activationMode']);
  console.log('📦 Loaded settings:', result);
  
  // Update API status badge
  const apiStatus = document.getElementById('apiStatus');
  console.log('🔍 API Status element:', apiStatus);
  if (result.geminiApiKey) {
    apiStatus.textContent = 'Configured';
    apiStatus.className = 'status-badge configured';
    document.getElementById('apiKeyInput').placeholder = '••••••••••••••••';
  } else {
    apiStatus.textContent = 'Not Set';
    apiStatus.className = 'status-badge missing';
  }
  
  // Load saved capture mode
  const captureMode = result.captureMode || 'fullscreen';
  if (captureMode === 'fullscreen') {
    document.getElementById('fullscreenRadio').checked = true;
    document.getElementById('fullscreenOption').classList.add('selected');
    document.getElementById('snippetOption').classList.remove('selected');
  } else {
    document.getElementById('snippetRadio').checked = true;
    document.getElementById('snippetOption').classList.add('selected');
    document.getElementById('fullscreenOption').classList.remove('selected');
  }

  // Load saved activation mode
  const activationMode = result.activationMode || 'tripleclick';
  document.querySelectorAll('input[name="activationMode"]').forEach(radio => {
    if (radio.value === activationMode) {
      radio.checked = true;
      radio.parentElement.classList.add('selected');
    } else {
      radio.parentElement.classList.remove('selected');
    }
  });

  // Radio button handlers for capture mode
  document.getElementById('snippetOption').addEventListener('click', () => {
    document.getElementById('snippetRadio').checked = true;
    document.getElementById('snippetOption').classList.add('selected');
    document.getElementById('fullscreenOption').classList.remove('selected');
  });

  document.getElementById('fullscreenOption').addEventListener('click', () => {
    document.getElementById('fullscreenRadio').checked = true;
    document.getElementById('fullscreenOption').classList.add('selected');
    document.getElementById('snippetOption').classList.remove('selected');
  });

  // Radio button handlers for activation mode
  document.getElementById('tripleClickOption').addEventListener('click', () => {
    document.getElementById('tripleClickRadio').checked = true;
    document.querySelectorAll('.activation-group .radio-option').forEach(opt => opt.classList.remove('selected'));
    document.getElementById('tripleClickOption').classList.add('selected');
  });

  document.getElementById('ctrlShiftAOption').addEventListener('click', () => {
    document.getElementById('ctrlShiftARadio').checked = true;
    document.querySelectorAll('.activation-group .radio-option').forEach(opt => opt.classList.remove('selected'));
    document.getElementById('ctrlShiftAOption').classList.add('selected');
  });

  document.getElementById('manualOption').addEventListener('click', () => {
    document.getElementById('manualRadio').checked = true;
    document.querySelectorAll('.activation-group .radio-option').forEach(opt => opt.classList.remove('selected'));
    document.getElementById('manualOption').classList.add('selected');
  });

  // Save Settings Button
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  console.log('🔍 Save Settings button:', saveSettingsBtn);
  
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', async () => {
      console.log('🎯 SAVE SETTINGS BUTTON CLICKED!');
      try {
        // Save API key if entered
        const apiKey = document.getElementById('apiKeyInput').value.trim();
        if (apiKey) {
          await chrome.storage.local.set({ geminiApiKey: apiKey });
          apiStatus.textContent = 'Configured';
          apiStatus.className = 'status-badge configured';
          document.getElementById('apiKeyInput').value = '';
          document.getElementById('apiKeyInput').placeholder = '••••••••••••••••';
        }
        
        const captureMode = document.querySelector('input[name="captureMode"]:checked').value;
        const activationMode = document.querySelector('input[name="activationMode"]:checked').value;
        console.log('📝 Saving capture mode:', captureMode);
        console.log('📝 Saving activation mode:', activationMode);
        
        await chrome.storage.local.set({ 
          captureMode: captureMode,
          activationMode: activationMode
        });
        
        // Notify content scripts of activation mode change
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          chrome.tabs.sendMessage(tab.id, { 
            action: 'updateActivationMode',
            mode: activationMode 
          }).catch(() => console.log('Tab not ready for message'));
        }
        
        console.log('✅ Settings saved successfully');
        
        // Visual feedback
        const btn = document.getElementById('saveSettingsBtn');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<span>✅</span><span>Settings Saved!</span>';
        btn.style.background = '#2a4a2a';
        
        setTimeout(() => {
          btn.innerHTML = originalHTML;
          btn.style.background = '#00ff00';
        }, 1500);
      } catch (error) {
        console.error('❌ Error saving settings:', error);
      }
    });
    console.log('✅ Save Settings button listener attached');
  } else {
    console.error('❌ Save Settings button NOT found!');
  }

  // Start Detection Now Button
  const startBtn = document.getElementById('startBtn');
  console.log('🔍 Start Detection button:', startBtn);
  
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      console.log('🎯 START DETECTION BUTTON CLICKED!');
      const btn = document.getElementById('startBtn');
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span><span>Starting...</span>';
      
      try {
        console.log('📋 Querying active tab...');
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        console.log('✅ Active tab:', tab);
        
        const result = await chrome.storage.local.get(['captureMode']);
        const captureMode = result.captureMode || 'fullscreen';
        console.log('📸 Capture mode:', captureMode);
        
        // First, ensure content script is loaded by injecting it
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          console.log('✅ Content script injected');
        } catch (e) {
          console.log('Content script already present or injection failed:', e);
        }
        
        // Small delay to ensure script is ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (captureMode === 'fullscreen') {
          console.log('🖥️ Executing full screen capture...');
          chrome.runtime.sendMessage({ action: 'captureFullScreen' });
        } else {
          console.log('✂️ Triggering snippet capture...');
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              if (typeof startSnippetSelection === 'function') {
                startSnippetSelection();
              } else {
                alert('Extension loaded! Please try again.');
              }
            }
          });
        }
        
        console.log('✅ Script triggered, closing popup');
        window.close();
      } catch (error) {
        console.error('❌ Error starting detection:', error);
        btn.disabled = false;
        btn.innerHTML = '<span>❌</span><span>Error - Try Again</span>';
        setTimeout(() => {
          btn.innerHTML = '<span>🚀</span><span>Start Detection Now</span>';
        }, 2000);
      }
    });
    console.log('✅ Start Detection button listener attached');
  } else {
    console.error('❌ Start Detection button NOT found!');
  }
  
  console.log('🟢 All event listeners setup complete');
});
