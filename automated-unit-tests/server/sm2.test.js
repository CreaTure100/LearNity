const { calculateNextReview } = require('../../server/src/utils/sm2');

describe('calculateNextReview', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps learning state on again', () => {
    // Описание: ответ "снова" оставляет карточку в обучении.
    const progress = { state: 'new', step_index: 0 };
    const settings = { learning_steps_minutes: [1, 10] };

    const result = calculateNextReview(progress, 'again', settings);

    expect(result.state).toBe('learning');
    expect(result.step_index).toBe(0);
    expect(result.interval_days).toBe(0);
    expect(result.next_review_date).toBe('2025-01-01');
  });

  it('graduates to review when learning steps are done', () => {
    // Описание: последний шаг обучения переводит карточку в review.
    const progress = { state: 'learning', step_index: 1, repetitions: 0 };
    const settings = {
      learning_steps_minutes: [1, 10],
      graduating_interval_days: 3,
    };

    const result = calculateNextReview(progress, 'good', settings);

    expect(result.state).toBe('review');
    expect(result.interval_days).toBe(3);
    expect(result.repetitions).toBe(1);
    expect(result.next_review_date).toBe('2025-01-04');
  });

  it('applies hard answer in review with reduced ease', () => {
    // Описание: "hard" снижает коэффициент и дает короткий интервал.
    const progress = { state: 'review', interval_days: 10, easiness_factor: 2.0, repetitions: 3 };
    const settings = { learning_steps_minutes: [1, 10] };

    const result = calculateNextReview(progress, 'hard', settings);

    expect(result.state).toBe('review');
    expect(result.interval_days).toBeGreaterThanOrEqual(10);
    expect(result.easiness_factor).toBeLessThanOrEqual(2.0);
  });

  it('applies easy answer in review with bonus', () => {
    // Описание: "easy" увеличивает коэффициент и интервал.
    const progress = { state: 'review', interval_days: 5, easiness_factor: 2.1, repetitions: 1 };
    const settings = { learning_steps_minutes: [1, 10] };

    const result = calculateNextReview(progress, 'easy', settings);

    expect(result.state).toBe('review');
    expect(result.interval_days).toBeGreaterThan(5);
    expect(result.easiness_factor).toBeGreaterThan(2.1);
  });

  it('adds overdue bonus for good/easy', () => {
    // Описание: просрочка увеличивает интервал при "good" и "easy".
    const progress = { state: 'review', interval_days: 5, easiness_factor: 2.0, repetitions: 2 };
    const settings = { learning_steps_minutes: [1, 10] };

    const result = calculateNextReview(progress, 'good', settings, 4);

    expect(result.interval_days).toBeGreaterThan(5);
  });
});
