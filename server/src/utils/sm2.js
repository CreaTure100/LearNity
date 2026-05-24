function calculateNextReview(progress, quality) {
  const q = Math.max(0, Math.min(5, Number(quality)));
  let repetitions = progress.repetitions;
  let intervalDays = progress.interval_days;
  let easinessFactor = Number(progress.easiness_factor);

  if (q < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * easinessFactor);
  }

  easinessFactor = Math.max(1.3, easinessFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + intervalDays);

  return {
    repetitions,
    intervalDays,
    easinessFactor: Number(easinessFactor.toFixed(2)),
    nextReviewDate: nextDate.toISOString().slice(0, 10),
  };
}

module.exports = { calculateNextReview };
