import { adtException } from 'abap-adt-api/build/AdtException';
import { contextRefsFromIncludeXml } from '../../lib/includeContext';
import { ObjectManagementHandlers } from '../ObjectManagementHandlers';
import { ObjectSourceHandlers } from '../ObjectSourceHandlers';
import { NodeHandlers } from '../NodeHandlers';

// Metadata of ZMCP_RFC_Y_INC on P03 (SAP_BASIS 740 SP07), trimmed.
const INCLUDE_XML = '<?xml version="1.0" encoding="utf-8"?><include:abapInclude include:contextRefCount="1" adtcore:name="ZMCP_RFC_Y_INC" adtcore:type="PROG/I" ' +
  'xmlns:include="http://www.sap.com/adt/programs/includes" xmlns:adtcore="http://www.sap.com/adt/core">' +
  '<adtcore:packageRef adtcore:uri="/sap/bc/adt/vit/wb/object_type/devck/object_name/%24TMP" adtcore:type="DEVC/K" adtcore:name="$TMP"/>' +
  '<include:contextRef adtcore:uri="/sap/bc/adt/programs/programs/zmcp_rfc_y" adtcore:type="PROG/P" adtcore:name="ZMCP_RFC_Y" adtcore:packageName="$TMP"/></include:abapInclude>';
const INC = '/sap/bc/adt/programs/includes/zmcp_rfc_y_inc';

describe('program includes', () => {
  it('read the main program from the include metadata', () => {
    expect(contextRefsFromIncludeXml(INCLUDE_XML)).toEqual([expect.objectContaining({ 'adtcore:uri': '/sap/bc/adt/programs/programs/zmcp_rfc_y', 'adtcore:name': 'ZMCP_RFC_Y' })]);
  });

  it('mainPrograms falls back to the metadata when .../mainprograms answers 404', async () => {
    const client: any = { mainPrograms: jest.fn(async () => { throw adtException('Error 404:Not Found', 404); }), httpClient: { request: jest.fn(async () => ({ body: INCLUDE_XML })) } };
    const r = JSON.parse((await new NodeHandlers(client).handle('mainPrograms', { includeUrl: INC })).content[0].text);
    expect(r.mainPrograms[0]['adtcore:name']).toBe('ZMCP_RFC_Y');
    expect(client.httpClient.request).toHaveBeenCalledWith(INC, expect.anything());
  });

  it('activateObjects activates an include in the context of its main program', async () => {
    // Without it P03 answered "Main program is not anymore valid for include ZMCP_RFC_Y_INC".
    const sent: any[] = [];
    const client: any = { httpClient: { request: jest.fn(async (url: string, opts: any) => { sent.push({ url, ...opts }); return { body: url === INC ? INCLUDE_XML : '' }; }) } };
    await new ObjectManagementHandlers(client).handle('activateObjects', { objects: JSON.stringify([
      { 'adtcore:uri': INC, 'adtcore:type': 'PROG/I', 'adtcore:name': 'ZMCP_RFC_Y_INC' },
      { 'adtcore:uri': '/sap/bc/adt/programs/programs/zmcp_rfc_y', 'adtcore:type': 'PROG/P', 'adtcore:name': 'ZMCP_RFC_Y' },
    ]) });
    const activation = sent.find(r => r.url === '/sap/bc/adt/activation');
    expect(activation.body).toContain('adtcore:uri="/sap/bc/adt/programs/includes/zmcp_rfc_y_inc?context=%2Fsap%2Fbc%2Fadt%2Fprograms%2Fprograms%2Fzmcp_rfc_y"');
    expect(activation.body).toContain('adtcore:uri="/sap/bc/adt/programs/programs/zmcp_rfc_y"');
  });

  it('getObjectSource keeps /source/main for a program include and still drops it for class includes', async () => {
    // It used to strip it for any /includes/ URL and return the include's metadata XML.
    const urls: string[] = [];
    const client: any = { getObjectSource: jest.fn(async (url: string) => { urls.push(url); return 'FORM say_hello.\nENDFORM.'; }) };
    const h = new ObjectSourceHandlers(client);
    const r = JSON.parse((await h.handle('getObjectSource', { objectSourceUrl: `${INC}/source/main` })).content[0].text);
    expect(r.source).toContain('FORM say_hello');
    await h.handle('getObjectSource', { objectSourceUrl: '/sap/bc/adt/oo/classes/zcl_x/includes/testclasses/source/main' });
    expect(urls).toEqual([`${INC}/source/main`, '/sap/bc/adt/oo/classes/zcl_x/includes/testclasses']);
  });
});
