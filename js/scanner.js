/**
 * ============================================
 * SCANNER.JS — Main Document Scanner Logic
 * 100% Client-Side, No Uploads
 * ============================================
 */

class DocumentScanner {
    constructor() {
        // DOM Elements
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.preview = document.getElementById('preview');
        this.result = document.getElementById('result');
        this.status = document.getElementById('status');
        this.stats = document.getElementById('stats');
        this.textDisplay = document.getElementById('textDisplay');
        this.extractedText = document.getElementById('extractedText');
        this.cameraPlaceholder = document.getElementById('cameraPlaceholder');

        // State
        this.stream = null;
        this.scannedImage = null;
        this.extractedTextContent = '';

        // Bind events
        this.bindEvents();
    }

    /**
     * Bind all button events
     */
    bindEvents() {
        document.getElementById('startCamera').addEventListener('click', () => this.startCamera());
        document.getElementById('capture').addEventListener('click', () => this.captureDocument());
        document.getElementById('reset').addEventListener('click', () => this.reset());
        document.getElementById('downloadPNG').addEventListener('click', () => this.download('png'));
        document.getElementById('downloadJPEG').addEventListener('click', () => this.download('jpeg'));
        document.getElementById('downloadPDF').addEventListener('click', () => this.downloadPDF());
        document.getElementById('downloadText').addEventListener('click', () => this.downloadText());
    }

    /**
     * Show status message
     */
    showStatus(message, type = 'info') {
        this.status.style.display = 'block';
        this.status.textContent = message;
        this.status.className = 'status-message';
        if (type === 'error') this.status.classList.add('error');
        if (type === 'success') this.status.classList.add('success');
    }

    /**
     * Hide status message
     */
    hideStatus() {
        this.status.style.display = 'none';
    }

    /**
     * Start the camera
     */
    async startCamera() {
        try {
            this.showStatus('📷 Requesting camera access...');

            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });

            this.video.srcObject = this.stream;
            await this.video.play();

            // Hide placeholder
            if (this.cameraPlaceholder) {
                this.cameraPlaceholder.style.display = 'none';
            }

            document.getElementById('startCamera').disabled = true;
            document.getElementById('capture').disabled = false;

