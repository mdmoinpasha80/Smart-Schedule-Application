import CONFIG from './config.js';

class StorageManager {
    constructor() {
        this.planKey = CONFIG.STORAGE_KEYS.STUDY_PLAN;
        this.prefsKey = CONFIG.STORAGE_KEYS.USER_PREFS;
        this.progressKey = CONFIG.STORAGE_KEYS.PROGRESS;
    }

    // Save complete study plan
    savePlan(plan) {
        const planData = {
            ...plan,
            savedAt: new Date().toISOString(),
            version: '1.0'
        };
        
        localStorage.setItem(this.planKey, JSON.stringify(planData));
        console.log('Plan saved to localStorage');
        return true;
    }

    // Load study plan
    loadPlan() {
        const planData = localStorage.getItem(this.planKey);
        if (!planData) return null;
        
        try {
            return JSON.parse(planData);
        } catch (error) {
            console.error('Error loading plan:', error);
            return null;
        }
    }

    // Save user progress
    saveProgress(progress) {
        const progressData = {
            ...progress,
            lastUpdated: new Date().toISOString()
        };
        
        localStorage.setItem(this.progressKey, JSON.stringify(progressData));
        return true;
    }

    // Load user progress
    loadProgress() {
        const progressData = localStorage.getItem(this.progressKey);
        if (!progressData) return null;
        
        try {
            return JSON.parse(progressData);
        } catch (error) {
            console.error('Error loading progress:', error);
            return null;
        }
    }

    // Save session completion
    saveSessionCompletion(sessionId, completed = true) {
        let progress = this.loadProgress() || { completedSessions: {} };
        
        if (completed) {
            progress.completedSessions[sessionId] = new Date().toISOString();
        } else {
            delete progress.completedSessions[sessionId];
        }
        
        return this.saveProgress(progress);
    }

    // Get completion statistics
    getCompletionStats() {
        const progress = this.loadProgress();
        if (!progress || !progress.completedSessions) {
            return { total: 0, completed: 0, percentage: 0 };
        }
        
        const completed = Object.keys(progress.completedSessions).length;
        
        // Get total sessions from plan
        const plan = this.loadPlan();
        let total = 0;
        if (plan && plan.schedule) {
            plan.schedule.forEach(day => {
                total += day.slots.filter(slot => 
                    slot.type === 'study' || slot.type === 'revision'
                ).length;
            });
        }
        
        return {
            total,
            completed,
            percentage: total > 0 ? Math.round((completed / total) * 100) : 0
        };
    }

    // Export all data
    exportAllData() {
        const plan = this.loadPlan();
        const progress = this.loadProgress();
        const prefs = localStorage.getItem(this.prefsKey);
        
        const exportData = {
            metadata: {
                exportedAt: new Date().toISOString(),
                tool: 'Smart Study Planner',
                version: '1.0'
            },
            plan: plan ? plan : null,
            progress: progress ? progress : null,
            preferences: prefs ? JSON.parse(prefs) : null
        };
        
        return JSON.stringify(exportData, null, 2);
    }

    // Import data
    importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            if (data.plan) {
                localStorage.setItem(this.planKey, JSON.stringify(data.plan));
            }
            
            if (data.progress) {
                localStorage.setItem(this.progressKey, JSON.stringify(data.progress));
            }
            
            if (data.preferences) {
                localStorage.setItem(this.prefsKey, JSON.stringify(data.preferences));
            }
            
            return { success: true, message: 'Data imported successfully' };
        } catch (error) {
            return { success: false, message: 'Invalid JSON format' };
        }
    }

    // Clear all data
    clearAllData() {
        localStorage.removeItem(this.planKey);
        localStorage.removeItem(this.progressKey);
        localStorage.removeItem(this.prefsKey);
        return true;
    }

    // Get storage usage
    getStorageUsage() {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += localStorage[key].length * 2; // Approximate bytes
            }
        }
        
        return {
            bytes: total,
            kilobytes: (total / 1024).toFixed(2),
            megabytes: (total / (1024 * 1024)).toFixed(2)
        };
    }

    // Backup data to file
    backupToFile() {
        const data = this.exportAllData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `study-planner-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Create and export singleton instance
const storageManager = new StorageManager();
export default storageManager;