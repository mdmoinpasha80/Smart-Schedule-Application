
// import CONFIG from './config.js';
import inputManager from './input.js';
import rulesEngine from './rules.js';
import scheduler from './scheduler.js';
import storageManager from './storage.js';
import uiManager from './ui.js';

// Global state
let currentPlan = null;
let currentDayIndex = 0;

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    console.log('Smart Study Planner Initialized');
    
    // Initialize UI
    initializeUI();
    
    // Load saved plan
    loadSavedPlan();
    
    // Setup event listeners
    setupEventListeners();
});

function initializeUI() {
    // Update hour slider value display
    const hourSlider = document.getElementById('dailyHours');
    const hourValue = document.getElementById('hoursValue');
    
    hourValue.textContent = `${hourSlider.value} hours`;
    
    hourSlider.addEventListener('input', () => {
        hourValue.textContent = `${hourSlider.value} hours`;
        inputManager.updateStats();
    });
    
    // Add initial event listeners to form inputs
    ['startDate', 'endDate', 'sessionLength', 'breakDuration'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            inputManager.updateStats();
            inputManager.savePreferences();
        });
    });
    
    // Add subject button
    document.getElementById('addSubjectBtn').addEventListener('click', () => {
        inputManager.addSubjectRow();
    });
    
    // Update stats initially
    inputManager.updateStats();
}

function setupEventListeners() {
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', () => {
        uiManager.toggleTheme();
    });
    
    // Generate plan button
    document.getElementById('generatePlanBtn').addEventListener('click', generatePlan);
    
    // Navigation buttons
    document.getElementById('prevDayBtn').addEventListener('click', showPreviousDay);
    document.getElementById('nextDayBtn').addEventListener('click', showNextDay);
    
    // Export button
    document.getElementById('exportBtn').addEventListener('click', showExportModal);
    
    // Reset button
    document.getElementById('resetBtn').addEventListener('click', resetPlan);
    
    // Export modal buttons
    document.querySelector('.btn-close-modal')?.addEventListener('click', () => {
        uiManager.hideModal('exportModal');
    });
    
    // Export options
    document.querySelectorAll('.export-option').forEach(option => {
        option.addEventListener('click', (e) => {
            const format = e.currentTarget.dataset.format;
            updateExportPreview(format);
        });
    });
    
    // Copy export button
    document.getElementById('copyExportBtn')?.addEventListener('click', () => {
        const preview = document.getElementById('exportPreview').textContent;
        uiManager.copyToClipboard(preview);
    });
    
    // Download export button
    document.getElementById('downloadExportBtn')?.addEventListener('click', () => {
        const format = document.querySelector('.export-option.active')?.dataset.format || 'json';
        const content = scheduler.exportSchedule(format);
        const filename = `study-plan-${new Date().toISOString().split('T')[0]}.${format}`;
        uiManager.downloadFile(content, filename);
    });
    
    // Close modal on outside click
    document.getElementById('exportModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'exportModal') {
            uiManager.hideModal('exportModal');
        }
    });
}

function loadSavedPlan() {
    const savedPlan = storageManager.loadPlan();
    if (savedPlan) {
        currentPlan = savedPlan;
        displayPlan(savedPlan);
        uiManager.showNotification('Loaded saved study plan', 'success');
    }
}

async function generatePlan() {
    console.log('Generating study plan...');
    
    // Show loading state
    const originalHTML = uiManager.showLoading('generatePlanBtn', 'Generating...');
    
    try {
        // Validate inputs
        const validation = inputManager.validateInputs();
        if (!validation.isValid) {
            uiManager.showNotification(`Please fix errors: ${validation.errors.join(', ')}`, 'error');
            return;
        }
        
        // Collect all inputs
        const inputs = inputManager.collectAllInputs();
        const subjects = inputs.subjects;
        
        // Save preferences
        inputManager.savePreferences();
        
        // Generate the plan
        const plan = scheduler.generatePlan(inputs, subjects);
        currentPlan = plan;
        
        // Save to storage
        storageManager.savePlan(plan);
        
        // Display the plan
        displayPlan(plan);
        
        // Show success message
        uiManager.showNotification('✅ Study plan generated successfully!', 'success');
        
    } catch (error) {
        console.error('Error generating plan:', error);
        uiManager.showNotification('❌ Error generating plan. Please check your inputs and try again.', 'error');
    } finally {
        // Reset button
        uiManager.hideLoading('generatePlanBtn', originalHTML);
    }
}

