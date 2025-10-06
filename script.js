const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const canvasContainer = document.getElementById('canvasContainer');
const canvas = document.getElementById('imageCanvas');
const ctx = canvas.getContext('2d');
const cropBtn = document.getElementById('cropBtn');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');

let image = new Image();
let currentImage = null; // tracks original or cropped
let startX, startY;
let isDrawing = false;
let isDragging = false;
let isResizing = false;
let resizeCorner = null;
let imageLoaded = false;
let cropBox = null;
let croppedDataURL = null;
const handleSize = 10;

// --- File handling ---
dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);
dropzone.addEventListener('dragover', e => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) loadImage(file);
});

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) loadImage(file);
}

function loadImage(file) {
  const reader = new FileReader();
  reader.onload = e => {
    image.onload = () => {
      canvas.width = image.width;
      canvas.height = image.height;
      currentImage = image; // set currentImage to original
      ctx.drawImage(currentImage, 0, 0);
      canvasContainer.classList.remove('hidden');
      imageLoaded = true;
      saveBtn.classList.add('hidden');
      cropBox = null;
    };
    image.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// --- Utility: scale mouse coordinates ---
function getMousePos(canvas, evt) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (evt.clientX - rect.left) * scaleX,
    y: (evt.clientY - rect.top) * scaleY
  };
}

// --- Draw overlay and box ---
function drawScene() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(currentImage, 0, 0); // draw current image

  if (!cropBox) return;

  // Semi-transparent overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Clear selection area
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillRect(cropBox.x, cropBox.y, cropBox.w, cropBox.h);
  ctx.restore();

  // Outline crop box
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  ctx.strokeRect(cropBox.x, cropBox.y, cropBox.w, cropBox.h);

  // Draw corner handles
  ['tl','tr','bl','br'].forEach(corner => {
    const pos = getCornerPos(corner);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(pos.x - handleSize / 2, pos.y - handleSize / 2, handleSize, handleSize);
  });
}

// --- Corner helpers ---
function getCornerPos(corner) {
  switch(corner) {
    case 'tl': return {x: cropBox.x, y: cropBox.y};
    case 'tr': return {x: cropBox.x + cropBox.w, y: cropBox.y};
    case 'bl': return {x: cropBox.x, y: cropBox.y + cropBox.h};
    case 'br': return {x: cropBox.x + cropBox.w, y: cropBox.y + cropBox.h};
  }
}

function getHandleUnderMouse(pos) {
  const corners = ['tl','tr','bl','br'];
  for(const corner of corners){
    const c = getCornerPos(corner);
    if(Math.abs(pos.x - c.x) < handleSize && Math.abs(pos.y - c.y) < handleSize) return corner;
  }
  return null;
}

// --- Mouse events ---
canvas.addEventListener('mousedown', e => {
  if(!imageLoaded) return;
  const pos = getMousePos(canvas, e);

  if(cropBox){
    const corner = getHandleUnderMouse(pos);
    if(corner){
      isResizing = true;
      resizeCorner = corner;
      return;
    } else if(isInsideBox(pos, cropBox)){
      isDragging = true;
      startX = pos.x;
      startY = pos.y;
      return;
    }
  }

  // Start new crop
  startX = pos.x;
  startY = pos.y;
  cropBox = {x:startX, y:startY, w:0, h:0};
  isDrawing = true;
});

canvas.addEventListener('mousemove', e => {
  if(!imageLoaded) return;
  const pos = getMousePos(canvas, e);

  if(isDrawing){
    cropBox.w = pos.x - startX;
    cropBox.h = pos.y - startY;
  } else if(isDragging){
    const dx = pos.x - startX;
    const dy = pos.y - startY;
    cropBox.x += dx;
    cropBox.y += dy;
    startX = pos.x;
    startY = pos.y;
  } else if(isResizing && resizeCorner){
    resizeCropBox(resizeCorner, pos);
  }

  drawScene();
});

canvas.addEventListener('mouseup', () => {
  isDrawing = false;
  isDragging = false;
  isResizing = false;
  resizeCorner = null;
});

// --- Helpers ---
function isInsideBox(pos, box){
  return pos.x > box.x && pos.x < box.x + box.w && pos.y > box.y && pos.y < box.y + box.h;
}

function resizeCropBox(corner, pos){
  switch(corner){
    case 'tl':
      cropBox.w += cropBox.x - pos.x;
      cropBox.h += cropBox.y - pos.y;
      cropBox.x = pos.x;
      cropBox.y = pos.y;
      break;
    case 'tr':
      cropBox.w = pos.x - cropBox.x;
      cropBox.h += cropBox.y - pos.y;
      cropBox.y = pos.y;
      break;
    case 'bl':
      cropBox.w += cropBox.x - pos.x;
      cropBox.x = pos.x;
      cropBox.h = pos.y - cropBox.y;
      break;
    case 'br':
      cropBox.w = pos.x - cropBox.x;
      cropBox.h = pos.y - cropBox.y;
      break;
  }
}

// --- Crop ---
cropBtn.addEventListener('click', () => {
  if(!cropBox || cropBox.w === 0 || cropBox.h === 0){
    alert('Please draw a box first.');
    return;
  }

  const {x, y, w, h} = cropBox;

  const croppedCanvas = document.createElement('canvas');
  const croppedCtx = croppedCanvas.getContext('2d');
  croppedCanvas.width = Math.abs(w);
  croppedCanvas.height = Math.abs(h);

  // Draw cropped portion to temporary canvas
  croppedCtx.drawImage(
    currentImage,
    w > 0 ? x : x + w,
    h > 0 ? y : y + h,
    Math.abs(w),
    Math.abs(h),
    0,
    0,
    Math.abs(w),
    Math.abs(h)
  );

  // Keep original canvas size, draw cropped image at the same position
  const croppedImg = new Image();
  croppedImg.onload = () => {
    currentImage = new Image(); 
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    // Draw original image first (optional: you can skip if fully replacing)
    tempCtx.drawImage(currentImage, 0, 0);

    // Draw cropped portion at original location
    tempCtx.drawImage(croppedImg, x, y);

    // Update currentImage
    currentImage.src = tempCanvas.toDataURL();
    currentImage.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(currentImage, 0, 0);
      cropBox = null;
      saveBtn.classList.remove('hidden');
    };
  };
  croppedImg.src = croppedCanvas.toDataURL();
  croppedDataURL = croppedCanvas.toDataURL();
});


// --- Save ---
saveBtn.addEventListener('click', () => {
  if(!croppedDataURL) return;
  const a = document.createElement('a');
  a.href = croppedDataURL;
  a.download = 'cropped-image.png';
  a.click();
});

// --- Escape key: cancel selection ---
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && cropBox) {
    cropBox = null;
    drawScene();
  }
});

// --- Reset button ---
resetBtn.addEventListener('click', () => {
  if (!imageLoaded) return;
  // Restore original image
  currentImage = image;
  cropBox = null;
  canvas.width = image.width;
  canvas.height = image.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(currentImage, 0, 0);
  saveBtn.classList.add('hidden');
});
