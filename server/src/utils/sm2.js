const MIN_EASE = 1.3;
const MAX_EASE = 2.5;
const DEFAULT_STEPS = [2, 16];
const HARD_INTERVAL_MINUTES = 8;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeSteps(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return DEFAULT_STEPS;
  }
  return steps.map((step) => Number(step)).filter((step) => Number.isInteger(step) && step > 0);
}

function addMinutes(baseDate, minutes) {
  return new Date(baseDate.getTime() + minutes * 60 * 1000);
}

function addDays(baseDate, days) {
  return new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
}

function toReviewDate(value) {
  return value.toISOString().slice(0, 10);
}

function calculateNextReview(progress, answer, settings, overdueDays = 0) {
  const now = new Date();
  const steps = normalizeSteps(settings.learning_steps_minutes);
  const firstStep = steps[0] || DEFAULT_STEPS[0];
  const state = progress.state || 'new';
  const isLearning = state === 'new' || state === 'learning' || state === 'relearning';
  let easinessFactor = clamp(Number(progress.easiness_factor) || MAX_EASE, MIN_EASE, MAX_EASE);
  let repetitions = Number(progress.repetitions) || 0;
  let intervalDays = Number(progress.interval_days) || 0;
  const currentStep = progress.step_index || 0;

  if (isLearning) {
    if (answer === 'again') {
      const nextReviewAt = addMinutes(now, firstStep);
      return {
        state: state === 'relearning' ? 'relearning' : 'learning',
        step_index: 0,
        repetitions: 0,
        interval_days: 0,
        easiness_factor: easinessFactor,
        next_review_at: nextReviewAt,
        next_review_date: toReviewDate(nextReviewAt),
      };
    }

    if (answer === 'hard') {
      const nextStep = currentStep + 1;
      const goodMinutes = nextStep < steps.length ? steps[nextStep] : null;
      const hardMinutes = Number.isFinite(goodMinutes)
        ? Math.max(1, Math.round((firstStep + goodMinutes) / 2))
        : HARD_INTERVAL_MINUTES;
      const nextReviewAt = addMinutes(now, hardMinutes);
      return {
        state: state === 'relearning' ? 'relearning' : 'learning',
        step_index: Math.min(currentStep, Math.max(steps.length - 1, 0)),
        repetitions,
        interval_days: 0,
        easiness_factor: easinessFactor,
        next_review_at: nextReviewAt,
        next_review_date: toReviewDate(nextReviewAt),
      };
    }

    if (answer === 'good') {
      const nextStep = currentStep + 1;
      if (nextStep < steps.length) {
        const nextReviewAt = addMinutes(now, steps[nextStep]);
        return {
          state: state === 'relearning' ? 'relearning' : 'learning',
          step_index: nextStep,
          repetitions,
          interval_days: 0,
          easiness_factor: easinessFactor,
          next_review_at: nextReviewAt,
          next_review_date: toReviewDate(nextReviewAt),
        };
      }

      const gradInterval = Math.max(1, Number(settings.graduating_interval_days) || 1);
      const nextReviewAt = addDays(now, gradInterval);
      return {
        state: 'review',
        step_index: 0,
        repetitions: Math.max(repetitions, 1),
        interval_days: gradInterval,
        easiness_factor: easinessFactor,
        next_review_at: nextReviewAt,
        next_review_date: toReviewDate(nextReviewAt),
      };
    }

    const easyInterval = Math.max(1, Number(settings.easy_interval_days) || 1);
    const nextReviewAt = addDays(now, easyInterval);
    return {
      state: 'review',
      step_index: 0,
      repetitions: Math.max(repetitions, 1),
      interval_days: easyInterval,
      easiness_factor: easinessFactor,
      next_review_at: nextReviewAt,
      next_review_date: toReviewDate(nextReviewAt),
    };
  }

  const currentInterval = Math.max(1, Number(progress.interval_days) || 1);

  if (answer === 'again') {
    easinessFactor = clamp(easinessFactor - 0.2, MIN_EASE, MAX_EASE);
    const nextReviewAt = addMinutes(now, firstStep);
    return {
      state: 'relearning',
      step_index: 0,
      repetitions: 0,
      interval_days: 0,
      easiness_factor: easinessFactor,
      next_review_at: nextReviewAt,
      next_review_date: toReviewDate(nextReviewAt),
    };
  }

  let multiplier = 1;
  let interval = currentInterval;

  if (answer === 'hard') {
    easinessFactor = clamp(easinessFactor - 0.15, MIN_EASE, MAX_EASE);
    multiplier = 1.2;
  } else if (answer === 'good') {
    multiplier = easinessFactor;
  } else {
    easinessFactor = clamp(easinessFactor + 0.15, MIN_EASE, MAX_EASE);
    multiplier = easinessFactor * 1.3;
  }

  interval = interval * multiplier;

  if (overdueDays > 0 && (answer === 'good' || answer === 'easy')) {
    interval += answer === 'good' ? overdueDays * 0.5 : overdueDays;
  }

  intervalDays = Math.max(1, Math.round(interval));
  const nextReviewAt = addDays(now, intervalDays);

  return {
    state: 'review',
    step_index: 0,
    repetitions: repetitions + 1,
    interval_days: intervalDays,
    easiness_factor: easinessFactor,
    next_review_at: nextReviewAt,
    next_review_date: toReviewDate(nextReviewAt),
  };
}

module.exports = { calculateNextReview };
