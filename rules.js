import CONFIG from './config.js';

class RulesEngine {
    constructor() {
        this.rules = [];
        this.initializeRules();
    }

    // Initialize all scheduling rules
    initializeRules() {
        this.rules = [
            // Priority-based allocation rule
            {
                name: 'priority_allocation',
                apply: (subject, context) => {
                    const weight = CONFIG.PRIORITY_WEIGHTS[subject.priority] || 1;
                    return { weightMultiplier: weight };
                }
            },
            
            // Difficulty-based session planning rule
            {
                name: 'difficulty_adaptation',
                apply: (subject, context) => {
                    const difficulty = subject.difficulty;
                    let sessionLength = context.defaultSessionLength;
                    let breakMultiplier = 1;
                    
                    switch(difficulty) {
                        case 'hard':
                            sessionLength = Math.min(sessionLength, 45); // Max 45 min for hard subjects
                            breakMultiplier = 1.5; // Longer breaks
                            break;
                        case 'easy':
                            sessionLength = Math.max(sessionLength, 60); // Min 60 min for easy subjects
                            breakMultiplier = 0.8; // Shorter breaks
                            break;
                    }
                    
                    return { 
                        adaptedSessionLength: sessionLength,
                        breakMultiplier 
                    };
                }
            },
            
            // Time-of-day preference rule
            {
                name: 'time_preference',
                apply: (subject, context) => {
                    const difficulty = subject.difficulty;
                    const priority = subject.priority;
                    
                    let preferredTimeSlots = [];
                    
                    // Hard or high priority subjects in morning peak hours
                    if (difficulty === 'hard' || priority === 'high') {
                        preferredTimeSlots = CONFIG.TIME_PREFERENCES.MORNING_PEAK;
                    }
                    // Medium difficulty/priority in afternoon
                    else if (difficulty === 'medium' || priority === 'medium') {
                        preferredTimeSlots = [13, 17]; // 1 PM - 5 PM
                    }
                    // Easy or low priority in evening
                    else {
                        preferredTimeSlots = [18, 20]; // 6 PM - 8 PM
                    }
                    
                    return { preferredTimeSlots };
                }
            },
            
            // Consecutive session avoidance rule
            {
                name: 'consecutive_avoidance',
                apply: (subject, context) => {
                    const lastSubject = context.lastScheduledSubject;
                    const avoidConsecutive = lastSubject === subject.id;
                    
                    return { 
                        avoidConsecutive,
                        coolDown: avoidConsecutive ? 2 : 0 // Number of sessions to wait
                    };
                }
            },
            
            // Revision scheduling rule
            {
                name: 'revision_scheduling',
                apply: (subject, context) => {
                    const daysSinceLastStudy = context.daysSinceLastStudy[subject.id] || 0;
                    const needsRevision = daysSinceLastStudy >= CONFIG.SCHEDULING_RULES.REVISION_FREQUENCY;
                    
                    return {
                        needsRevision,
                        revisionPriority: needsRevision ? 1.5 : 1
                    };
                }
            }
        ];
    }

    // Calculate weights for all subjects
    calculateSubjectWeights(subjects, context = {}) {
        return subjects.map(subject => {
            let totalWeight = 1;
            const adjustments = {};
            
            // Apply all rules
            this.rules.forEach(rule => {
                const result = rule.apply(subject, context);
                
                if (result.weightMultiplier) {
                    totalWeight *= result.weightMultiplier;
                }
                
                if (result.revisionPriority) {
                    totalWeight *= result.revisionPriority;
                }
                
                // Store adjustments for later use
                adjustments[rule.name] = result;
            });
            
            // Apply difficulty weight
            totalWeight *= CONFIG.DIFFICULTY_WEIGHTS[subject.difficulty] || 1;
            
            return {
                ...subject,
                weight: parseFloat(totalWeight.toFixed(2)),
                adjustments
            };
        });
    }

