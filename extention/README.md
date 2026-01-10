# MCQ Screenshot AI Extension

Edge extension that detects MCQ answers using Groq AI.

## 🚀 Setup

1. **Get Groq API Key**
   - Visit https://console.groq.com/keys
   - Create a free account
   - Generate an API key

2. **Configure Extension**
   - Open `background.js`
   - Replace `YOUR_GROQ_API_KEY_HERE` with your actual API key

3. **Install in Edge**
   - Open Edge browser
   - Go to `edge://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extention` folder

## 📖 Usage

1. Navigate to any webpage with MCQ questions
2. **Click the extension icon** in toolbar
3. You'll see notifications:
   - "📸 Capturing screenshot..."
   - "🤖 Analyzing with AI..."
   - "✅ Answer: A" (or B/C/D)
4. Answer also appears in top-left corner
5. Answer disappears after 5 seconds

## 🔔 Error Notifications

You'll get notifications if:
- ❌ API key not configured
- ❌ Screenshot capture fails
- ❌ Network/API errors
- Check browser console (F12) for detailed error logs

## 🔒 Security

- API key is stored locally in extension code
- Only communicates with Groq API (https://api.groq.com)
- No data is stored or shared elsewhere
- Screenshots are processed in real-time only

## ⚙️ How It Works

1. **Click icon** - Extension captures screenshot
2. **Puter OCR** - Extracts text from image (free, no API key needed)
3. **Groq AI** - Analyzes extracted text and finds answer
4. **Display** - Shows answer (A/B/C/D) in overlay

## 📝 Notes

- **OCR**: Puter (free, no API key needed)
- **AI Model**: Groq's `llama-3.3-70b-versatile`
- Free tier available with rate limits
- Works on all websites
- More accurate with clear text in images
