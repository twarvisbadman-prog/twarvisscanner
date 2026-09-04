/**
 * ============================================
 * HOME.JS — Home page interactions
 * ============================================
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 SmartScanner Home loaded');

    // Animate feature cards on scroll
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.feature-card').forEach((card, i) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = `opacity 0.5s ease ${i * 0.1}s, transform 0.5s ease ${i * 0.1}s`;
        observer.observe(card);
    });

    // Quick start step animation
    document.querySelectorAll('.steps li').forEach((step, i) => {
        step.style.opacity = '0';
        step.style.transform = 'translateX(-20px)';
        step.style.transition = `all 0.4s ease ${i * 0.1}s`;

        setTimeout(() => {
            step.style.opacity = '1';
            step.style.transform = 'translateX(0)';
        }, 300 + i * 100);
    });
});
