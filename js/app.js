/**
 * ============================================
 * CUTE SCANNER - Complete App
 * Full-featured document scanner
 * 100% client-side
 * ============================================
 */

class CuteScanner {
    constructor() {
        // DOM
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.preview = document.getElementById('previewImage');
        this.resultPanel = document.getElementById('resultPanel');
        this.statusToast = document.getElementById('statusToast');
        this.scanFrame = document.getElementById('scanFrame');
        this.scanLoading = document.getElementById('scanLoading');
        this.pageCounter = document.getElementById('pageCounter');
        
        // State
        this.stream = null;
        this.pages = [];
        this.currentPageIndex = 0;
        this.currentFilter = 'original';
        this.isProcessing = false;
        this.brightness = 100;
        this.contrast = 100;
        this.scannedPages = [];

        // Bind events
        this.bindEvents();
        
        // Auto-start
        setTimeout(() => this.startCamera(), 500);
        
        console.log('📸 CuteScanner ready! 💖');
    }

    bindEvents() {
        document.getElementById('captureBtn').addEventListener('click', () => this.capture());
        document.getElementById('flashBtn').addEventListener('click', () => this.toggleFlash());
        document.getElementById('galleryBtn').addEventListener('click', () => this.openGallery());
        document.getElementById('closeResultBtn').addEventListener('click', () => this.closeResult());
        document.getElementById('prevPageBtn').addEventListener('click', () => this.prevPage());
        document.getElementById('nextPageBtn').addEventListener('click', () => this.nextPage());
        document.getElementById('continueBtn').addEventListener('click', () => this.continueScanning());
        document.getElementById('doneBtn').addEventListener('click', () => this.makePDF());
        document.getElementById('editBtn').addEventListener('click', () => this.toggleEdit());
        document.getElementById('cropBtn').addEventListener('click', () => this.manualCrop());
        document.getElementById('rotateBtn').addEventListener('click', () => this.rotatePage());
        document.getElementById('deleteBtn').addEventListener('click', () => this.deletePage());

        // Filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                this.applyFilter();
            });
        });

        // Sliders
        document.getElementById('brightnessSlider').addEventListener('input', (e) => {
            this.brightness = parseInt(e.target.value);
            this.applyFilter();
        });
        document.getElementById('contrastSlider').addEventListener('input', (e) => {
            this.contrast = parseInt(e.target.value);
            this.applyFilter();
        });

        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !this.isProcessing) this.capture();
            if (e.key === 'Escape') this.closeResult();
            if (e.key === 'ArrowLeft') this.prevPage();
            if (e.key === 'ArrowRight') this.nextPage();
        });
    }

    // ============================================
    // CAMERA
    // ============================================
    async startCamera() {
        try {
            this.showToast('📷 Starting camera...');
            
            const constraints = {
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            await this.video.play();

            document.getElementById('captureBtn').disabled = false;
            document.getElementById('flashBtn').disabled = false;
            
            this.showToast('✅ Camera ready! 📸');
            this.hideToastAfter(1500);

        } catch (err) {
            console.error('Camera error:', err);
            this.showToast('❌ Camera access denied. Please allow camera permissions.', 'error');
            this.showUploadFallback();
        }
    }

    showUploadFallback() {
        // Show upload option if camera fails
        const wrapper = document.querySelector('.camera-wrapper');
        if (!wrapper) return;
        
        const fallbackHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:40px;background:linear-gradient(135deg, #fff5f7, #fce4ec);color:#1a1a2e;text-align:center;">
                <span style="font-size:48px;margin-bottom:16px;">📷</span>
                <h3 style="margin-bottom:8px;">Camera Unavailable</h3>
                <p style="color:#64748b;margin-bottom:20px;">Upload an image from your gallery instead</p>
                <input type="file" id="uploadFallback" accept="image/*" style="display:none;" />
                <button onclick="document.getElementById('uploadFallback').click()" class="btn-cute btn-primary" style="cursor:pointer;padding:12px 32px;border:none;border-radius:12px;font-size:16px;font-weight:700;background:linear-gradient(135deg,#ff6b9d,#a78bfa);color:#fff;">
                    📁 Choose Image
                </button>
            </div>
        `;
        wrapper.innerHTML = fallbackHTML;

        document.getElementById('uploadFallback').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    this.canvas.width = img.width;
                    this.canvas.height = img.height;
                    this.ctx.drawImage(img, 0, 0);
                    this.addPage(this.canvas);
                    this.showToast('✅ Image loaded!');
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // ============================================
    // CAPTURE
    // ============================================
    capture() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        this.scanLoading.style.display = 'flex';

        try {
            const width = this.video.videoWidth || 1280;
            const height = this.video.videoHeight || 720;

            this.canvas.width = width;
            this.canvas.height = height;
            this.ctx.drawImage(this.video, 0, 0, width, height);

            // Auto-crop - only what's inside the frame
            let cropped = null;
            try {
                if (typeof Jscanify !== 'undefined') {
                    const jscanify = new Jscanify();
                    cropped = jscanify.extractPaper(this.canvas, 5);
                }
            } catch (err) {
                console.warn('Auto-crop failed:', err);
            }

            // If crop fails, use full image but with a smaller crop
            if (!cropped || cropped.width === 0) {
                // Crop to center (frame area)
                const cropSize = Math.min(width, height) * 0.75;
                const x = (width - cropSize) / 2;
                const y = (height - cropSize) / 2;
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = cropSize;
                tempCanvas.height = cropSize * 1.3;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(this.canvas, x, y, cropSize, cropSize * 1.3, 0, 0, cropSize, cropSize * 1.3);
                cropped = tempCanvas;
                this.showToast('⚠️ Using manual crop', 'warning');
            }

            // Apply current filter
            cropped = this.applyFilterToCanvas(cropped);

            // Add page
            this.addPage(cropped);

            this.scanLoading.style.display = 'none';
            this.isProcessing = false;
            this.showToast('✅ Page scanned! 💖');

        } catch (err) {
            console.error('Capture error:', err);
            this.scanLoading.style.display = 'none';
            this.isProcessing = false;
            this.showToast('❌ Scan failed: ' + err.message, 'error');
        }
    }

    // ============================================
    // PAGE MANAGEMENT
    // ============================================
    addPage(canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        this.pages.push(dataUrl);
        this.currentPageIndex = this.pages.length - 1;
        this.updateUI();
        this.showResult();
        this.updatePageCounter();
    }

    updateUI() {
        if (this.pages.length > 0) {
            this.preview.src = this.pages[this.currentPageIndex];
            document.getElementById('currentPageNum').textContent = this.currentPageIndex + 1;
        }
    }

    updatePageCounter() {
        this.pageCounter.textContent = `${this.pages.length} pages`;
    }

    showResult() {
        this.resultPanel.classList.add('open');
        this.updateUI();
    }

    closeResult() {
        this.resultPanel.classList.remove('open');
        document.getElementById('editTools').style.display = 'none';
    }

    prevPage() {
        if (this.currentPageIndex > 0) {
            this.currentPageIndex--;
            this.updateUI();
        }
    }

    nextPage() {
        if (this.currentPageIndex < this.pages.length - 1) {
            this.currentPageIndex++;
            this.updateUI();
        }
    }

    deletePage() {
        if (this.pages.length === 0) return;
        this.pages.splice(this.currentPageIndex, 1);
        if (this.pages.length === 0) {
            this.closeResult();
            this.showToast('No pages left. Scan again.');
            return;
        }
        this.currentPageIndex = Math.min(this.currentPageIndex, this.pages.length - 1);
        this.updateUI();
        this.updatePageCounter();
        this.showToast('🗑️ Page deleted');
    }

    // ============================================
    // CONTINUE / DONE
    // ============================================
    continueScanning() {
        this.closeResult();
        this.showToast('📸 Scan next page!');
        // Keep camera running
    }

    makePDF() {
        if (this.pages.length === 0) {
            this.showToast('❌ No pages to make PDF', 'error');
            return;
        }

        if (typeof window.jspdf === 'undefined') {
            this.showToast('❌ PDF library not loaded', 'error');
            return;
        }

        this.showToast('📄 Creating PDF...');

        const { jsPDF } = window.jspdf;
        const name = document.getElementById('pdfNameInput').value.trim() || 'tarvis';
        
        // Create PDF
        const pdf = new jsPDF();

        this.pages.forEach((dataUrl, index) => {
            if (index > 0) pdf.addPage();
            
            const img = new Image();
            img.src = dataUrl;
            
            // Use async loading
            const imgWidth = pdf.internal.pageSize.width;
            const imgHeight = pdf.internal.pageSize.height;
            
            pdf.addImage(dataUrl, 'PNG', 0, 0, imgWidth, imgHeight);
        });

        // Save
        pdf.save(`${name}.pdf`);
        this.showToast(`💾 Saved as ${name}.pdf! 🎉`);
        this.closeResult();
        
        // Reset for next batch
        this.pages = [];
        this.currentPageIndex = 0;
        this.updatePageCounter();
    }

    // ============================================
    // FILTERS & EDITING
    // ============================================
    toggleEdit() {
        const tools = document.getElementById('editTools');
        tools.style.display = tools.style.display === 'none' ? 'block' : 'none';
        if (tools.style.display === 'block') {
            this.showToast('✏️ Edit mode - adjust sliders and filters');
        }
    }

    applyFilter() {
        if (this.pages.length === 0) return;
        
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            const filtered = this.applyFilterToCanvas(canvas);
            this.pages[this.currentPageIndex] = filtered.toDataURL('image/png');
            this.preview.src = this.pages[this.currentPageIndex];
        };
        img.src = this.pages[this.currentPageIndex];
    }

    applyFilterToCanvas(canvas) {
        const result = document.createElement('canvas');
        result.width = canvas.width;
        result.height = canvas.height;
        const ctx = result.getContext('2d');
        
        ctx.drawImage(canvas, 0, 0);
        
        try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // Brightness
            const bright = this.brightness / 100;
            const contrast = this.contrast / 100;
            
            for (let i = 0; i < data.length; i += 4) {
                let r = data[i];
                let g = data[i + 1];
                let b = data[i + 2];
                
                // Apply filter
                switch (this.currentFilter) {
                    case 'grayscale':
                        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                        r = g = b = gray;
                        break;
                    case 'enhance':
                        r = Math.min(255, r * 1.1 + 5);
                        g = Math.min(255, g * 1.1 + 5);
                        b = Math.min(255, b * 1.1 + 5);
                        break;
                    case 'bright':
                        r = Math.min(255, r + 30);
                        g = Math.min(255, g + 30);
                        b = Math.min(255, b + 30);
                        break;
                    case 'contrast':
                        r = Math.min(255, Math.max(0, (r - 128) * 1.5 + 128));
                        g = Math.min(255, Math.max(0, (g - 128) * 1.5 + 128));
                        b = Math.min(255, Math.max(0, (b - 128) * 1.5 + 128));
                        break;
                    case 'vintage':
                        r = Math.min(255, r * 1.1 + 10);
                        g = Math.min(255, g * 0.9 + 5);
                        b = Math.min(255, b * 0.8 + 5);
                        break;
                    default: // original
                        break;
                }
                
                // Apply brightness and contrast
                r = Math.min(255, Math.max(0, (r - 128) * contrast + 128 + (bright - 1) * 50));
                g = Math.min(255, Math.max(0, (g - 128) * contrast + 128 + (bright - 1) * 50));
                b = Math.min(255, Math.max(0, (b - 128) * contrast + 128 + (bright - 1) * 50));
                
                data[i] = r;
                data[i + 1] = g;
                data[i + 2] = b;
            }
            
            ctx.putImageData(imageData, 0, 0);
        } catch (err) {
            console.warn('Filter failed:', err);
        }
        
        return result;
    }

    manualCrop() {
        this.showToast('✂️ Drag to adjust crop (coming soon)');
        // Full manual crop with drag handles would go here
    }

    rotatePage() {
        if (this.pages.length === 0) return;
        
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.height;
            canvas.height = img.width;
            const ctx = canvas.getContext('2d');
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(Math.PI / 2);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);
            
            this.pages[this.currentPageIndex] = canvas.toDataURL('image/png');
            this.preview.src = this.pages[this.currentPageIndex];
            this.showToast('🔄 Rotated 90°');
        };
        img.src = this.pages[this.currentPageIndex];
    }

    // ============================================
    // FLASH
    // ============================================
    toggleFlash() {
        if (!this.stream) return;
        const track = this.stream.getVideoTracks()[0];
        if (!track) return;
        
        try {
            const settings = track.getSettings();
            track.applyConstraints({
                advanced: [{ torch: !settings.torch }]
            }).then(() => {
                this.showToast(settings.torch ? '💡 Flash off' : '💡 Flash on');
            });
        } catch (err) {
            this.showToast('💡 Flash not supported', 'error');
        }
    }

    // ============================================
    // GALLERY / UPLOAD
    // ============================================
    openGallery() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.onchange = (e) => {
            const files = Array.from(e.target.files);
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        this.addPage(canvas);
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            });
            this.showToast(`📸 Added ${files.length} images`);
        };
        input.click();
    }

    // ============================================
    // OCR
    // ============================================
    async runOCR() {
        if (this.pages.length === 0) {
            this.showToast('No page to analyze', 'error');
            return;
        }
        
        try {
            if (typeof Tesseract === 'undefined') {
                this.showToast('OCR not available', 'error');
                return;
            }
            
            this.showToast('🔍 Running OCR...');
            const dataUrl = this.pages[this.currentPageIndex];
            const result = await Tesseract.recognize(dataUrl, 'eng');
            
            const ocrBox = document.getElementById('ocrBox');
            const ocrText = document.getElementById('ocrText');
            ocrText.textContent = result.data.text.trim() || 'No text detected';
            ocrBox.style.display = 'block';
            this.showToast('✅ OCR complete!');
            
        } catch (err) {
            console.error('OCR error:', err);
            this.showToast('OCR failed', 'error');
        }
    }

    // ============================================
    // UTILITIES
    // ============================================
    showToast(message, type = 'info') {
        const toast = this.statusToast;
        toast.textContent = message;
        toast.style.display = 'block';
        toast.style.background = type === 'error' ? '#dc2626' : 
                                  type === 'warning' ? '#f59e0b' : 
                                  'rgba(0,0,0,0.8)';
        clearTimeout(toast._timeout);
    }

    hideToastAfter(ms = 3000) {
        clearTimeout(this.statusToast._timeout);
        this.statusToast._timeout = setTimeout(() => {
            this.statusToast.style.display = 'none';
        }, ms);
    }
}

// ============================================
// PDF MAKER PAGE
// ============================================
class PDFMaker {
    constructor() {
        this.images = [];
        this.init();
    }

    init() {
        const input = document.getElementById('fileInput');
        if (!input) return;
        
        input.addEventListener('change', (e) => this.handleFiles(e));
        
        document.getElementById('makePdfBtn')?.addEventListener('click', () => this.makePDF());
        document.getElementById('clearImagesBtn')?.addEventListener('click', () => this.clearAll());
        
        // Drag and drop
        const zone = document.getElementById('uploadZone');
        if (zone) {
            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                zone.style.borderColor = '#ff6b9d';
            });
            zone.addEventListener('dragleave', () => {
                zone.style.borderColor = '#ffb3c6';
            });
            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.style.borderColor = '#ffb3c6';
                this.handleFiles(e);
            });
        }
    }

    handleFiles(e) {
        const files = e.target.files || e.dataTransfer?.files;
        if (!files) return;
        
        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    this.images.push(canvas.toDataURL('image/png'));
                    this.render();
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    render() {
        const grid = document.getElementById('previewGrid');
        const controls = document.getElementById('pdfControls');
        
        if (this.images.length === 0) {
            grid.innerHTML = '';
            controls.style.display = 'none';
            return;
        }
        
        controls.style.display = 'block';
        grid.innerHTML = this.images.map((dataUrl, i) => `
            <div class="preview-item">
                <img src="${dataUrl}" alt="Page ${i + 1}" />
                <button class="remove-item" onclick="window.pdfMaker.removeImage(${i})">✕</button>
            </div>
        `).join('');
    }

    removeImage(index) {
        this.images.splice(index, 1);
        this.render();
    }

    clearAll() {
        this.images = [];
        this.render();
        document.getElementById('fileInput').value = '';
    }

    makePDF() {
        if (this.images.length === 0) {
            alert('Please add some images first!');
            return;
        }
        
        if (typeof window.jspdf === 'undefined') {
            alert('PDF library not loaded');
            return;
        }
        
        const name = document.getElementById('pdfNameInput2').value.trim() || 'tarvis';
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        
        this.images.forEach((dataUrl, index) => {
            if (index > 0) pdf.addPage();
            pdf.addImage(dataUrl, 'PNG', 0, 0, pdf.internal.pageSize.width, pdf.internal.pageSize.height);
        });
        
        pdf.save(`${name}.pdf`);
        alert(`✅ PDF saved as ${name}.pdf!`);
        this.clearAll();
    }
}

// ============================================
// INITIALIZE
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Check which page we're on
    if (document.querySelector('.scanner-page')) {
        window.app = new CuteScanner();
    }
    
    if (document.querySelector('.pdf-maker-page')) {
        window.pdfMaker = new PDFMaker();
    }
    
    console.log('💖 CuteScanner loaded!');
});
