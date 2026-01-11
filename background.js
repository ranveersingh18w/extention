// Listen for messages from popup/content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureFullScreen') {
    captureAndAnalyze(sender.tab.id, null);
  } else if (request.action === 'captureSnippet') {
    captureAndAnalyze(sender.tab.id, request.rect);
  }
});

async function captureAndAnalyze(tabId, rect) {
  try {
    console.log('🚀 Starting capture and analyze...', { tabId, rect });
    
    // Show notification
    await showNotification('📸 Capturing screenshot...');
    
    // Capture screenshot
    console.log('📸 Capturing visible tab...');
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    console.log('✅ Screenshot captured, size:', dataUrl.length, 'bytes');
    
    // If snippet, crop the image using OffscreenCanvas (faster, no content script needed)
    let finalImage = dataUrl;
    if (rect && rect.width > 0 && rect.height > 0) {
      console.log('✂️ Cropping with OffscreenCanvas (fast):', rect);
      finalImage = await cropImageWithOffscreenCanvas(dataUrl, rect);
      console.log('✅ Image cropped, new size:', finalImage.length, 'bytes');
    } else {
      console.log('📺 Using full screenshot (no cropping)');
    }
    
    // Show analyzing notification
    await showNotification('🔍 Extracting text with OCR...');
    
    // Extract text using OCR.space
    console.log('🔍 Starting OCR extraction...');
    const extractedText = await extractTextFromImage(finalImage);
    
    // Display FULL OCR output in console
    console.log('\n' + '═'.repeat(80));
    console.log('📄 OCR EXTRACTED TEXT (FULL OUTPUT):');
    console.log('═'.repeat(80));
    console.log(extractedText);
    console.log('═'.repeat(80));
    console.log('📏 Text length:', extractedText.length, 'characters\n');
    
    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('No text found in image. Try capturing a clearer area.');
    }
    
    // Show AI analysis notification
    await showNotification('🤖 Analyzing MCQ with Gemini 2.5 Flash...');
    
    // Analyze with Google Gemini 2.5 Flash (ONLY AI - Groq removed due to API key issues)
    console.log('🤖 Sending to Google Gemini 2.5 Flash for analysis...');
    const answer = await analyzeWithGemini(extractedText);
    console.log('✅ Gemini Answer received:', answer);
    
    // Show success notification
    await showNotification(`✅ Answer: ${answer}`);
    
    // Display answer on page
    console.log('📺 Displaying answer on page...');
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: displayAnswer,
      args: [answer]
    });
    
    console.log('🎉 Complete! Answer displayed.');
    
  } catch (error) {
    console.error('❌❌❌ Error in captureAndAnalyze:', error);
    await showNotification(`❌ Error: ${error.message}`);
  }
}

// Crop image using OffscreenCanvas - FAST (no content script needed)
async function cropImageWithOffscreenCanvas(dataUrl, rect) {
  try {
    console.log('✂️ cropImageWithOffscreenCanvas called with rect:', rect);
    
    // Convert base64 data URL to Blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    console.log('✅ Converted to blob, size:', blob.size, 'bytes');
    
    // Create ImageBitmap (faster than Image element)
    const imageBitmap = await createImageBitmap(blob);
    console.log('✅ ImageBitmap created, size:', imageBitmap.width, 'x', imageBitmap.height);
    
    // Calculate crop coordinates
    const cropX = Math.max(0, Math.floor(rect.x));
    const cropY = Math.max(0, Math.floor(rect.y));
    const cropWidth = Math.min(Math.floor(rect.width), imageBitmap.width - cropX);
    const cropHeight = Math.min(Math.floor(rect.height), imageBitmap.height - cropY);
    
    console.log('📐 Crop coordinates:', {cropX, cropY, cropWidth, cropHeight});
    
    // Validate
    if (cropWidth <= 0 || cropHeight <= 0) {
      console.error('❌ Invalid crop dimensions');
      return dataUrl; // Return original
    }
    
    // Create OffscreenCanvas
    const canvas = new OffscreenCanvas(cropWidth, cropHeight);
    const ctx = canvas.getContext('2d');
    
    // Draw cropped portion
    ctx.drawImage(
      imageBitmap,
      cropX, cropY, cropWidth, cropHeight,  // Source
      0, 0, cropWidth, cropHeight            // Destination
    );
    
    console.log('✅ Image drawn to OffscreenCanvas');
    
    // Convert to blob then base64
    const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
    console.log('✅ Converted to blob, size:', croppedBlob.size, 'bytes');
    
    // Convert blob to base64 data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        console.log('✅ Cropped image ready');
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(croppedBlob);
    });
    
  } catch (error) {
    console.error('❌ OffscreenCanvas crop error:', error);
    return dataUrl; // Return original on error
  }
}

