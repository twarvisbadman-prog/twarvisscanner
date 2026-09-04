/**
 * ============================================
 * CAMSCANNER CLONE - Complete App
 * Full-featured document scanner like CamScanner
 * 100% client-side, no uploads
 * ============================================
 */

class DocumentScannerApp {
    constructor() {
        // DOM Elements
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.previewImage = document.getElementById('previewImage');
        this.resultPanel = document.getElementById('resultPanel');
        this.scannerOverlay = document.getElementById('scannerOverlay');
        this.cropOverlay = document.getElementById('cropOverlay');
        this.cropBox = document.getElementById('cropBox');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.toolsRow = document.getElementById('toolsRow');
        this.ocrResult = document.getElementById('ocrResult');
        this.ocrText = document.getElementById('ocrText');
        this.pageIndicator = document.getElementById('pageIndicator');

        // State
        this.stream = null;
        this.scannedImages = [];
        this.currentPage = 0;
        this.currentFilter = 'none';
        this.isProcessing = false;
        this.isCropMode = false;
        this.cropPoints = { x: 0, y: 0, w: 0, h: 0 };

        // OCR State
        this.ocrCache = {};

        // Bind events
        this.bindEvents();
        this.init();

        console.log('📸 Document Scanner Pro initialized');
    }

    /**
     * Initialize
     */
    init() {
        // Auto-start camera on load
        setTimeout(() => this.startCamera(), 500);

        // Check libraries
        console.log('jscanify:', typeof Jscanify !== 'undefined');
        console.log('Tesseract:', typeof Tesseract !== 'undefined');
        console.log('jsPDF:', typeof window.jspdf !== 'undefined');
    }

