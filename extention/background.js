const GROQ_API_KEY = "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";
const OCR_API_KEY = "K84502246688957";

let triggerMethod = 'click';
let useSnippet = true;
let aiModel = 'groq';

// Load settings on startup
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['triggerMethod', 'useSnippet', 'aiModel'], (result) => {
    triggerMethod = result.triggerMethod || 'click';
    useSnippet = result.useSnippet !== undefined ? result.useSnippet : true;
    aiModel = result.aiModel || 'groq';
  });
  
  // Create context menu
  chrome.contextMenus.create({
    id: "mcq-detect",
    title: "🔍 Detect MCQ Answer",
    contexts: ["all"]
  });
});

// Listen for settings updates
chrome.runtime.onMessage.addListener((msg, sender) => {
  console.log("Background received message:", msg.action);
  if (msg.action === "UPDATE_TRIGGER") {
    triggerMethod = msg.method;
  } else if (msg.action === "UPDATE_SETTINGS") {
    useSnippet = msg.useSnippet;
    aiModel = msg.aiModel;
  } else if (msg.action === "START_DETECTION") {
    chrome.tabs.get(msg.tabId, (tab) => {
      startSelection(tab);
    });
  } else if (msg.action === "CAPTURE_AREA" && msg.coords) {
    console.log("========================================");
    console.log("📸 CAPTURE REQUEST RECEIVED");
    console.log("Coordinates:", msg.coords);
    console.log("========================================");
    showNotification("📸 Capturing selection...", "info");
    
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (image) => {
      if (chrome.runtime.lastError) {
        console.error("❌ Capture failed:", chrome.runtime.lastError);
        showNotification("❌ Failed to capture", "error");
        return;
      }
      console.log("✅ Screenshot captured successfully");
      cropAndProcess(image, msg.coords, sender.tab.id);
    });
  } else if (msg.action === "START_SELECTION_REQUEST") {
    startSelection(sender.tab);
  }
});

// Context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "mcq-detect") {
    startSelection(tab);
  }
});

// Keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
  if (command === "trigger-selection") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) startSelection(tabs[0]);
    });
  }
});

// Extension icon click
chrome.action.onClicked.addListener((tab) => {
  // This will be handled by popup now
});

function startSelection(tab) {
  console.log("========================================");
  console.log("🚀 START SELECTION");
  console.log("Tab:", tab.url);
  console.log("Use Snippet:", useSnippet);
  console.log("========================================");
  
  // Check restricted pages
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || 
      tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
    showNotification("❌ Cannot work on this page. Open a regular webpage.", "error");
    return;
  }
  
  // Full screenshot mode
  if (!useSnippet) {
    showNotification("📸 Capturing full screen...", "info");
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (image) => {
      if (chrome.runtime.lastError) {
        console.error("Capture error:", chrome.runtime.lastError);
        showNotification("❌ Failed to capture", "error");
        return;
      }
      console.log("✅ Full screenshot captured");
      processImage(image, tab.id);
    });
    return;
  }
  
  // Snippet selection mode
  console.log("Activating snippet selection mode...");
  chrome.tabs.sendMessage(tab.id, { action: "START_SELECTION", method: triggerMethod }).catch(() => {
    console.log("Content script not loaded, injecting...");
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    }).then(() => {
      console.log("Content script injected, sending START_SELECTION...");
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, { action: "START_SELECTION", method: triggerMethod });
      }, 100);
    }).catch(err => {
      console.error("Failed to inject content script:", err);
      showNotification("❌ Cannot inject script on this page", "error");
    });
  });
}

function startDetection(tab) {
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || 
      tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
    showNotification("❌ Cannot work on this page", "error");
    return;
  }
  
  if (!useSnippet) {
    // Full screenshot mode
    showNotification("📸 Capturing screen...", "info");
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (image) => {
      if (chrome.runtime.lastError) {
        showNotification("❌ Capture failed", "error");
        return;
      }
      processImage(image, tab.id);
    });
  } else {
    // Snippet mode
    chrome.tabs.sendMessage(tab.id, { action: "START_SELECTION" }).catch(() => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }).then(() => {
        setTimeout(() => chrome.tabs.sendMessage(tab.id, { action: "START_SELECTION" }), 100);
      }).catch(() => showNotification("❌ Cannot inject script", "error"));
    });
  }
}

function cropAndProcess(base64Image, coords, tabId) {
  console.log("========================================");
  console.log("✂️ CROPPING IMAGE");
  console.log("========================================");
  
  // Create offscreen document for image processing
  chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['BLOBS'],
    justification: 'Process screenshot'
  }).catch((err) => {
    console.log("Offscreen document already exists or error:", err.message);
  }).finally(() => {
    console.log("Sending crop request to offscreen document...");
    chrome.runtime.sendMessage({
      action: 'CROP_IMAGE',
      image: base64Image,
      coords: coords
    }).then(croppedImage => {
      console.log("✅ Image cropped successfully");
      showNotification("🔍 Extracting text...", "info");
      processImage(croppedImage, tabId);
    }).catch(err => {
      console.error("❌ Crop failed:", err);
      showNotification("❌ Crop failed: " + err.message, "error");
    });
  });
}

