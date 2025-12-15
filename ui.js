class UIManager {
    constructor() {
        this.currentDayIndex = 0;
        this.currentPlan = null;
        this.initializeTheme();
    }

    // Initialize theme from localStorage or system preference
    initializeTheme() {
        const savedTheme = localStorage.getItem('theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (savedTheme) {
            this.setTheme(savedTheme);
        } else if (systemPrefersDark) {
            this.setTheme('dark');
        }
    }

    // Set theme
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        
        // Update icon
        const icon = document.querySelector('#themeToggle i');
        if (icon) {
            icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    // Toggle theme
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    // Display timetable
    displayTimetable(slots, dayIndex = 0) {
        const container = document.getElementById('timetableSlots');
        container.innerHTML = '';
        
        if (!slots || slots.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-plus"></i>
                    <h3>No Schedule Generated</h3>
                    <p>Click "Generate Smart Plan" to create your personalized study schedule</p>
                </div>
            `;
            return;
        }
        
        slots.forEach(slot => {
            const slotElement = document.createElement('div');
            slotElement.className = `time-slot ${slot.type === 'break' ? 'break-slot' : ''} ${slot.type === 'revision' ? 'revision-slot' : ''}`;
            
            const priorityBadge = slot.priority ? 
                `<span class="priority-badge priority-${slot.priority.toLowerCase()}">${slot.priority}</span>` : '';
            
            const typeBadge = slot.type ? 
                `<span class="type-badge type-${slot.type}">${slot.type.charAt(0).toUpperCase() + slot.type.slice(1)}</span>` : '';
            
            const statusClass = slot.completed ? 'status-complete' : 'status-pending';
            const statusText = slot.completed ? 'Complete' : 'Pending';
            
            const actionButton = slot.type === 'study' || slot.type === 'revision' ?
                `<button class="btn-icon btn-complete" data-session-id="${slot.id}" title="${slot.completed ? 'Mark as pending' : 'Mark as complete'}">
                    <i class="fas ${slot.completed ? 'fa-undo' : 'fa-check'}"></i>
                </button>` : '';
            
            slotElement.innerHTML = `
                <div class="time-col">${slot.startTime}</div>
                <div class="subject-col">${slot.subjectName}</div>
                <div class="priority-col">${priorityBadge}</div>
                <div class="type-col">${typeBadge}</div>
                <div class="status-col ${statusClass}">${statusText}</div>
                <div class="action-col">${actionButton}</div>
            `;
            
            container.appendChild(slotElement);
        });
    }

    // Display progress bars
    displayProgressBars(allocations) {
        const container = document.getElementById('progressBars');
        container.innerHTML = '';
        
        if (!allocations || allocations.length === 0) return;
        
        allocations.forEach(subject => {
            const progress = (subject.hoursCompleted || 0) / subject.hoursNeeded * 100;
            const progressItem = document.createElement('div');
            progressItem.className = 'progress-item';
            progressItem.innerHTML = `
                <div class="progress-header">
                    <span>${subject.name}</span>
                    <span>${subject.hoursCompleted || 0}/${subject.hoursNeeded} hours</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${Math.min(100, progress)}%"></div>
                </div>
            `;
            container.appendChild(progressItem);
        });
    }

    // Display suggestions
    displaySuggestions(suggestions) {
        const container = document.getElementById('suggestionsList');
        container.innerHTML = '';
        
        if (!suggestions || suggestions.length === 0) {
            container.innerHTML = '<p class="suggestion">✅ Your schedule looks optimal! No suggestions at this time.</p>';
            return;
        }
        
        suggestions.forEach(suggestion => {
            const suggestionEl = document.createElement('p');
            suggestionEl.className = `suggestion suggestion-${suggestion.type}`;
            
            let icon = '💡';
            switch(suggestion.type) {
                case 'warning': icon = '⚠️'; break;
                case 'important': icon = '🚨'; break;
                case 'tip': icon = '💡'; break;
                case 'info': icon = 'ℹ️'; break;
            }
            
            suggestionEl.innerHTML = `
                <strong>${icon} ${suggestion.type.toUpperCase()}:</strong> ${suggestion.message}
            `;
            container.appendChild(suggestionEl);
        });
    }

    // Update day navigation
    updateDayNavigation(totalDays, currentDay = 0) {
        this.currentDayIndex = currentDay;
        const prevBtn = document.getElementById('prevDayBtn');
        const nextBtn = document.getElementById('nextDayBtn');
        const dayCounter = document.getElementById('dayCounter');
        
        prevBtn.disabled = currentDay === 0;
        nextBtn.disabled = currentDay === totalDays - 1;
        
        dayCounter.textContent = `Day ${currentDay + 1}/${totalDays}`;
        
        // Update date display
        if (this.currentPlan && this.currentPlan.schedule[currentDay]) {
            const daySchedule = this.currentPlan.schedule[currentDay];
            document.getElementById('currentDate').textContent = `Day ${currentDay + 1}: ${daySchedule.date}`;
        }
    }

    // Update efficiency score display
    updateEfficiencyScore(score) {
        const scoreElement = document.getElementById('efficiencyScore');
        if (scoreElement) {
            scoreElement.textContent = `${score}%`;
            
            // Color code based on score
            if (score >= 80) {
                scoreElement.style.background = 'linear-gradient(135deg, #2ecc71, #27ae60)';
            } else if (score >= 60) {
                scoreElement.style.background = 'linear-gradient(135deg, #f39c12, #e67e22)';
            } else {
                scoreElement.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
            }
        }
    }

    // Show loading state
    showLoading(buttonId, text = 'Loading...') {
        const button = document.getElementById(buttonId);
        if (!button) return;
        
        const originalHTML = button.innerHTML;
        button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${text}`;
        button.disabled = true;
        
        return originalHTML;
    }

    // Hide loading state
    hideLoading(buttonId, originalHTML) {
        const button = document.getElementById(buttonId);
        if (!button) return;
        
        button.innerHTML = originalHTML;
        button.disabled = false;
    }

    // Show modal
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
        }
    }

    // Hide modal
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
        }
    }

    // Show notification
    showNotification(message, type = 'info', duration = 3000) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="btn-icon btn-close-notification">&times;</button>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            max-width: 400px;
        `;
        
        // Add to body
        document.body.appendChild(notification);
        
        // Add close button listener
        notification.querySelector('.btn-close-notification').addEventListener('click', () => {
            notification.remove();
        });
        
        // Auto remove after duration
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, duration);
        
        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            .notification-info { border-left: 4px solid #3498db; }
            .notification-success { border-left: 4px solid #2ecc71; }
            .notification-warning { border-left: 4px solid #f39c12; }
            .notification-error { border-left: 4px solid #e74c3c; }
        `;
        document.head.appendChild(style);
    }

    // Get notification icon
    getNotificationIcon(type) {
        switch(type) {
            case 'success': return 'fa-check-circle';
            case 'warning': return 'fa-exclamation-triangle';
            case 'error': return 'fa-times-circle';
            default: return 'fa-info-circle';
        }
    }

    // Update dashboard stats
    updateDashboardStats(stats) {
        if (stats.totalDays) {
            document.getElementById('totalDays').textContent = stats.totalDays;
        }
        if (stats.totalSubjects) {
            document.getElementById('totalSubjects').textContent = stats.totalSubjects;
        }
        if (stats.totalHours) {
            document.getElementById('totalHours').textContent = stats.totalHours;
        }
        if (stats.completionRate !== undefined) {
            document.getElementById('completionRate').textContent = `${stats.completionRate}%`;
        }
    }

    // Export preview
    showExportPreview(content, format) {
        const preview = document.getElementById('exportPreview');
        if (preview) {
            preview.textContent = content;
        }
    }

    // Copy to clipboard
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showNotification('Copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Failed to copy: ', err);
            this.showNotification('Failed to copy to clipboard', 'error');
        });
    }

    // Download file
    downloadFile(content, filename, type = 'text/plain') {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Create and export singleton instance
const uiManager = new UIManager();
export default uiManager;