    // Allocate daily hours to subjects
    allocateDailyHours(subjects, totalDailyHours) {
        const weightedSubjects = this.calculateSubjectWeights(subjects);
        
        // Calculate total weight
        const totalWeight = weightedSubjects.reduce((sum, subj) => sum + subj.weight, 0);
        
        // Allocate hours proportionally to weight
        const allocations = weightedSubjects.map(subject => {
            const proportion = subject.weight / totalWeight;
            const allocatedHours = proportion * totalDailyHours;
            
            return {
                ...subject,
                allocatedHours: parseFloat(allocatedHours.toFixed(2)),
                sessionsPerDay: Math.max(1, Math.ceil(allocatedHours / 2)) // At least 1 session
            };
        });
        
        // Sort by priority (High first, then Medium, then Low)
        allocations.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
        
        return allocations;
    }

    // Determine optimal session length for a subject
    getOptimalSessionLength(subject, defaultSessionLength) {
        const adjustments = this.calculateSubjectWeights([subject])[0].adjustments;
        const difficultyRule = adjustments.difficulty_adaptation;
        
        return difficultyRule?.adaptedSessionLength || defaultSessionLength;
    }

    // Get break duration for a subject
    getBreakDuration(subject, defaultBreakDuration) {
        const adjustments = this.calculateSubjectWeights([subject])[0].adjustments;
        const difficultyRule = adjustments.difficulty_adaptation;
        
        const multiplier = difficultyRule?.breakMultiplier || 1;
        return Math.round(defaultBreakDuration * multiplier);
    }

    // Check if long break is needed
    needsLongBreak(consecutiveSessions, maxSessionsWithoutLongBreak) {
        return consecutiveSessions >= maxSessionsWithoutLongBreak;
    }

    // Generate scheduling constraints
    generateConstraints(subjects, context) {
        const constraints = {
            timeSlots: {},
            subjectLimits: {},
            preferences: {}
        };
        
        subjects.forEach(subject => {
            const adjustments = this.calculateSubjectWeights([subject], context)[0].adjustments;
            const timeRule = adjustments.time_preference;
            
            // Set preferred time slots
            constraints.timeSlots[subject.id] = timeRule?.preferredTimeSlots || [];
            
            // Set subject-specific limits
            constraints.subjectLimits[subject.id] = {
                maxSessionsPerDay: subject.difficulty === 'hard' ? 3 : 4,
                minBreakBetween: subject.difficulty === 'hard' ? 20 : 10
            };
            
            // Set avoidance constraints
            const consecutiveRule = adjustments.consecutive_avoidance;
            if (consecutiveRule?.avoidConsecutive) {
                constraints.preferences[subject.id] = {
                    ...constraints.preferences[subject.id],
                    avoidAfter: context.lastScheduledSubject,
                    coolDown: consecutiveRule.coolDown
                };
            }
        });
        
        return constraints;
    }

    // Validate schedule against rules
    validateSchedule(schedule, subjects, context) {
        const violations = [];
        const subjectStats = {};
        
        // Initialize stats
        subjects.forEach(subj => {
            subjectStats[subj.id] = {
                sessions: 0,
                dailySessions: {},
                lastSessionDay: -1
            };
        });
        
        // Analyze schedule
        schedule.forEach((daySchedule, dayIndex) => {
            let consecutiveSameSubject = 0;
            let lastSubjectId = null;
            
            daySchedule.slots.forEach((slot, slotIndex) => {
                if (slot.type === CONFIG.SESSION_TYPES.STUDY || slot.type === CONFIG.SESSION_TYPES.REVISION) {
                    const subjectId = slot.subjectId;
                    
                    // Track subject stats
                    if (!subjectStats[subjectId]) subjectStats[subjectId] = { sessions: 0, dailySessions: {} };
                    subjectStats[subjectId].sessions++;
                    subjectStats[subjectId].dailySessions[dayIndex] = (subjectStats[subjectId].dailySessions[dayIndex] || 0) + 1;
                    subjectStats[subjectId].lastSessionDay = dayIndex;
                    
                    // Check for consecutive same subject
                    if (subjectId === lastSubjectId) {
                        consecutiveSameSubject++;
                        if (consecutiveSameSubject > 1) {
                            violations.push({
                                type: 'consecutive_sessions',
                                day: dayIndex,
                                slot: slotIndex,
                                message: `Subject repeated consecutively: ${slot.subjectName}`
                            });
                        }
                    } else {
                        consecutiveSameSubject = 0;
                    }
                    lastSubjectId = subjectId;
                    
                    // Check time preferences
                    const subject = subjects.find(s => s.id === subjectId);
                    if (subject) {
                        const hour = parseInt(slot.startTime.split(':')[0]);
                        const adjustments = this.calculateSubjectWeights([subject])[0].adjustments;
                        const preferredSlots = adjustments.time_preference?.preferredTimeSlots;
                        
                        if (preferredSlots && preferredSlots.length === 2) {
                            const [start, end] = preferredSlots;
                            if (hour < start || hour >= end) {
                                violations.push({
                                    type: 'time_preference',
                                    day: dayIndex,
                                    slot: slotIndex,
                                    message: `${slot.subjectName} scheduled outside preferred time (${start}:00-${end}:00)`
                                });
                            }
                        }
                    }
                }
            });
        });
        
        // Check revision frequency
        Object.entries(subjectStats).forEach(([subjectId, stats]) => {
            const subject = subjects.find(s => s.id === subjectId);
            if (subject) {
                const daysBetween = context.currentDay - stats.lastSessionDay;
                if (daysBetween > CONFIG.SCHEDULING_RULES.REVISION_FREQUENCY) {
                    violations.push({
                        type: 'revision_needed',
                        subject: subject.name,
                        daysSinceLast: daysBetween,
                        message: `${subject.name} hasn't been studied for ${daysBetween} days. Needs revision.`
                    });
                }
            }
        });
        
        return {
            isValid: violations.length === 0,
            violations,
            stats: subjectStats
        };
    }

