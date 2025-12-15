import CONFIG from './config.js';
import rulesEngine from './rules.js';

class SmartScheduler {
    constructor() {
        this.schedule = [];
        this.currentDay = 0;
        this.context = {
            lastScheduledSubject: null,
            daysSinceLastStudy: {},
            consecutiveSessions: 0,
            sessionCountToday: 0
        };
    }

    // Generate complete study plan
    generatePlan(inputs, subjects) {
        console.log('Generating smart study plan...');
        
        const { timeline, sessionSettings } = inputs;
        const totalDays = timeline.totalDays;
        const dailyHours = timeline.dailyHours;
        
        // Calculate subject allocations
        const allocations = rulesEngine.allocateDailyHours(subjects, dailyHours);
        
        // Generate schedule for each day
        this.schedule = [];
        const allSlots = [];
        
        for (let day = 0; day < totalDays; day++) {
            const daySchedule = this.generateDaySchedule(day, allocations, sessionSettings);
            this.schedule.push(daySchedule);
            allSlots.push(...daySchedule.slots);
            
            // Update context for next day
            this.updateContextAfterDay(day, daySchedule);
        }
        
        // Validate the complete schedule
        const validation = rulesEngine.validateSchedule(this.schedule, subjects, {
            currentDay: this.currentDay,
            ...this.context
        });
        
        // Generate suggestions
        const suggestions = rulesEngine.generateSuggestions(validation.violations, this.schedule);
        
        return {
            schedule: this.schedule,
            allocations,
            validation,
            suggestions,
            summary: this.generateSummary(allSlots, subjects, totalDays)
        };
    }

