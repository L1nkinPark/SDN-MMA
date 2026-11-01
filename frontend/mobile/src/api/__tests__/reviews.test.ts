import { nextReviewPage, reviewUserId } from '../hooks/useReviews';

describe('reviews paging', () => {
  it('stops when every review is loaded', () => {
    expect(nextReviewPage({ page: 1, limit: 20, total: 45 })).toBe(2);
    expect(nextReviewPage({ page: 3, limit: 20, total: 45 })).toBeUndefined();
    expect(nextReviewPage({ page: 1, limit: 20, total: 20 })).toBeUndefined();
    expect(nextReviewPage({ items: [] })).toBeUndefined();
  });

  it('reads the user id from populated or plain reviews', () => {
    expect(reviewUserId({ user: 'u1' })).toBe('u1');
    expect(reviewUserId({ user: { _id: 'u2', name: 'An' } })).toBe('u2');
    expect(reviewUserId({})).toBeUndefined();
  });
});
