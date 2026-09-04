/**
 * ============================================
 * ABOUT.JS — About page interactions
 * ============================================
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 SmartScanner About loaded');

    // Animate sections on scroll
    const sections = document.querySelectorAll('.about-section');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });

    sections.forEach((section, i) => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(30px)';
        section.style.transition = `all 0.6s ease ${i * 0.1}s`;
        observer.observe(section);
    });

    // Add hover effect to tech items
    document.querySelectorAll('.tech-item').forEach(item => {
        item.addEventListener('mouseenter', () => {
            item.style.transform = 'scale(1.05)';
            item.style.transition = 'transform 0.3s ease';
        });
        item.addEventListener('mouseleave', () => {
            item.style.transform = 'scale(1)';
        });
    });
});