            this.showStatus('✅ Camera ready! Position document and click "Scan Document"', 'success');

        } catch (err) {
            console.error('Camera error:', err);
            this.showStatus(
                '❌ Camera access denied. Please allow camera permissions and try again.',
                'error'
            );
        }
    }

    /**
     * Capture and process document
     */
    captureDocument() {
        try {
            this.showStatus('📸 Capturing document...');

            // Set canvas to video size
            const width = this.video.videoWidth || 1280;
            const height = this.video.videoHeight || 720;
            this.canvas.width = width;
            this.canvas.height = height;

            // Draw video frame
            this.ctx.drawImage(this.video, 0, 0);

            // Auto-crop using jscanify
            this.showStatus('✂️ Detecting document edges...');
            const jscanify = new Jscanify();

            try {
                const croppedCanvas = jscanify.extractPaper(this.canvas, 5);

                // Enhance image
                this.showStatus('✨ Enhancing image quality...');
                this.scannedImage = this.enhanceImage(croppedCanvas);

                // Show preview
                this.preview.src = this.scannedImage.toDataURL('image/png');
                this.result.style.display = 'block';
                document.getElementById('capture').disabled = true;

                // Run OCR
                this.performOCR(this.scannedImage);

                this.showStatus('✅ Document scanned successfully!', 'success');

            } catch (cropError) {
                // If auto-crop fails, use the full image
                console.warn('Auto-crop failed, using full frame:', cropError);
                this.scannedImage = this.enhanceImage(this.canvas);
                this.preview.src = this.scannedImage.toDataURL('image/png');
                this.result.style.display = 'block';
                document.getElementById('capture').disabled = true;
                this.performOCR(this.scannedImage);
                this.showStatus('⚠️ Auto-crop failed. Using full image. Try positioning better.', 'error');
            }

        } catch (err) {
            console.error('Capture error:', err);
            this.showStatus('❌ Failed to scan. Please try again.', 'error');
        }
    }

    /**
     * Enhance image quality
     */
    enhanceImage(sourceCanvas) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = sourceCanvas.width;
        tempCanvas.height = sourceCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        tempCtx.drawImage(sourceCanvas, 0, 0);

        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;

        // Apply contrast and brightness
        const contrast = 1.2;
        const brightness = 10;

        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrast + 128 + brightness));
            data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * contrast + 128 + brightness));
            data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * contrast + 128 + brightness));
        }

        tempCtx.putImageData(imageData, 0, 0);
        return tempCanvas;
    }

    /**
     * Perform OCR on the scanned image
     */
    async performOCR(canvas) {
        try {
            this.showStatus('🔍 Running OCR... (may take a few seconds)');

            const dataUrl = canvas.toDataURL('image/png');

            const result = await Tesseract.recognize(dataUrl, 'eng', {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        this.showStatus(`🔍 OCR: ${Math.round(m.progress * 100)}%`);
                    }
                }
            });

            this.extractedTextContent = result.data.text.trim();

            // Display extracted text
            if (this.extractedTextContent) {
                this.textDisplay.style.display = 'block';
                this.extractedText.textContent = this.extractedTextContent;
            }

            // Update stats
            this.updateStats(canvas, result);

            this.showStatus('✅ OCR complete! Text extracted successfully.', 'success');

        } catch (err) {
            console.error('OCR error:', err);
            this.showStatus('⚠️ OCR failed. You can still download the image.', 'error');
        }
    }

    /**
     * Update statistics
     */
    updateStats(canvas, ocrResult) {
        const wordCount = this.extractedTextContent ? 
            this.extractedTextContent.split(/\s+/).filter(w => w.length > 0).length : 0;

        let html = '<p><strong>📊 Document Statistics:</strong></p>';
        html += `<p>• Resolution: ${canvas.width} × ${canvas.height} pixels</p>`;
        html += `<p>• Format: PNG (Enhanced)</p>`;

        if (ocrResult && ocrResult.data) {
            html += `<p>• OCR Confidence: ${Math.round(ocrResult.data.confidence)}%</p>`;
            html += `<p>• Words Detected: ${wordCount}</p>`;
            html += `<p>• Characters: ${this.extractedTextContent.length}</p>`;
        }

        this.stats.innerHTML = html;
    }

    /**
     * Download as PNG or JPEG
     */
    download(format) {
        if (!this.scannedImage) return;

        const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
        const extension = format === 'png' ? 'png' : 'jpg';
        const quality = format === 'png' ? undefined : 0.92;

        const link = document.createElement('a');
        link.download = `scanned_document_${Date.now()}.${extension}`;
        link.href = this.scannedImage.toDataURL(mimeType, quality);
        link.click();

        this.showStatus(`💾 Downloaded as ${format.toUpperCase()}!`, 'success');
    }

    /**
     * Download as PDF
     */
    downloadPDF() {
        if (!this.scannedImage) return;

        const { jsPDF } = window.jspdf;
        const imgData = this.scannedImage.toDataURL('image/jpeg', 0.9);

        const pdf = new jsPDF({
            orientation: this.scannedImage.width > this.scannedImage.height ? 'landscape' : 'portrait',
            unit: 'px',
            format: [this.scannedImage.width, this.scannedImage.height]
        });

        pdf.addImage(imgData, 'JPEG', 0, 0, this.scannedImage.width, this.scannedImage.height);
        pdf.save(`scanned_document_${Date.now()}.pdf`);

        this.showStatus('💾 Downloaded as PDF!', 'success');
    }

    /**
     * Download as text file
     */
    downloadText() {
        if (!this.extractedTextContent) {
            this.showStatus('⚠️ No text extracted. Scan with OCR first.', 'error');
            return;
        }

        const blob = new Blob([this.extractedTextContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `extracted_text_${Date.now()}.txt`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);

        this.showStatus('💾 Downloaded as text file!', 'success');
    }

    /**
     * Reset everything
     */
    reset() {
        // Stop camera
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        // Reset UI
        this.video.srcObject = null;
        this.scannedImage = null;
        this.extractedTextContent = '';
        this.result.style.display = 'none';
        this.textDisplay.style.display = 'none';
        this.extractedText.textContent = '';

        if (this.cameraPlaceholder) {
            this.cameraPlaceholder.style.display = 'flex';
        }

        document.getElementById('startCamera').disabled = false;
        document.getElementById('capture').disabled = true;
        document.getElementById('preview').src = '';
        this.stats.innerHTML = '<p>📊 Document statistics will appear here after scanning.</p>';
        this.hideStatus();
        this.showStatus('🔄 Reset complete. Start camera to scan again.', 'info');
    }
}

// ============================================
// Initialize when DOM is ready
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const scanner = new DocumentScanner();
    console.log('📄 SmartScanner initialized (100% local)');
});
