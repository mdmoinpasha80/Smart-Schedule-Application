import CONFIG from './config.js';

class InputManager {
    constructor() {
        this.subjects = [];
        this.userPreferences = {};
        this.loadSavedPreferences();
    }

    // Load saved data from localStorage
    loadSavedPreferences() {
        const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_PREFS);
        if (saved) {
            this.userPreferences = JSON.parse(saved);
            this.populateForm();
        } else {
            // Initialize with default subjects
            this.subjects = [
                {
                    id: this.generateId(),
                    name: "Data Structures",
                    priority: "high",
                    difficulty: "hard",
                    hoursNeeded: 30,
                    hoursCompleted: 0,
                    sessionsCompleted: 0,
                    weight: 0
                },
                {
                    id: this.generateId(),
                    name: "Algorithms",
                    priority: "high",
                    difficulty: "medium",
                    hoursNeeded: 25,
                    hoursCompleted: 0,
                    sessionsCompleted: 0,
                    weight: 0
                },
                {
                    id: this.generateId(),
                    name: "Database Systems",
                    priority: "medium",
                    difficulty: "medium",
                    hoursNeeded: 20,
                    hoursCompleted: 0,
                    sessionsCompleted: 0,
                    weight: 0
                }
            ];
            this.renderSubjects();
        }
    }

    // Populate form with saved data
    populateForm() {
        if (this.userPreferences.subjects) {
            this.subjects = this.userPreferences.subjects;
            this.renderSubjects();
        }
        
        if (this.userPreferences.preferences) {
            const prefs = this.userPreferences.preferences;
            if (prefs.startDate) document.getElementById('startDate').value = prefs.startDate;
            if (prefs.endDate) document.getElementById('endDate').value = prefs.endDate;
            if (prefs.dailyHours) {
                document.getElementById('dailyHours').value = prefs.dailyHours;
                document.getElementById('hoursValue').textContent = `${prefs.dailyHours} hours`;
            }
            if (prefs.sessionLength) document.getElementById('sessionLength').value = prefs.sessionLength;
            if (prefs.breakDuration) document.getElementById('breakDuration').value = prefs.breakDuration;
        }
    }

    // Collect all user inputs
    collectAllInputs() {
        return {
            timeline: this.getTimelineData(),
            sessionSettings: this.getSessionSettings(),
            subjects: this.getSubjectsData(),
            preferences: this.getTimePreferences()
        };
    }

    // Get timeline data
    getTimelineData() {
        const startDate = new Date(document.getElementById('startDate').value);
        const endDate = new Date(document.getElementById('endDate').value);
        const dailyHours = parseInt(document.getElementById('dailyHours').value);
        
        // Calculate total days
        const diffTime = Math.abs(endDate - startDate);
        const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        
        return {
            startDate,
            endDate,
            totalDays,
            dailyHours,
            totalStudyHours: totalDays * dailyHours
        };
    }

    // Get session settings
    getSessionSettings() {
        return {
            sessionLength: parseInt(document.getElementById('sessionLength').value),
            breakDuration: parseInt(document.getElementById('breakDuration').value),
            longBreakDuration: CONFIG.SCHEDULING_RULES.LONG_BREAK_DURATION
        };
    }

    // Get subjects data from form
    getSubjectsData() {
        const subjects = [];
        const subjectInputs = document.querySelectorAll('.subject-input');
        
        subjectInputs.forEach(input => {
            const name = input.querySelector('.subject-name').value.trim();
            const priority = input.querySelector('.subject-priority').value;
            const difficulty = input.querySelector('.subject-difficulty').value;
            const hoursNeeded = parseInt(input.querySelector('.subject-hours').value) || 0;
            
            if (name && hoursNeeded > 0) {
                subjects.push({
                    id: this.generateId(),
                    name,
                    priority,
                    difficulty,
                    hoursNeeded,
                    hoursCompleted: 0,
                    sessionsCompleted: 0,
                    weight: 0 // Will be calculated by rules engine
                });
            }
        });
        
        this.subjects = subjects;
        return subjects;
    }

    // Get time preferences (for advanced scheduling)
    getTimePreferences() {
        return {
            morningStart: 9, // Default: 9 AM
            eveningEnd: 21,  // Default: 9 PM
            avoidLateNight: CONFIG.TIME_PREFERENCES.AVOID_LATE_NIGHT
        };
    }

    // Validate inputs
    validateInputs() {
        const errors = [];
        const timeline = this.getTimelineData();
        const subjects = this.getSubjectsData();
        
        // Check dates
        if (timeline.startDate >= timeline.endDate) {
            errors.push("End date must be after start date");
        }
        
        if (timeline.totalDays < 1) {
            errors.push("Study period must be at least 1 day");
        }
        
        if (timeline.dailyHours < 2 || timeline.dailyHours > 12) {
            errors.push("Daily study hours must be between 2 and 12 hours");
        }
        
        // Check subjects
        if (subjects.length === 0) {
            errors.push("Please add at least one subject");
        }
        
        // Check total hours needed
        const totalHoursNeeded = subjects.reduce((sum, subj) => sum + subj.hoursNeeded, 0);
        const totalAvailableHours = timeline.totalStudyHours;
        
        if (totalHoursNeeded > totalAvailableHours * 1.2) { // Allow 20% buffer
            errors.push(`Total hours needed (${totalHoursNeeded}) exceeds available hours (${totalAvailableHours}). Consider reducing hours or extending timeline.`);
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Save preferences to localStorage
    savePreferences() {
        const data = {
            subjects: this.subjects,
            preferences: {
                startDate: document.getElementById('startDate').value,
                endDate: document.getElementById('endDate').value,
                dailyHours: parseInt(document.getElementById('dailyHours').value),
                sessionLength: parseInt(document.getElementById('sessionLength').value),
                breakDuration: parseInt(document.getElementById('breakDuration').value),
                lastUpdated: new Date().toISOString()
            }
        };
        
        localStorage.setItem(CONFIG.STORAGE_KEYS.USER_PREFS, JSON.stringify(data));
        console.log('Preferences saved to localStorage');
    }

    // Render subjects list
    renderSubjects() {
        const container = document.getElementById('subjectsContainer');
        container.innerHTML = '';
        
        this.subjects.forEach(subject => {
            const row = document.createElement('div');
            row.className = 'subject-input';
            row.innerHTML = `
                <input type="text" placeholder="Subject Name" class="subject-name" value="${subject.name}">
                <select class="subject-priority">
                    <option value="high" ${subject.priority === 'high' ? 'selected' : ''}>High</option>
                    <option value="medium" ${subject.priority === 'medium' ? 'selected' : ''}>Medium</option>
                    <option value="low" ${subject.priority === 'low' ? 'selected' : ''}>Low</option>
                </select>
                <select class="subject-difficulty">
                    <option value="easy" ${subject.difficulty === 'easy' ? 'selected' : ''}>Easy</option>
                    <option value="medium" ${subject.difficulty === 'medium' ? 'selected' : ''}>Medium</option>
                    <option value="hard" ${subject.difficulty === 'hard' ? 'selected' : ''}>Hard</option>
                </select>
                <input type="number" placeholder="Hours" class="subject-hours" min="1" max="100" value="${subject.hoursNeeded}">
                <button class="btn-remove-subject"><i class="fas fa-times"></i></button>
            `;
            
            container.appendChild(row);
            
            // Add event listener to remove button
            row.querySelector('.btn-remove-subject').addEventListener('click', () => {
                container.removeChild(row);
                this.updateSubjectsFromDOM();
            });
            
            // Add event listeners for changes
            ['input', 'change'].forEach(eventType => {
                row.querySelector('.subject-name').addEventListener(eventType, () => this.updateSubjectsFromDOM());
                row.querySelector('.subject-priority').addEventListener(eventType, () => this.updateSubjectsFromDOM());
                row.querySelector('.subject-difficulty').addEventListener(eventType, () => this.updateSubjectsFromDOM());
                row.querySelector('.subject-hours').addEventListener(eventType, () => this.updateSubjectsFromDOM());
            });
        });
        
        this.updateStats();
    }

    // Update subjects from DOM
    updateSubjectsFromDOM() {
        this.getSubjectsData();
        this.savePreferences();
        this.updateStats();
    }

    // Update statistics display
    updateStats() {
        const timeline = this.getTimelineData();
        const subjects = this.subjects;
        
        document.getElementById('totalDays').textContent = timeline.totalDays;
        document.getElementById('totalSubjects').textContent = subjects.length;
        
        const totalHoursNeeded = subjects.reduce((sum, subj) => sum + subj.hoursNeeded, 0);
        document.getElementById('totalHours').textContent = totalHoursNeeded;
        
        // Calculate completion rate
        const totalCompleted = subjects.reduce((sum, subj) => sum + subj.hoursCompleted, 0);
        const completionRate = totalHoursNeeded > 0 ? Math.round((totalCompleted / totalHoursNeeded) * 100) : 0;
        document.getElementById('completionRate').textContent = `${completionRate}%`;
    }

    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Export data as JSON
    exportData() {
        const data = {
            metadata: {
                exportedAt: new Date().toISOString(),
                version: '1.0',
                tool: 'Smart Study Planner'
            },
            inputs: this.collectAllInputs(),
            subjects: this.subjects
        };
        
        return JSON.stringify(data, null, 2);
    }

    // Import data from JSON
    importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            if (data.subjects) {
                this.subjects = data.subjects;
                this.renderSubjects();
            }
            
            if (data.inputs) {
                // Apply imported inputs
                const inputs = data.inputs;
                if (inputs.timeline) {
                    const timeline = inputs.timeline;
                    document.getElementById('startDate').value = new Date(timeline.startDate).toISOString().split('T')[0];
                    document.getElementById('endDate').value = new Date(timeline.endDate).toISOString().split('T')[0];
                    document.getElementById('dailyHours').value = timeline.dailyHours;
                }
                
                if (inputs.sessionSettings) {
                    const settings = inputs.sessionSettings;
                    document.getElementById('sessionLength').value = settings.sessionLength;
                    document.getElementById('breakDuration').value = settings.breakDuration;
                }
            }
            
            this.savePreferences();
            return { success: true, message: 'Data imported successfully' };
        } catch (error) {
            return { success: false, message: 'Invalid JSON format' };
        }
    }
}

// Create and export singleton instance
const inputManager = new InputManager();
export default inputManager;