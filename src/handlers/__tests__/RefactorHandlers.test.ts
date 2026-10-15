/**
 * changePackagePreview must hand abap-adt-api a complete affected object
 * (#86): the library serializes name/type/uri/oldPackage/newPackage before
 * sending anything and threw on undefined.
 */
import { RefactorHandlers } from '../RefactorHandlers';

const parse = (r: any) => JSON.parse(r.content[0].text);

function make(structure: any = { metaData: { 'adtcore:name': 'ZCL_DEMO', 'adtcore:type': 'CLAS/OC' } }) {
  const client: any = {
    objectStructure: jest.fn(async () => structure),
    changePackagePreview: jest.fn(async (p: any) => ({ ...p, transport: 'DEVK900001' })),
    changePackageExecute: jest.fn(async (r: any) => r),
    stateful: 'stateless'
  };
  return { client, handler: new RefactorHandlers(client) };
}

describe('changePackagePreview', () => {
  const args = { objectUrl: '/sap/bc/adt/oo/classes/zcl_demo', oldPackage: 'Z_PARENT', newPackage: 'Z_CHILD' };

  it('resolves name and type from the object structure and passes one affected object', async () => {
    const { client, handler } = make();
    const res = parse(await handler.handle('changePackagePreview', args));
    expect(client.objectStructure).toHaveBeenCalledWith(args.objectUrl);
    const [proposal, transport] = client.changePackagePreview.mock.calls[0];
    expect(transport).toBe('');
    expect(proposal.affectedObjects).toEqual({
      uri: args.objectUrl, name: 'ZCL_DEMO', type: 'CLAS/OC',
      oldPackage: 'Z_PARENT', newPackage: 'Z_CHILD', parentUri: ''
    });
    expect(proposal.adtObjectUri).toBe(args.objectUrl);
    expect(res).toMatchObject({ status: 'success', next: 'changePackageExecute' });
    expect(res.refactoring.transport).toBe('DEVK900001');
  });

  it('takes objectName and objectType from the arguments without reading the structure', async () => {
    const { client, handler } = make();
    await handler.handle('changePackagePreview', { ...args, objectUrl: '/sap/bc/adt/ddic/ddl/sources/z_i_demo', objectName: 'Z_I_DEMO', objectType: 'DDLS/DF', transport: 'DEVK900002' });
    expect(client.objectStructure).not.toHaveBeenCalled();
    const [proposal, transport] = client.changePackagePreview.mock.calls[0];
    expect(proposal.affectedObjects).toMatchObject({ name: 'Z_I_DEMO', type: 'DDLS/DF', uri: '/sap/bc/adt/ddic/ddl/sources/z_i_demo' });
    expect(transport).toBe('DEVK900002');
  });

  it('refuses with a hint when the structure carries no name or type', async () => {
    const { client, handler } = make({ metaData: {} });
    await expect(handler.handle('changePackagePreview', args)).rejects.toThrow(/pass objectName .* and objectType/);
    expect(client.changePackagePreview).not.toHaveBeenCalled();
  });
});

describe('changePackageExecute', () => {
  it('refuses a refactoring without an affected object before touching SAP', async () => {
    const { client, handler } = make();
    await expect(handler.handle('changePackageExecute', { refactoring: JSON.stringify({ oldPackage: 'A', newPackage: 'B' }) }))
      .rejects.toThrow(/affectedObjects must carry/);
    expect(client.changePackageExecute).not.toHaveBeenCalled();
  });

  it('passes the previewed refactoring through in a stateful session', async () => {
    const { client, handler } = make();
    const refactoring = { oldPackage: 'A', newPackage: 'B', adtObjectUri: '/u', transport: 'T', ignoreSyntaxErrorsAllowed: false, ignoreSyntaxErrors: false, userContent: '',
      affectedObjects: { uri: '/u', name: 'ZCL_DEMO', type: 'CLAS/OC', oldPackage: 'A', newPackage: 'B', parentUri: '' } };
    const res = parse(await handler.handle('changePackageExecute', { refactoring }));
    expect(client.changePackageExecute).toHaveBeenCalledWith(refactoring);
    expect(client.stateful).toBe('stateful');
    expect(res.status).toBe('success');
  });
});