    // Generate schedule for a single day
    generateDaySchedule(dayIndex, allocations, sessionSettings) {
        const daySlots = [];
        let currentTime = 9 * 60; // Start at 9:00 AM (in minutes)
        let sessionCount = 0;
        let lastSubjectId = null;
        
        // Filter subjects that need study today
        const todaysSubjects = this.selectTodaysSubjects(allocations, dayIndex);
        
        // Sort by priority and needs
        todaysSubjects.sort((a, b) => {
            // First by revision need
            const aNeedsRevision = this.context.daysSinceLastStudy[a.id] >= CONFIG.SCHEDULING_RULES.REVISION_FREQUENCY;
            const bNeedsRevision = this.context.daysSinceLastStudy[b.id] >= CONFIG.SCHEDULING_RULES.REVISION_FREQUENCY;
            
            if (aNeedsRevision && !bNeedsRevision) return -1;
            if (!aNeedsRevision && bNeedsRevision) return 1;
            
            // Then by priority
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
        
        // Generate slots until daily hours are used or time runs out
        let remainingHours = sessionSettings.dailyHours;
        let subjectIndex = 0;
        
        while (remainingHours > 0 && currentTime < 21 * 60) { // Until 9 PM
            const subject = todaysSubjects[subjectIndex % todaysSubjects.length];
            
            if (!subject) break;
            
            // Check if we should avoid consecutive same subject
            if (subject.id === lastSubjectId && todaysSubjects.length > 1) {
                subjectIndex++;
                continue;
            }
            
            // Determine session length for this subject
            const sessionLength = rulesEngine.getOptimalSessionLength(subject, sessionSettings.sessionLength);
            const breakDuration = rulesEngine.getBreakDuration(subject, sessionSettings.breakDuration);
            
            // Create study session
            const sessionSlot = this.createSessionSlot(
                subject,
                currentTime,
                sessionLength,
                dayIndex
            );
            daySlots.push(sessionSlot);
            
            currentTime += sessionLength;
            remainingHours -= sessionLength / 60;
            sessionCount++;
            lastSubjectId = subject.id;
            
            // Update subject hours
            subject.hoursScheduledToday = (subject.hoursScheduledToday || 0) + (sessionLength / 60);
            
            // Check if we need a long break
            if (rulesEngine.needsLongBreak(sessionCount, CONFIG.SCHEDULING_RULES.MAX_SESSIONS_WITHOUT_LONG_BREAK)) {
                const longBreakSlot = this.createBreakSlot(
                    currentTime,
                    CONFIG.SCHEDULING_RULES.LONG_BREAK_DURATION,
                    'long'
                );
                daySlots.push(longBreakSlot);
                currentTime += CONFIG.SCHEDULING_RULES.LONG_BREAK_DURATION;
                sessionCount = 0;
            } else if (remainingHours > 0) {
                // Add regular break
                const breakSlot = this.createBreakSlot(currentTime, breakDuration, 'regular');
                daySlots.push(breakSlot);
                currentTime += breakDuration;
            }
            
            subjectIndex++;
            
            // Avoid scheduling too late
            if (currentTime >= CONFIG.TIME_PREFERENCES.AVOID_LATE_NIGHT * 60) {
                break;
            }
        }
        
        // Add lunch break if schedule extends past 12 PM
        if (currentTime > 12 * 60 && currentTime < 14 * 60) {
            const lunchIndex = daySlots.findIndex(slot => 
                parseInt(slot.startTime.split(':')[0]) >= 12
            );
            
            if (lunchIndex > -1) {
                const lunchBreak = this.createBreakSlot(12 * 60, 60, 'lunch');
                daySlots.splice(lunchIndex, 0, lunchBreak);
            }
        }
        
        return {
            day: dayIndex + 1,
            date: this.calculateDate(dayIndex),
            totalSessions: daySlots.filter(s => s.type === CONFIG.SESSION_TYPES.STUDY || s.type === CONFIG.SESSION_TYPES.REVISION).length,
            totalStudyHours: daySlots
                .filter(s => s.type === CONFIG.SESSION_TYPES.STUDY || s.type === CONFIG.SESSION_TYPES.REVISION)
                .reduce((sum, s) => sum + s.duration, 0) / 60,
            slots: daySlots
        };
    }

    // Select which subjects to study today
    selectTodaysSubjects(allocations, dayIndex) {
        // Start with subjects that need revision
        const revisionSubjects = allocations.filter(subject => {
            const daysSince = this.context.daysSinceLastStudy[subject.id] || 0;
            return daysSince >= CONFIG.SCHEDULING_RULES.REVISION_FREQUENCY;
        });
        
        if (revisionSubjects.length > 0) {
            return revisionSubjects.slice(0, 3); // Max 3 revision subjects per day
        }
        
        // Normal day: select based on allocation
        const availableSubjects = allocations.filter(subject => {
            const hoursScheduled = subject.hoursScheduled || 0;
            return hoursScheduled < subject.allocatedHours * (dayIndex + 1);
        });
        
        // Distribute subjects across the week
        const subjectsPerDay = Math.min(availableSubjects.length, 4);
        const startIdx = dayIndex % Math.max(1, Math.floor(availableSubjects.length / subjectsPerDay));
        
        return availableSubjects.slice(startIdx, startIdx + subjectsPerDay);
    }

    // Create a study session slot
    createSessionSlot(subject, startTimeMinutes, duration, dayIndex) {
        const startTime = this.formatTime(startTimeMinutes);
        const endTime = this.formatTime(startTimeMinutes + duration);
        
        // Determine session type
        let type = CONFIG.SESSION_TYPES.STUDY;
        const daysSince = this.context.daysSinceLastStudy[subject.id] || 0;
        if (daysSince >= CONFIG.SCHEDULING_RULES.REVISION_FREQUENCY) {
            type = CONFIG.SESSION_TYPES.REVISION;
        }
        
        return {
            id: `session_${subject.id}_${dayIndex}_${startTimeMinutes}`,
            type,
            subjectId: subject.id,
            subjectName: subject.name,
            priority: subject.priority,
            difficulty: subject.difficulty,
            startTime,
            endTime,
            duration,
            completed: false,
            day: dayIndex + 1
        };
    }

    // Create a break slot
    createBreakSlot(startTimeMinutes, duration, breakType = 'regular') {
        const startTime = this.formatTime(startTimeMinutes);
        const endTime = this.formatTime(startTimeMinutes + duration);
        
        let label = 'Break';
        switch(breakType) {
            case 'long': label = 'Long Break'; break;
            case 'lunch': label = 'Lunch Break'; break;
        }
        
        return {
            id: `break_${startTimeMinutes}`,
            type: CONFIG.SESSION_TYPES.BREAK,
            subjectName: label,
            startTime,
            endTime,
            duration,
            breakType,
            day: this.currentDay + 1
        };
    }

    // Update context after a day's schedule
    updateContextAfterDay(dayIndex, daySchedule) {
        // Update days since last study for each subject
        daySchedule.slots.forEach(slot => {
            if (slot.type === CONFIG.SESSION_TYPES.STUDY || slot.type === CONFIG.SESSION_TYPES.REVISION) {
                this.context.daysSinceLastStudy[slot.subjectId] = 0;
                this.context.lastScheduledSubject = slot.subjectId;
            }
        });
        
        // Increment days for all subjects
        Object.keys(this.context.daysSinceLastStudy).forEach(subjectId => {
            this.context.daysSinceLastStudy[subjectId]++;
        });
        
        this.currentDay = dayIndex;
    }

    // Format minutes to time string (HH:MM AM/PM)
    formatTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
    }

    // Calculate date for a day index
    calculateDate(dayIndex) {
        const startDate = new Date(document.getElementById('startDate').value);
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + dayIndex);
        return date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }

    // Generate summary statistics
    generateSummary(allSlots, subjects, totalDays) {
        const studySlots = allSlots.filter(s => s.type === CONFIG.SESSION_TYPES.STUDY || s.type === CONFIG.SESSION_TYPES.REVISION);
        const breakSlots = allSlots.filter(s => s.type === CONFIG.SESSION_TYPES.BREAK);
        
        const totalStudyHours = studySlots.reduce((sum, s) => sum + s.duration, 0) / 60;
        const totalBreakHours = breakSlots.reduce((sum, s) => sum + s.duration, 0) / 60;
        
        // Calculate subject distribution
        const subjectDistribution = {};
        studySlots.forEach(slot => {
            if (!subjectDistribution[slot.subjectName]) {
                subjectDistribution[slot.subjectName] = 0;
            }
            subjectDistribution[slot.subjectName] += slot.duration / 60;
        });
        
        // Calculate daily averages
        const averageSessionsPerDay = studySlots.length / totalDays;
        const averageStudyHoursPerDay = totalStudyHours / totalDays;
        
        // Calculate efficiency score
        let efficiencyScore = 0;
        if (totalStudyHours > 0) {
            const actualRatio = totalBreakHours / totalStudyHours;
            const idealRatio = 17 / 52; // Pomodoro ratio
            const ratioScore = Math.max(0, 100 - Math.abs(actualRatio - idealRatio) * 1000);
            const breakBonus = totalBreakHours > totalStudyHours * 0.2 ? 10 : 0;
            efficiencyScore = Math.min(100, Math.round(ratioScore + breakBonus));
        }
        
        return {
            totalStudyHours: parseFloat(totalStudyHours.toFixed(1)),
            totalBreakHours: parseFloat(totalBreakHours.toFixed(1)),
            totalSessions: studySlots.length,
            subjectDistribution,
            dailyAverages: {
                sessions: parseFloat(averageSessionsPerDay.toFixed(1)),
                studyHours: parseFloat(averageStudyHoursPerDay.toFixed(1))
            },
            efficiencyScore
        };
    }

    // Get schedule for specific day
    getDaySchedule(dayIndex) {
        if (dayIndex >= 0 && dayIndex < this.schedule.length) {
            return this.schedule[dayIndex];
        }
        return null;
    }

    // Mark session as completed
    markSessionCompleted(sessionId) {
        for (const day of this.schedule) {
            const session = day.slots.find(s => s.id === sessionId);
            if (session) {
                session.completed = true;
                console.log(`Session ${sessionId} marked as completed`);
                return true;
            }
        }
        return false;
    }

    // Export schedule as various formats
    exportSchedule(format = 'json') {
        switch(format) {
            case 'json':
                return JSON.stringify(this.schedule, null, 2);
                
            case 'csv':
                let csv = 'Day,Date,Start Time,End Time,Subject,Type,Priority,Difficulty,Completed\n';
                this.schedule.forEach(day => {
                    day.slots.forEach(slot => {
                        csv += `${day.day},${day.date},${slot.startTime},${slot.endTime},"${slot.subjectName}",${slot.type},${slot.priority},${slot.difficulty},${slot.completed ? 'Yes' : 'No'}\n`;
                    });
                });
                return csv;
                
            case 'text':
                let text = 'SMART STUDY PLANNER SCHEDULE\n';
                text += '='.repeat(50) + '\n\n';
                
                this.schedule.forEach(day => {
                    text += `DAY ${day.day}: ${day.date}\n`;
                    text += `Total Sessions: ${day.totalSessions} | Study Hours: ${day.totalStudyHours.toFixed(1)}\n`;
                    text += '-'.repeat(50) + '\n';
                    
                    day.slots.forEach(slot => {
                        const status = slot.completed ? '[✓]' : '[ ]';
                        text += `${status} ${slot.startTime} - ${slot.endTime}: ${slot.subjectName}`;
                        if (slot.type === CONFIG.SESSION_TYPES.REVISION) {
                            text += ' (Revision)';
                        } else if (slot.type === CONFIG.SESSION_TYPES.BREAK) {
                            text += ` (${slot.breakType})`;
                        }
                        text += '\n';
                    });
                    text += '\n';
                });
                
                // Add summary
                const summary = this.generateSummary(
                    this.schedule.flatMap(day => day.slots),
                    [],
                    this.schedule.length
                );
                text += '\n' + '='.repeat(50) + '\n';
                text += 'SUMMARY\n';
                text += `Total Study Hours: ${summary.totalStudyHours}\n`;
                text += `Total Break Hours: ${summary.totalBreakHours}\n`;
                text += `Efficiency Score: ${summary.efficiencyScore}%\n`;
                
                return text;
                
            default:
                return this.schedule;
        }
    }
}

// Create and export singleton instance
const scheduler = new SmartScheduler();
export default scheduler;