    // Generate smart suggestions based on violations
    generateSuggestions(violations, schedule) {
        const suggestions = [];
        
        violations.forEach(violation => {
            switch(violation.type) {
                case 'consecutive_sessions':
                    suggestions.push({
                        type: 'warning',
                        message: `Avoid consecutive sessions of the same subject. Consider adding a break or switching subjects.`,
                        action: 'reschedule',
                        priority: 'medium'
                    });
                    break;
                    
                case 'time_preference':
                    suggestions.push({
                        type: 'info',
                        message: violation.message,
                        action: 'consider_reschedule',
                        priority: 'low'
                    });
                    break;
                    
                case 'revision_needed':
                    suggestions.push({
                        type: 'important',
                        message: violation.message,
                        action: 'add_revision',
                        priority: 'high'
                    });
                    break;
            }
        });
        
        // Add general suggestions
        const totalStudyTime = schedule.reduce((total, day) => {
            return total + day.slots.filter(s => s.type === CONFIG.SESSION_TYPES.STUDY || s.type === CONFIG.SESSION_TYPES.REVISION).length;
        }, 0);
        
        if (totalStudyTime > 6) {
            suggestions.push({
                type: 'tip',
                message: 'Consider adding more breaks to maintain focus and productivity.',
                action: 'increase_breaks',
                priority: 'medium'
            });
        }
        
        // Add efficiency tips
        const efficiencyScore = calculateEfficiencyScore(schedule);
        if (efficiencyScore < 70) {
            suggestions.push({
                type: 'tip',
                message: `Your schedule efficiency is ${efficiencyScore}%. Try optimizing session lengths and breaks.`,
                action: 'optimize',
                priority: 'medium'
            });
        }
        
        return suggestions;
    }
}

// Calculate efficiency score
function calculateEfficiencyScore(schedule) {
    let totalStudyTime = 0;
    let totalBreakTime = 0;
    
    schedule.forEach(day => {
        day.slots.forEach(slot => {
            if (slot.type === CONFIG.SESSION_TYPES.STUDY || slot.type === CONFIG.SESSION_TYPES.REVISION) {
                totalStudyTime += slot.duration;
            } else if (slot.type === CONFIG.SESSION_TYPES.BREAK) {
                totalBreakTime += slot.duration;
            }
        });
    });
    
    if (totalStudyTime === 0) return 0;
    
    const actualRatio = totalBreakTime / totalStudyTime;
    const idealRatio = 17 / 52; // Pomodoro ratio
    
    // Score based on how close to ideal ratio
    const ratioScore = Math.max(0, 100 - Math.abs(actualRatio - idealRatio) * 1000);
    
    // Bonus for having breaks
    const breakBonus = totalBreakTime > totalStudyTime * 0.2 ? 10 : 0;
    
    return Math.min(100, Math.round(ratioScore + breakBonus));
}

// Create and export singleton instance
const rulesEngine = new RulesEngine();
export default rulesEngine;