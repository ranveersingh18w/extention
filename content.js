// ========== MCQ AI CONTENT SCRIPT - SUPER ROBUST VERSION ==========
console.log('🟢🟢🟢 MCQ AI content script LOADED AND READY!');

let activationMode = 'tripleclick';
let clickCount = 0;
let clickTimer = null;
let lastClickTime = 0;

// Load activation mode from storage
chrome.storage.local.get(['activationMode'], (result) => {
  activationMode = result.activationMode || 'tripleclick';
  console.log('⚡⚡⚡ Activation mode LOADED:', activationMode);
});

// Listen for activation mode updates
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateActivationMode') {
    activationMode = request.mode;
    console.log('⚡⚡⚡ Activation mode UPDATED to:', activationMode);
  } else if (request.action === 'cropImage') {
    // Handle image cropping request from background script
    console.log('✂️ Received crop request:', request.rect);
    cropImageInContent(request.dataUrl, request.rect)
      .then(croppedImage => {
        sendResponse({ croppedImage: croppedImage });
      })
      .catch(error => {
        console.error('❌ Cropping failed:', error);
        sendResponse({ croppedImage: request.dataUrl }); // Return original on error
      });
    return true; // Keep channel open for async response
  }
  return true;
});

// ========== TRIPLE-CLICK DETECTION - BULLETPROOF VERSION ==========
function setupTripleClickDetection() {
  document.addEventListener('click', function tripleClickHandler(e) {
    // Only work in triple-click mode
    if (activationMode !== 'tripleclick') {
      console.log('⏭️ Not in triple-click mode, skipping');
      return;
    }
    
    const currentTime = Date.now();
    const timeDiff = currentTime - lastClickTime;
    
    console.log(`👆 CLICK! Count: ${clickCount + 1}, Time since last: ${timeDiff}ms`);
    
    // Reset if too much time passed (500ms window)
    if (timeDiff > 500) {
      console.log('⏱️ Too slow, resetting count');
      clickCount = 0;
    }
    
    clickCount++;
    lastClickTime = currentTime;
    
    // THREE CLICKS = ACTIVATE!
    if (clickCount >= 3) {
      console.log('🎯🎯🎯 TRIPLE-CLICK DETECTED!!!');
      clickCount = 0; // Reset immediately
      
      // Stop the click from doing anything else
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      // Trigger detection
      triggerDetection();
    }
    
    // Auto-reset after 600ms
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      clickCount = 0;
      console.log('🔄 Click count reset');
    }, 600);
  }, true); // Capture phase for priority
  
  console.log('✅ Triple-click detection ARMED and READY!');
}

// Start triple-click detection immediately
setupTripleClickDetection();

// ========== KEYBOARD SHORTCUT DETECTION ==========
document.addEventListener('keydown', (e) => {
  if (activationMode !== 'ctrlshifta') return;
  
  if (e.ctrlKey && e.shiftKey && e.key === 'A') {
    e.preventDefault();
    console.log('⌨️⌨️⌨️ Ctrl+Shift+A DETECTED!!!');
    triggerDetection();
  }
});

// ========== TRIGGER DETECTION FUNCTION ==========
async function triggerDetection() {
  try {
    console.log('🚀🚀🚀 TRIGGERING DETECTION...');
    
    // Get settings
    const result = await chrome.storage.local.get(['captureMode']);
    const captureMode = result.captureMode || 'fullscreen';
    
    console.log('📸 Capture mode:', captureMode);
    
    if (captureMode === 'fullscreen') {
      console.log('📺 Capturing FULL SCREEN...');
      chrome.runtime.sendMessage({ action: 'captureFullScreen' });
    } else {
      console.log('✂️ Starting SNIPPET selection...');
      startSnippetSelection();
    }
  } catch (error) {
    console.error('❌❌❌ Error triggering detection:', error);
    alert('ERROR: Extension context invalidated. Please RELOAD the extension in chrome://extensions/');
  }
}