    /**
     * Bind all events
     */
    bindEvents() {
        // Camera controls
        document.getElementById('captureBtn').addEventListener('click', () => this.captureDocument());
        document.getElementById('flashBtn').addEventListener('click', () => this.toggleFlash());
        document.getElementById('galleryBtn').addEventListener('click', () => this.openGallery());

        // Result controls
        document.getElementById('closeResultBtn').addEventListener('click', () => this.closeResult());
        document.getElementById('retakeBtn').addEventListener('click', () => this.retake());

        // Tool buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => this.applyFilter(btn.dataset.filter));
        });

        // Result tools
        document.getElementById('cropAdjustBtn').addEventListener('click', () => this.toggleCropMode());
        document.getElementById('rotateBtn').addEventListener('click', () => this.rotateImage());
        document.getElementById('ocrBtn').addEventListener('click', () => this.runOCR());

        // Download buttons
        document.querySelectorAll('.download-btn').forEach(btn => {
            btn.addEventListener('click', () => this.download(btn.dataset.format));
        });

        // Page navigation
        document.getElementById('prevPageBtn').addEventListener('click', () => this.prevPage());
        document.getElementById('nextPageBtn').addEventListener('click', () => this.nextPage());

        // Crop drag
        this.initCropHandlers();

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !this.isProcessing) this.captureDocument();
            if (e.key === 'Escape') this.closeResult();
        });
    }

    /**
     * Start camera
     */
    async startCamera() {
        try {
            this.showLoading('Starting camera...');

            const constraints = {
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;

            await this.video.play();

            // Enable controls
            document.getElementById('captureBtn').disabled = false;
            document.getElementById('flashBtn').disabled = false;

            this.hideLoading();
            this.showToast('📷 Camera ready');

        } catch (err) {
            console.error('Camera error:', err);
            this.hideLoading();
            this.showToast('❌ Camera access denied. Please allow camera permissions.', 'error');
        }
    }

    /**
     * Capture document
     */
    captureDocument() {
        if (this.isProcessing) return;

        this.isProcessing = true;
        this.showLoading('Processing document...');

        // Show tools
        this.toolsRow.style.display = 'flex';

        try {
            const width = this.video.videoWidth || 1920;
            const height = this.video.videoHeight || 1080;

            this.canvas.width = width;
            this.canvas.height = height;
            this.ctx.drawImage(this.video, 0, 0, width, height);

            // Try auto-crop with jscanify
            let processedCanvas = null;

            try {
                if (typeof Jscanify !== 'undefined') {
                    const jscanify = new Jscanify();
                    processedCanvas = jscanify.extractPaper(this.canvas, 5);
                }
            } catch (err) {
                console.warn('Auto-crop failed:', err);
            }

            // Fallback to full image
            if (!processedCanvas || processedCanvas.width === 0) {
                processedCanvas = this.canvas;
            }

            // Apply current filter
            processedCanvas = this.applyFilterToCanvas(processedCanvas, this.currentFilter);

            // Store image
            const imageData = processedCanvas.toDataURL('image/png');
            this.scannedImages.push(imageData);
            this.currentPage = this.scannedImages.length - 1;

            // Show result
            this.showResult();

            // Hide scanner overlay
            this.scannerOverlay.style.display = 'none';

            this.hideLoading();
            this.isProcessing = false;

            this.showToast('✅ Document scanned!');

        } catch (err) {
            console.error('Capture error:', err);
            this.hideLoading();
            this.isProcessing = false;
            this.showToast('❌ Scan failed: ' + err.message, 'error');
        }
    }

    /**
     * Show result panel
     */
    showResult() {
        this.previewImage.src = this.scannedImages[this.currentPage];
        this.resultPanel.classList.add('open');
        this.updatePageIndicator();

        // Reset OCR
        this.ocrResult.style.display = 'none';
        this.ocrText.textContent = '';
    }

    /**
     * Close result panel
     */
    closeResult() {
        this.resultPanel.classList.remove('open');
        this.scannerOverlay.style.display = 'flex';
        this.cropOverlay.style.display = 'none';
        this.isCropMode = false;
    }

    /**
     * Retake (clear current and start over)
     */
    retake() {
        if (this.scannedImages.length === 0) {
            this.closeResult();
            return;
        }

        // Remove current page
        this.scannedImages.splice(this.currentPage, 1);
        if (this.scannedImages.length === 0) {
            this.closeResult();
            this.showToast('🔄 No pages left. Scan again.');
            return;
        }

        this.currentPage = Math.min(this.currentPage, this.scannedImages.length - 1);
        this.showResult();
        this.showToast('🗑️ Page removed');
    }

    /**
     * Navigate pages
     */
    prevPage() {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.previewImage.src = this.scannedImages[this.currentPage];
            this.updatePageIndicator();
            this.ocrResult.style.display = 'none';
        }
    }

    nextPage() {
        if (this.currentPage < this.scannedImages.length - 1) {
            this.currentPage++;
            this.previewImage.src = this.scannedImages[this.currentPage];
            this.updatePageIndicator();
            this.ocrResult.style.display = 'none';
        }
    }

    updatePageIndicator() {
        document.getElementById('currentPage').textContent = this.currentPage + 1;
        document.getElementById('totalPages').textContent = this.scannedImages.length;
        this.pageIndicator.style.display = this.scannedImages.length > 1 ? 'flex' : 'none';
    }

    /**
     * Apply filter to image
     */
    applyFilter(filter) {
        this.currentFilter = filter;

        // Update UI
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        // Re-apply to current image
        if (this.scannedImages.length > 0) {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                const processed = this.applyFilterToCanvas(canvas, filter);
                this.scannedImages[this.currentPage] = processed.toDataURL('image/png');
                this.previewImage.src = this.scannedImages[this.currentPage];
            };
            img.src = this.scannedImages[this.currentPage];
        }
    }

    /**
     * Apply filter to canvas
     */
    applyFilterToCanvas(canvas, filter) {
        if (filter === 'none') return canvas;

        const result = document.createElement('canvas');
        result.width = canvas.width;
        result.height = canvas.height;
        const ctx = result.getContext('2d');

        ctx.drawImage(canvas, 0, 0);

        try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            switch (filter) {
                case 'grayscale':
                    for (let i = 0; i < data.length; i += 4) {
                        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                        data[i] = data[i + 1] = data[i + 2] = gray;
                    }
                    break;

                case 'enhance':
                    for (let i = 0; i < data.length; i += 4) {
                        data[i] = Math.min(255, data[i] * 1.1 + 10);
                        data[i + 1] = Math.min(255, data[i + 1] * 1.1 + 10);
                        data[i + 2] = Math.min(255, data[i + 2] * 1.1 + 10);
                    }
                    break;

                case 'bright':
                    for (let i = 0; i < data.length; i += 4) {
                        data[i] = Math.min(255, data[i] + 30);
                        data[i + 1] = Math.min(255, data[i + 1] + 30);
                        data[i + 2] = Math.min(