// Extract text from image using OCR.space API (Engine 2 - Better accuracy)
async function extractTextFromImage(imageDataUrl) {
  try {
    console.log('🔍 Starting OCR.space text extraction (Engine 2)...');
    
    // Create form data for OCR.space
    const formData = new FormData();
    formData.append('base64Image', imageDataUrl);
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');
    formData.append('OCREngine', '2');  // Engine 2 - Better for text
    formData.append('isTable', 'false');
    
    console.log('📤 Sending request to OCR.space API (Engine 2)...');
    
    // Call OCR.space API
    const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: {
        'apikey': 'K84502246688957'
      },
      body: formData
    });
    
    if (!ocrResponse.ok) {
      throw new Error(`OCR API request failed: ${ocrResponse.status} ${ocrResponse.statusText}`);
    }
    
    const ocrData = await ocrResponse.json();
    console.log('📥 OCR Response received:', ocrData);
    
    // Check for errors
    if (ocrData.IsErroredOnProcessing) {
      throw new Error(ocrData.ErrorMessage?.[0] || 'OCR processing error');
    }
    
    // Extract text from response
    if (ocrData.ParsedResults && ocrData.ParsedResults.length > 0) {
      const extractedText = ocrData.ParsedResults[0].ParsedText;
      console.log('✅ OCR Extracted text:', extractedText);
      
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('No text found in image. Try a clearer screenshot.');
      }
      
      return extractedText.trim();
    }
    
    throw new Error('No text found in OCR response');
    
  } catch (error) {
    console.error('❌ OCR Error:', error);
    throw new Error('OCR failed: ' + error.message);
  }
}

// Analyze text with Google Gemini 2.5 Flash
async function analyzeWithGemini(text) {
  try {
    console.log(' Starting Google Gemini 2.5 Flash analysis...');
    console.log(' Text to analyze:', text);
    
    // Changing from hardcoded key to pulling from storage or using fallback
    // The user wants to use the UI box for the key.
    
    // Retrieving the key from storage inside the function is better
    const storageData = await chrome.storage.local.get(['geminiApiKey']);
    const GEMINI_API_KEY = storageData.geminiApiKey;
    
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API Key not configured. Please set it in the extension popup.');
    }
    
    const model_name = 'gemini-2.5-flash';
    
    console.log(' Using Gemini 2.5 Flash API...');
    
    // Correct string interpolation with backticks and ${} syntax
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model_name}:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Analyze this multiple choice question step-by-step and provide ONLY the answer letter (A, B, C, or D).

Think through each option carefully, then respond with just one letter.

Question:
${text}