// ========== SNIPPET SELECTION - WORKING VERSION ==========
function startSnippetSelection() {
  console.log('📸📸📸 STARTING SNIPPET SELECTION...');
  
  // Clean up any existing elements
  const existingOverlay = document.getElementById('mcq-snippet-overlay');
  if (existingOverlay) existingOverlay.remove();
  
  const existingInstructions = document.querySelector('[data-mcq-instructions]');
  if (existingInstructions) existingInstructions.remove();
  
  const existingSelection = document.getElementById('mcq-selection-box');
  if (existingSelection) existingSelection.remove();
  
  // Create semi-transparent overlay
  const overlay = document.createElement('div');
  overlay.id = 'mcq-snippet-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
  overlay.style.zIndex = '2147483647';
  overlay.style.cursor = 'crosshair';
  overlay.style.userSelect = 'none';
  
  // Create instructions
  const instructions = document.createElement('div');
  instructions.setAttribute('data-mcq-instructions', 'true');
  instructions.style.position = 'fixed';
  instructions.style.top = '20px';
  instructions.style.left = '50%';
  instructions.style.transform = 'translateX(-50%)';
  instructions.style.backgroundColor = '#00ff00';
  instructions.style.color = '#1a1a1a';
  instructions.style.padding = '15px 30px';
  instructions.style.borderRadius = '10px';
  instructions.style.fontFamily = 'Arial, sans-serif';
  instructions.style.fontSize = '16px';
  instructions.style.fontWeight = 'bold';
  instructions.style.boxShadow = '0 4px 12px rgba(0,255,0,0.5)';
  instructions.style.zIndex = '2147483648';
  instructions.style.pointerEvents = 'none';
  instructions.textContent = '📸 Click and drag to select MCQ area (ESC to cancel)';
  
  document.body.appendChild(overlay);
  document.body.appendChild(instructions);
  
  console.log('✅ Overlay and instructions created!');
  
  // Selection state
  let startX = 0;
  let startY = 0;
  let selectionBox = null;
  let isDrawing = false;
  
  // Mouse down - start selection
  function onMouseDown(e) {
    console.log('🖱️ MOUSE DOWN at:', e.clientX, e.clientY);
    isDrawing = true;
    startX = e.clientX;
    startY = e.clientY;
    
    // Create selection box
    if (selectionBox) selectionBox.remove();
    
    selectionBox = document.createElement('div');
    selectionBox.id = 'mcq-selection-box';
    selectionBox.style.position = 'fixed';
    selectionBox.style.border = '3px solid #00ff00';
    selectionBox.style.backgroundColor = 'rgba(0, 255, 0, 0.2)';
    selectionBox.style.zIndex = '2147483647';
    selectionBox.style.pointerEvents = 'none';
    selectionBox.style.left = startX + 'px';
    selectionBox.style.top = startY + 'px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    
    document.body.appendChild(selectionBox);
    console.log('✅ Selection box created!');
    
    e.preventDefault();
    e.stopPropagation();
  }
  
  // Mouse move - update selection
  function onMouseMove(e) {
    if (!isDrawing || !selectionBox) return;
    
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    
    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
    
    e.preventDefault();
  }
  
  // Mouse up - complete selection
  function onMouseUp(e) {
    if (!isDrawing) return;
    
    console.log('🖱️ MOUSE UP at:', e.clientX, e.clientY);
    isDrawing = false;
    
    const endX = e.clientX;
    const endY = e.clientY;
    
    const rect = {
      x: Math.min(startX, endX),
      y: Math.min(startY, endY),
      width: Math.abs(endX - startX),
      height: Math.abs(endY - startY)
    };
    
    console.log('📐 Selection rect:', rect);
    
    // Clean up UI
    cleanup();
    
    // Send capture request if selection is valid
    if (rect.width > 10 && rect.height > 10) {
      console.log('✅✅✅ Sending CAPTURE request to background...');
      chrome.runtime.sendMessage({ 
        action: 'captureSnippet',
        rect: rect
      }).catch(err => {
        console.error('❌ Failed to send message:', err);
        alert('ERROR: Extension disconnected. Please RELOAD the extension!');
      });
    } else {
      console.log('⚠️ Selection too small, cancelled');
    }
    
    e.preventDefault();
  }
  
  // ESC key - cancel selection
  function onEscape(e) {
    if (e.key === 'Escape') {
      console.log('❌ Selection CANCELLED by ESC');
      cleanup();
    }
  }
  
  // Cleanup function
  function cleanup() {
    overlay.remove();
    instructions.remove();
    if (selectionBox) selectionBox.remove();
    
    overlay.removeEventListener('mousedown', onMouseDown);
    overlay.removeEventListener('mousemove', onMouseMove);
    overlay.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('keydown', onEscape);
    
    console.log('🧹 Cleaned up selection UI');
  }
  
  // Attach event listeners
  overlay.addEventListener('mousedown', onMouseDown);
  overlay.addEventListener('mousemove', onMouseMove);
  overlay.addEventListener('mouseup', onMouseUp);
  document.addEventListener('keydown', onEscape);
  
  console.log('✅✅✅ Event listeners ATTACHED and READY!');
}

// Crop image function - runs in content script where Image/Canvas is available
async function cropImageInContent(dataUrl, rect) {
  return new Promise((resolve, reject) => {
    console.log('✂️ cropImageInContent called with rect:', rect);
    
    const img = new Image();
    
    img.onerror = (error) => {
      console.error('❌ Image load error:', error);
      reject(new Error('Failed to load image for cropping'));
    };
    
    img.onload = () => {
      try {
        console.log('✅ Image loaded. Size:', img.width, 'x', img.height);
        console.log('📐 Crop rect:', rect);
        
        // Use rect coordinates directly (no DPI scaling needed)
        const cropX = Math.max(0, Math.floor(rect.x));
        const cropY = Math.max(0, Math.floor(rect.y));
        const cropWidth = Math.min(Math.floor(rect.width), img.width - cropX);
        const cropHeight = Math.min(Math.floor(rect.height), img.height - cropY);
        
        console.log('📐 Final crop:', {cropX, cropY, cropWidth, cropHeight});
        
        if (cropWidth <= 0 || cropHeight <= 0) {
          console.error('❌ Invalid crop dimensions');
          resolve(dataUrl); // Return original
          return;
        }
        
        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { alpha: false });
        
        canvas.width = cropWidth;
        canvas.height = cropHeight;
        
        // White background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw cropped portion
        ctx.drawImage(
          img,
          cropX, cropY, cropWidth, cropHeight,
          0, 0, cropWidth, cropHeight
        );
        
        console.log('✅ Image cropped successfully');
        
        // Convert to data URL
        const croppedDataUrl = canvas.toDataURL('image/png', 1.0);
        resolve(croppedDataUrl);
        
      } catch (error) {
        console.error('❌ Cropping error:', error);
        reject(error);
      }
    };
    
    img.src = dataUrl;
  });
}

console.log('✅✅✅ MCQ AI shortcuts READY! (Triple-click or Ctrl+Shift+A)');
