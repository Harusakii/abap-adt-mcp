import { extractMethodBody, extractMethodPreview } from '../extractMethod';

// Evaluation result for line 29 of ZCL_MCP_RFC_X on P03 (SAP_BASIS 7.40), trimmed.
const PROPOSAL = {
  name: 'count_values', isStatic: false, visibility: 'private', classBasedExceptions: false,
  genericRefactoring: {
    title: 'Extract Method', ignoreSyntaxErrorsAllowed: true, ignoreSyntaxErrors: false, transport: '',
    adtObjectUri: { range: { start: { line: 29, column: 4 }, end: { line: 29, column: 34 } }, uri: '/sap/bc/adt/oo/classes/zcl_mcp_rfc_x/source/main', query: {}, hashparms: {} },
    userContent: '',
    affectedObjects: [{ uri: '/sap/bc/adt/oo/classes/zcl_mcp_rfc_x/source/main', type: 'CLAS/I', name: 'ZCL_MCP_RFC_X=================CS', userContent: '37-649-82', textReplaceDeltas: [] }],
  },
  content: 'lv_count = lines( it_values ).', className: 'ZCL_MCP_RFC_X', isForTesting: false, isEventAllowed: false, isEvent: false,
  userContent: '<?xml version="1.0"?><ucMethod:ucMethod xmlns:ucMethod="http://www.sap.com/adt/refactoring/ucMethod"/>',
  parameters: [{ id: 'it_values', name: 'it_values', direction: 'importing', byValue: false, typeType: 'type', type: 'int4_table', userContent: '<x/>' }],
  exceptions: [],
};

describe('extract method preview body', () => {
  it('names the real class and always writes textReplaceDeltas, before userContent', () => {
    // abap-adt-api 8.4.3 sent ZAPIADT_TESTCASE_CLASS1[object Object] and no textReplaceDeltas; P03 refused it.
    const body = extractMethodBody(PROPOSAL);
    expect(body).toContain('<extractmethod:className>ZCL_MCP_RFC_X</extractmethod:className>');
    expect(body).not.toMatch(/ZAPIADT_TESTCASE_CLASS1|\[object Object\]/);
    expect(body).toMatch(/<generic:textReplaceDeltas><\/generic:textReplaceDeltas>\s*<generic:userContent>37-649-82<\/generic:userContent>/);
    expect(body).toContain('<generic:adtObjectUri>/sap/bc/adt/oo/classes/zcl_mcp_rfc_x/source/main#start=29,4;end=29,34</generic:adtObjectUri>');
    expect(body).toContain('<extractmethod:userContent>&lt;?xml version=&quot;1.0&quot;?&gt;');
  });

  it('posts the preview and reads the answer into the shape extractMethodExecute takes', async () => {
    const answer = '<?xml version="1.0" encoding="utf-8"?><generic:genericRefactoring xmlns:generic="http://www.sap.com/adt/refactoring/genericrefactoring" xmlns:adtcore="http://www.sap.com/adt/core">' +
      '<generic:title>Extract Method</generic:title><generic:adtObjectUri>/sap/bc/adt/oo/classes/zcl_mcp_rfc_x/source/main#start=29,4;end=29,34</generic:adtObjectUri>' +
      '<generic:affectedObjects><generic:affectedObject adtcore:name="ZCL_MCP_RFC_X=================CS" adtcore:type="CLAS/I" adtcore:uri="/sap/bc/adt/oo/classes/zcl_mcp_rfc_x/source/main">' +
      '<generic:textReplaceDeltas><generic:textReplaceDelta><generic:rangeFragment>#start=29,4;end=29,34</generic:rangeFragment><generic:contentOld>lv_count = lines( it_values ).</generic:contentOld><generic:contentNew>lv_count = count_values( it_values ).</generic:contentNew></generic:textReplaceDelta></generic:textReplaceDeltas>' +
      '<generic:userContent>u1</generic:userContent></generic:affectedObject></generic:affectedObjects>' +
      '<generic:transport/><generic:ignoreSyntaxErrorsAllowed>true</generic:ignoreSyntaxErrorsAllowed><generic:ignoreSyntaxErrors>false</generic:ignoreSyntaxErrors><generic:userContent/></generic:genericRefactoring>';
    const sent: any[] = [];
    const r = await extractMethodPreview({ request: async (url, opts) => { sent.push({ url, ...opts }); return { body: answer }; } }, PROPOSAL);
    expect(sent[0]).toMatchObject({ url: '/sap/bc/adt/refactorings', method: 'POST', qs: { step: 'preview', rel: 'http://www.sap.com/adt/relations/refactoring/extractmethod' } });
    expect(r.adtObjectUri).toMatchObject({ uri: '/sap/bc/adt/oo/classes/zcl_mcp_rfc_x/source/main', range: { start: { line: 29, column: 4 } } });
    expect(r.affectedObjects[0].textReplaceDeltas[0]).toEqual({ rangeFragment: { start: { line: 29, column: 4 }, end: { line: 29, column: 34 } }, contentOld: 'lv_count = lines( it_values ).', contentNew: 'lv_count = count_values( it_values ).' });
  });
});