function displayPlan(plan) {
    if (!plan || !plan.schedule || plan.schedule.length === 0) {
        uiManager.showNotification('No schedule data to display', 'warning');
        return;
    }
    
    // Display Day 1 schedule
    currentDayIndex = 0;
    const daySchedule = plan.schedule[currentDayIndex];
    uiManager.displayTimetable(daySchedule.slots, currentDayIndex);
    
    // Update progress bars
    uiManager.displayProgressBars(plan.allocations);
    
    // Display suggestions
    uiManager.displaySuggestions(plan.suggestions);
    
    // Update day navigation
    uiManager.updateDayNavigation(plan.schedule.length, currentDayIndex);
    
    // Update efficiency score
    if (plan.summary && plan.summary.efficiencyScore !== undefined) {
        uiManager.updateEfficiencyScore(plan.summary.efficiencyScore);
    }
    
    // Update dashboard stats
    uiManager.updateDashboardStats({
        totalDays: plan.schedule.length,
        totalSubjects: plan.allocations.length,
        totalHours: plan.allocations.reduce((sum, subj) => sum + subj.hoursNeeded, 0),
        completionRate: 0
    });
    
    // Add event listeners for completion buttons
    setTimeout(() => {
        document.querySelectorAll('.btn-complete').forEach(button => {
            button.addEventListener('click', (e) => {
                const sessionId = e.currentTarget.dataset.sessionId;
                toggleSessionCompletion(sessionId);
            });
        });
    }, 100);
}

function showPreviousDay() {
    if (!currentPlan || currentDayIndex <= 0) return;
    
    currentDayIndex--;
    const daySchedule = currentPlan.schedule[currentDayIndex];
    uiManager.displayTimetable(daySchedule.slots, currentDayIndex);
    uiManager.updateDayNavigation(currentPlan.schedule.length, currentDayIndex);
}

function showNextDay() {
    if (!currentPlan || currentDayIndex >= currentPlan.schedule.length - 1) return;
    
    currentDayIndex++;
    const daySchedule = currentPlan.schedule[currentDayIndex];
    uiManager.displayTimetable(daySchedule.slots, currentDayIndex);
    uiManager.updateDayNavigation(currentPlan.schedule.length, currentDayIndex);
}

function toggleSessionCompletion(sessionId) {
    if (!currentPlan) return;
    
    // Find and toggle session completion
    for (const day of currentPlan.schedule) {
        const session = day.slots.find(s => s.id === sessionId);
        if (session) {
            session.completed = !session.completed;
            
            // Save to storage
            storageManager.saveSessionCompletion(sessionId, session.completed);
            
            // Update subject progress
            const subject = currentPlan.allocations.find(s => s.id === session.subjectId);
            if (subject) {
                if (session.completed) {
                    subject.hoursCompleted = (subject.hoursCompleted || 0) + (session.duration / 60);
                } else {
                    subject.hoursCompleted = Math.max(0, (subject.hoursCompleted || 0) - (session.duration / 60));
                }
            }
            
            // Update UI
            uiManager.displayTimetable(day.slots, currentDayIndex);
            uiManager.displayProgressBars(currentPlan.allocations);
            
            // Update completion rate
            const totalHours = currentPlan.allocations.reduce((sum, s) => sum + s.hoursNeeded, 0);
            const completedHours = currentPlan.allocations.reduce((sum, s) => sum + (s.hoursCompleted || 0), 0);
            const completionRate = totalHours > 0 ? Math.round((completedHours / totalHours) * 100) : 0;
            
            document.getElementById('completionRate').textContent = `${completionRate}%`;
            
            uiManager.showNotification(
                session.completed ? 'Session marked as complete!' : 'Session marked as pending',
                session.completed ? 'success' : 'info'
            );
            
            break;
        }
    }
}

function showExportModal() {
    if (!currentPlan) {
        uiManager.showNotification('Please generate a plan first', 'warning');
        return;
    }
    
    uiManager.showModal('exportModal');
    updateExportPreview('json');
}

function updateExportPreview(format) {
    if (!currentPlan) return;
    
    const content = scheduler.exportSchedule(format);
    uiManager.showExportPreview(content, format);
    
    // Update active button
    document.querySelectorAll('.export-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.format === format) {
            option.classList.add('active');
        }
    });
}

function resetPlan() {
    if (confirm('Are you sure you want to reset the entire plan? This will clear all your progress.')) {
        storageManager.clearAllData();
        currentPlan = null;
        currentDayIndex = 0;
        
        // Clear UI
        uiManager.displayTimetable([]);
        uiManager.displayProgressBars([]);
        uiManager.displaySuggestions([]);
        uiManager.updateDayNavigation(0, 0);
        uiManager.updateEfficiencyScore('--');
        
        // Reset form
        inputManager.subjects = [];
        inputManager.renderSubjects();
        
        uiManager.showNotification('Plan reset successfully. Ready to create a new study schedule!', 'success');
    }
}

// Make functions available globally for debugging
window.app = {
    inputManager,
    rulesEngine,
    scheduler,
    storageManager,
    uiManager,
    currentPlan,
    generatePlan,
    resetPlan
};