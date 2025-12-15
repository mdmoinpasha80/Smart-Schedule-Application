// Configuration constants
const CONFIG = {
    SESSION_TYPES: {
        STUDY: 'study',
        BREAK: 'break',
        REVISION: 'revision'
    },
    
    PRIORITY_WEIGHTS: {
        high: 3,
        medium: 2,
        low: 1
    },
    
    DIFFICULTY_WEIGHTS: {
        hard: 1.5,
        medium: 1,
        easy: 0.8
    },
    
    TIME_PREFERENCES: {
        MORNING_PEAK: [9, 12], // 9 AM - 12 PM
        AFTERNOON_PEAK: [15, 18], // 3 PM - 6 PM
        AVOID_LATE_NIGHT: 22 // Avoid scheduling after 10 PM
    },
    
    SCHEDULING_RULES: {
        MAX_SESSIONS_WITHOUT_LONG_BREAK: 4,
        LONG_BREAK_DURATION: 30, // minutes
        REVISION_FREQUENCY: 3 // days
    },
    
    STORAGE_KEYS: {
        STUDY_PLAN: 'smartStudyPlan',
        USER_PREFS: 'studyPreferences',
        PROGRESS: 'studyProgress'
    }
};

export default CONFIG;