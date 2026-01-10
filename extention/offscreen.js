chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'CROP_IMAGE') {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = msg.coords.width;
      canvas.height = msg.coords.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, msg.coords.x, msg.coords.y, msg.coords.width, msg.coords.height, 0, 0, msg.coords.width, msg.coords.height);
      sendResponse(canvas.toDataURL('image/png'));
    };
    img.src = msg.image;
    return true;
  }
});