Answer (single letter only):`
          }]
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(' Gemini API error:', errorData);
      // Correct string interpolation for error message
      throw new Error(`Gemini API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(' Gemini response:', data);
    
    // Extract text from Gemini response
    const fullResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log(' Full Gemini output:', fullResponse);
    
    let answer = fullResponse.trim().toUpperCase();
    console.log(' Raw answer:', answer);
    
    // Extract only A, B, C, or D
    const letterMatches = answer.match(/[A-D]/g);
    if (letterMatches && letterMatches.length > 0) {
      answer = letterMatches[letterMatches.length - 1];
      console.log(' Final answer (Gemini):', answer);
      return answer;
    }
    
    throw new Error('Gemini did not return a valid answer (A/B/C/D). Got: ' + fullResponse);
    
  } catch (error) {
    console.error(' Gemini Error:', error);
    throw error;
  }
}
// Analyze text with Groq AI - GPT-OSS-120B REASONING MODEL
async function analyzeWithGroq(text) {
  try {
    console.log(' Starting GPT-OSS-120B Reasoning Model analysis...');
    console.log(' Text to analyze:', text);
    
    // Get API key from storage
    const result = await chrome.storage.local.get(['groqApiKey']);
    const apiKey = result.groqApiKey;
    
    if (!apiKey) {
      throw new Error('Groq API key not configured. Please set it in the extension popup settings.');
    }
    
    console.log(' API key found, sending to GPT-OSS-120B reasoning model...');
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer {apiKey}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',  // GPT-OSS REASONING MODEL
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant that explains reasoning step by step. You specialize in solving multiple choice questions.

Your task:
1. Read the MCQ question carefully
2. Analyze each option (A, B, C, D) with logical reasoning
3. Think step-by-step to determine the correct answer
4. Return ONLY the single letter of the correct answer

CRITICAL RULES:
- Use deep reasoning internally
- Output ONLY one letter: A, B, C, or D
- NO explanations in the final response
- NO punctuation or extra text
- Just the letter`
          },
          {
            role: 'user',
            content: `Explain step-by-step and solve this MCQ:

{text}

After your internal reasoning, respond with ONLY the letter (A, B, C, or D) of the correct answer.`
          }
        ],
        temperature: 0.3,
        max_tokens: 500,
        top_p: 0.9
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error(' GPT-OSS-120B API error:', errorData);
      throw new Error(errorData.error?.message || `API request failed: {response.status}`);
    }
    
    const data = await response.json();
    console.log(' GPT-OSS-120B response:', data);
    
    // GPT-OSS may provide reasoning in the response
    const fullResponse = data.choices?.[0]?.message?.content || '';
    console.log(' Full reasoning output:', fullResponse);
    
    let answer = fullResponse.trim().toUpperCase();
    console.log(' Raw answer:', answer);
    
    // Clean up the answer - extract only A, B, C, or D
    // Look for the last occurrence of A, B, C, or D (likely the final answer)
    const letterMatches = answer.match(/[A-D]/g);
    if (letterMatches && letterMatches.length > 0) {
      // Take the last letter found (usually the conclusion)
      answer = letterMatches[letterMatches.length - 1];
      console.log(' Final answer (after reasoning):', answer);
      return answer;
    }
    
    throw new Error('AI did not return a valid answer (A/B/C/D). Got: ' + fullResponse);
    
  } catch (error) {
    console.error(' GPT-OSS-120B Error:', error);
    throw error;
  }
}
// Show notification
async function showNotification(message) {
  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: 'MCQ AI Detector',
      message: message,
      priority: 2
    });
  } catch (error) {
    console.error('Notification error:', error);
  }
}

// Function to display answer on page
function displayAnswer(answer) {
  // Remove existing answer if present
  const existing = document.getElementById('mcq-ai-answer');
  if (existing) {
    existing.remove();
  }
  
  // Create answer display - TOP LEFT CORNER
  const answerDiv = document.createElement('div');
  answerDiv.id = 'mcq-ai-answer';
  answerDiv.style.cssText = `
    position: fixed;
    top: 20px;
    left: 20px;
    background: linear-gradient(135deg, #00ff00 0%, #00cc00 100%);
    color: #1a1a1a;
    padding: 25px 35px;
    border-radius: 15px;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 48px;
    font-weight: bold;
    z-index: 999999;
    box-shadow: 0 10px 30px rgba(0,255,0,0.5);
    animation: slideInLeft 0.5s ease-out;
    cursor: pointer;
    text-align: center;
    min-width: 100px;
    border: 3px solid #00ff00;
  `;
  
  answerDiv.innerHTML = `
    <div style="font-size: 14px; margin-bottom: 5px; opacity: 0.8; font-weight: 600;">Answer:</div>
    <div style="font-size: 70px; text-shadow: 2px 2px 4px rgba(0,0,0,0.2); letter-spacing: 2px;">${answer}</div>
  `;
  
  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInLeft {
      from {
        left: -300px;
        opacity: 0;
      }
      to {
        left: 20px;
        opacity: 1;
      }
    }
    @keyframes slideOutLeft {
      from {
        left: 20px;
        opacity: 1;
      }
      to {
        left: -300px;
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(answerDiv);
  
  // Remove on click
  answerDiv.addEventListener('click', () => {
    answerDiv.style.animation = 'slideOutLeft 0.5s ease-out';
    setTimeout(() => answerDiv.remove(), 500);
  });
  
  // Auto remove after 2 seconds
  setTimeout(() => {
    if (document.body.contains(answerDiv)) {
      answerDiv.style.animation = 'slideOutLeft 0.5s ease-out';
      setTimeout(() => answerDiv.remove(), 500);
    }
  }, 2000);
}