function showNotification(message, type) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    title: "MCQ AI",
    message: message,
    priority: 2
  });
}

async function processImage(base64Image, tabId) {
  try {
    showNotification("🔍 Reading text...", "info");
    const base64Data = base64Image.replace(/^data:image\/png;base64,/, '');
    
    // OCR with Engine 2
    const formData = new FormData();
    formData.append('base64Image', `data:image/png;base64,${base64Data}`);
    formData.append('language', 'eng');
    formData.append('apikey', OCR_API_KEY);
    formData.append('OCREngine', '2');
    formData.append('scale', 'true');
    formData.append('isTable', 'true');
    
    const ocrResponse = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: formData
    });

    const ocrData = await ocrResponse.json();
    if (!ocrData.ParsedResults?.[0]?.ParsedText) {
      throw new Error("OCR failed");
    }
    
    const extractedText = ocrData.ParsedResults[0].ParsedText;
    console.log("📄 OCR Text:", extractedText);
    
    if (extractedText.length < 20) {
      throw new Error("Text too short. Select larger area.");
    }
    
    // Analyze with Groq
    showNotification("🤖 Analyzing...", "info");
    const answer = await analyzeWithGroq(extractedText);
    
    showNotification(`✅ Answer: ${answer}`, "success");
    
    chrome.tabs.sendMessage(tabId, {
      action: "SHOW_RESULT",
      answer: answer
    }).catch(() => {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      }).then(() => {
        setTimeout(() => chrome.tabs.sendMessage(tabId, {
          action: "SHOW_RESULT",
          answer: answer
        }), 100);
      });
    });
    
  } catch (error) {
    console.error("Error:", error);
    showNotification(`❌ ${error.message}`, "error");
  }
}

async function analyzeWithGroq(extractedText) {
  try {
    console.log("========================================");
    console.log("🤖 CALLING GROQ API");
    console.log("========================================");
    
    const promptText = `Question:\n${extractedText}\n\nWhat is the correct answer? Reply with only ONE letter (A, B, C, or D):`;
    
    console.log("📤 PROMPT SENT TO AI:");
    console.log("========================================");
    console.log(promptText);
    console.log("========================================");
    
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: "You are an MCQ solver. Always respond with exactly one letter: A, B, C, or D. Never add explanations."
          },
          {
            role: "user",
            content: promptText
          }
        ],
        temperature: 0.2,
        max_tokens: 10,
        top_p: 0.9
      })
    });

    if (!groqResponse.ok) {
      const errorData = await groqResponse.json().catch(() => ({}));
      console.error("❌ GROQ API ERROR:", errorData);
      throw new Error(errorData.error?.message || `API Error: ${groqResponse.status}`);
    }

    const groqData = await groqResponse.json();
    
    console.log("========================================");
    console.log("📥 FULL GROQ API RESPONSE:");
    console.log("========================================");
    console.log(JSON.stringify(groqData, null, 2));
    console.log("========================================");
    
    const fullAnswer = groqData.choices?.[0]?.message?.content?.trim() || "";
    
    console.log("📋 RAW ANSWER FROM AI:");
    console.log("========================================");
    console.log(`"${fullAnswer}"`);
    console.log("Length:", fullAnswer.length);
    console.log("========================================");
    
    // Try multiple extraction methods
    let cleanAnswer = fullAnswer.match(/\b[ABCD]\b/i)?.[0]?.toUpperCase();
    
    if (!cleanAnswer) {
      cleanAnswer = fullAnswer.match(/[ABCD]/i)?.[0]?.toUpperCase();
    }
    
    if (!cleanAnswer) {
      console.error("========================================");
      console.error("❌ COULD NOT EXTRACT A/B/C/D");
      console.error("Raw response was:", `"${fullAnswer}"`);
      console.error("========================================");
      cleanAnswer = fullAnswer.substring(0, 3) || "?";
    }
    
    console.log("========================================");
    console.log("✅ FINAL ANSWER:");
    console.log("========================================");
    console.log(cleanAnswer);
    console.log("========================================");
    
    // Show AI response in notification too
    showNotification(`🤖 AI said: "${fullAnswer}" → Final: ${cleanAnswer}`, "info");
    
    return cleanAnswer;
  } catch (error) {
    console.error("Groq error:", error);
    throw new Error(`Groq Error: ${error.message}`);
  }
}

async function analyzeWithGemini(extractedText) {
  try {
    console.log("Calling Gemini API...");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You must respond with ONLY one letter: A, B, C, or D. No explanation.\n\nMCQ:\n${extractedText}\n\nCorrect answer letter:`
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini error response:", errorText);
      throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
    }

    const geminiData = await response.json();
    console.log("Gemini full response:", geminiData);
    const answer = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "?";
    const cleanAnswer = answer.match(/[ABCD]/i)?.[0]?.toUpperCase() || "?";
    
    console.log("Gemini Response:", answer);
    return cleanAnswer;
  } catch (error) {
    console.error("Gemini error:", error);
    throw new Error(`Gemini Error: ${error.message}`);
  }
}
