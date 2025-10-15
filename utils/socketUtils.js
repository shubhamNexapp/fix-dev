const isToday = (date) => {
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

const formatTimeForDisplay = (isoString) => {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  } catch (error) {
    return 'Invalid time';
  }
};

const calculateDurationFromNow = (isoString) => {
  try {
    const targetTime = new Date(isoString);
    const now = new Date();
    const diffMs = targetTime.getTime() - now.getTime();
    if (diffMs <= 0) return 'Now';
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    } else {
      return `${minutes}m`;
    }
  } catch (error) {
    return 'Unknown';
  }
};

const processETAData = (estimatedTime, estimatedTimeFormatted, estimatedDuration) => {
  if (estimatedTime && estimatedTimeFormatted && estimatedDuration) {
    return {
      completionTime: estimatedTime,
      displayTime: estimatedTimeFormatted,
      timeFromNow: estimatedDuration,
      isToday: true
    };
  }
  if (estimatedTime && typeof estimatedTime === 'string') {
    return {
      completionTime: null,
      displayTime: null,
      timeFromNow: estimatedTime,
      isToday: true
    };
  }
  return {
    completionTime: null,
    displayTime: 'TBD',
    timeFromNow: 'Unknown',
    isToday: true
  };
};

module.exports = {
  isToday,
  formatTimeForDisplay,
  calculateDurationFromNow,
  processETAData
};