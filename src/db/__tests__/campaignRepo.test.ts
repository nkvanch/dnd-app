// ============================================================================
// FILE: src/db/__tests__/campaignRepo.test.ts
// First coverage for this file. Regression lock for audit finding
// PERSIST-4 (campaign half): loadAllCampaigns used to parse every row
// inside one unguarded .map() — a single malformed row threw and silently
// returned an empty list, hiding every other valid campaign.
// ============================================================================
describe('campaignRepo', () => {
  let repo: typeof import('../campaignRepo');
  let mockGetDb: jest.Mock;
  let getAllAsync: jest.Mock;

  const goodCampaign = { id: 'good', name: 'Good Campaign' };

  beforeEach(() => {
    jest.resetModules();
    getAllAsync = jest.fn().mockResolvedValue([]);
    jest.doMock('../db', () => ({ getDb: jest.fn() }));
    mockGetDb = require('../db').getDb;
    mockGetDb.mockReturnValue({ getAllAsync, runAsync: jest.fn().mockResolvedValue(undefined) });
    repo = require('../campaignRepo');
  });

  it('loadAllCampaigns returns valid rows and skips a malformed one instead of throwing', async () => {
    getAllAsync.mockResolvedValue([
      { id: 'good', data: JSON.stringify(goodCampaign), updatedAt: 2 },
      { id: 'bad',  data: 'not json{',                  updatedAt: 1 },
    ]);

    const result = await repo.loadAllCampaigns();

    expect(result).toEqual([goodCampaign]);
  });

  it('loadAllCampaigns returns every campaign when all rows are valid', async () => {
    const secondCampaign = { id: 'second', name: 'Second Campaign' };
    getAllAsync.mockResolvedValue([
      { id: 'good',   data: JSON.stringify(goodCampaign),   updatedAt: 2 },
      { id: 'second', data: JSON.stringify(secondCampaign), updatedAt: 1 },
    ]);

    const result = await repo.loadAllCampaigns();

    expect(result).toEqual([goodCampaign, secondCampaign]);
  });
});
