import { decodeCursor, encodeCursor, skipTake } from './pagination';

describe('pagination', () => {
  it('encode/decode cursor — round-trip', () => {
    const now = new Date('2026-07-16T10:00:00.000Z');
    const id = '018f8c00-0000-7000-8000-000000000000';
    const cursor = encodeCursor(now, id);
    const decoded = decodeCursor(cursor);
    expect(decoded).not.toBeNull();
    expect(decoded!.id).toBe(id);
    expect(decoded!.createdAt.toISOString()).toBe(now.toISOString());
  });

  it('decodeCursor возвращает null на мусоре', () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor('!!!not-base64!!!')).toBeNull();
    expect(decodeCursor(Buffer.from('нет-разделителя').toString('base64url'))).toBeNull();
  });

  it('skipTake считает смещение', () => {
    expect(skipTake(1, 25)).toEqual({ skip: 0, take: 25 });
    expect(skipTake(3, 10)).toEqual({ skip: 20, take: 10 });
  });
});
