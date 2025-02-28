import { of } from 'rxjs';

import { DatasourceSrv } from '../../features/plugins/datasource_srv';
import { RichHistoryQuery } from '../../types';
import { SortOrder } from '../utils/richHistoryTypes';

import RichHistoryRemoteStorage, { RichHistoryRemoteStorageDTO } from './RichHistoryRemoteStorage';

const dsMock = new DatasourceSrv();
dsMock.init(
  {
    // @ts-ignore
    'name-of-ds1': { uid: 'ds1', name: 'name-of-ds1' },
    // @ts-ignore
    'name-of-ds2': { uid: 'ds2', name: 'name-of-ds2' },
  },
  ''
);

const fetchMock = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    fetch: fetchMock,
  }),
  getDataSourceSrv: () => dsMock,
}));

describe('RichHistoryRemoteStorage', () => {
  let storage: RichHistoryRemoteStorage;

  beforeEach(() => {
    fetchMock.mockReset();
    storage = new RichHistoryRemoteStorage();
  });

  it('returns list of query history items', async () => {
    const expectedViewModel: RichHistoryQuery<any> = {
      id: '123',
      createdAt: 200 * 1000,
      datasourceUid: 'ds1',
      datasourceName: 'name-of-ds1',
      starred: true,
      comment: 'comment',
      queries: [{ foo: 'bar ' }],
    };
    const returnedDTOs: RichHistoryRemoteStorageDTO[] = [
      {
        uid: expectedViewModel.id,
        createdAt: expectedViewModel.createdAt / 1000,
        datasourceUid: expectedViewModel.datasourceUid,
        starred: expectedViewModel.starred,
        comment: expectedViewModel.comment,
        queries: expectedViewModel.queries,
      },
    ];
    fetchMock.mockReturnValue(
      of({
        data: {
          result: {
            queryHistory: returnedDTOs,
          },
        },
      })
    );
    const search = 'foo';
    const datasourceFilters = ['name-of-ds1', 'name-of-ds2'];
    const sortOrder = SortOrder.Descending;
    const starred = true;
    const from = 100;
    const to = 200;
    const expectedLimit = 100;
    const expectedPage = 1;

    const items = await storage.getRichHistory({ search, datasourceFilters, sortOrder, starred, to, from });

    expect(fetchMock).toBeCalledWith({
      method: 'GET',
      url: `/api/query-history?datasourceUid=ds1&datasourceUid=ds2&searchString=${search}&sort=time-desc&to=now-${from}d&from=now-${to}d&limit=${expectedLimit}&page=${expectedPage}&onlyStarred=${starred}`,
      requestId: 'query-history-get-all',
    });
    expect(items).toMatchObject([expectedViewModel]);
  });
});
