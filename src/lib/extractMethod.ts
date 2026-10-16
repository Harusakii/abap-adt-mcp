import { encodeEntity, fullParse, xmlArray, xmlNode, xmlNodeAttr } from 'abap-adt-api/build/utilities';
import { parseUri, rangeToString } from 'abap-adt-api/build/api/urlparser';

/**
 * Extract method preview, as abap-adt-api's extractMethodPreview but with the
 * request body SAP accepts. abap-adt-api 8.4.3 sends
 * <extractmethod:className>ZAPIADT_TESTCASE_CLASS1[object Object]</...> (a
 * leftover of its own test class) and leaves out generic:textReplaceDeltas
 * when an affected object has none, which is always the case at preview: P03
 * answered "Elem. '{...genericrefactoring}textReplaceDeltas' esperado". The
 * affected objects are written the way the library writes them for rename,
 * which SAP accepts. The answer is read into the same shape, so the library's
 * extractMethodExecute takes it unchanged.
 */
export async function extractMethodPreview(http: { request: (url: string, opts: any) => Promise<{ body?: string }> }, proposal: any): Promise<any> {
    const response = await http.request('/sap/bc/adt/refactorings', {
        method: 'POST',
        qs: { step: 'preview', rel: 'http://www.sap.com/adt/relations/refactoring/extractmethod' },
        headers: { 'Content-Type': 'application/*', Accept: 'application/*' },
        body: extractMethodBody(proposal),
    });
    return parseGeneric(fullParse(String(response.body ?? ''), { removeNSPrefix: true }).genericRefactoring);
}

const text = (v: unknown) => encodeEntity(String(v ?? ''));

export function extractMethodBody(proposal: any): string {
    const parameters = (proposal.parameters ?? []).map((p: any) => `<extractmethod:parameter>
      <extractmethod:id>${text(p.id)}</extractmethod:id>
      <extractmethod:name>${text(p.name)}</extractmethod:name>
      <extractmethod:direction>${text(p.direction)}</extractmethod:direction>
      <extractmethod:byValue>${p.byValue}</extractmethod:byValue>
      <extractmethod:typeType>${text(p.typeType)}</extractmethod:typeType>
      <extractmethod:type>${text(p.type)}</extractmethod:type>
      <extractmethod:userContent>${text(p.userContent)}</extractmethod:userContent>
    </extractmethod:parameter>`).join('\n');
    const exceptions = (proposal.exceptions ?? []).map((e: any) => `<extractmethod:exception>
      <extractmethod:name>${text(e.name)}</extractmethod:name>
      <extractmethod:resumable>${e.resumable}</extractmethod:resumable>
      <extractmethod:userContent>${text(e.userContent)}</extractmethod:userContent>
    </extractmethod:exception>`).join('\n');
    const gr = proposal.genericRefactoring;
    const affected = (gr.affectedObjects ?? []).map((o: any) => {
        const parent = o.parentUri ? ` adtcore:parentUri="${text(o.parentUri)}"` : '';
        const deltas = (o.textReplaceDeltas ?? []).map((d: any) => `<generic:textReplaceDelta>
            <generic:rangeFragment>${typeof d.rangeFragment === 'string' ? d.rangeFragment : rangeToString(d.rangeFragment)}</generic:rangeFragment>
            <generic:contentOld>${text(d.contentOld)}</generic:contentOld>
            <generic:contentNew>${text(d.contentNew)}</generic:contentNew>
          </generic:textReplaceDelta>`).join('');
        return `<generic:affectedObject adtcore:name="${text(o.name)}"${parent} adtcore:type="${text(o.type)}" adtcore:uri="${text(o.uri)}">
        <generic:textReplaceDeltas>${deltas}</generic:textReplaceDeltas>
        <generic:userContent>${text(o.userContent)}</generic:userContent>
      </generic:affectedObject>`;
    }).join('\n');
    const objectUri = typeof gr.adtObjectUri === 'string' ? gr.adtObjectUri : `${gr.adtObjectUri.uri}${rangeToString(gr.adtObjectUri.range)}`;
    return `<?xml version="1.0" encoding="ASCII"?>
<extractmethod:extractMethodRefactoring xmlns:adtcore="http://www.sap.com/adt/core" xmlns:extractmethod="http://www.sap.com/adt/refactoring/extractmethodrefactoring" xmlns:generic="http://www.sap.com/adt/refactoring/genericrefactoring">
  <extractmethod:name>${text(proposal.name)}</extractmethod:name>
  <extractmethod:isStatic>${proposal.isStatic}</extractmethod:isStatic>
  <extractmethod:visibility>${text(proposal.visibility)}</extractmethod:visibility>
  <extractmethod:classBasedExceptions>${proposal.classBasedExceptions}</extractmethod:classBasedExceptions>
  <extractmethod:parameters>
  ${parameters}
  </extractmethod:parameters>
  ${exceptions ? `<extractmethod:exceptions>${exceptions}</extractmethod:exceptions>` : '<extractmethod:exceptions/>'}
  <extractmethod:content>${text(proposal.content)}</extractmethod:content>
  <generic:genericRefactoring>
    <generic:title>${text(gr.title)}</generic:title>
    <generic:adtObjectUri>${objectUri}</generic:adtObjectUri>
    <generic:affectedObjects>
    ${affected}
    </generic:affectedObjects>
    <generic:transport>${text(gr.transport)}</generic:transport>
    <generic:ignoreSyntaxErrorsAllowed>${gr.ignoreSyntaxErrorsAllowed}</generic:ignoreSyntaxErrorsAllowed>
    <generic:ignoreSyntaxErrors>${gr.ignoreSyntaxErrors}</generic:ignoreSyntaxErrors>
    <generic:userContent>${text(gr.userContent)}</generic:userContent>
  </generic:genericRefactoring>
  <extractmethod:className>${text(proposal.className)}</extractmethod:className>
  <extractmethod:isEventAllowed>${proposal.isEventAllowed}</extractmethod:isEventAllowed>
  <extractmethod:isEvent>${proposal.isEvent}</extractmethod:isEvent>
  <extractmethod:userContent>${text(proposal.userContent)}</extractmethod:userContent>
  <extractmethod:isForTesting>${proposal.isForTesting}</extractmethod:isForTesting>
</extractmethod:extractMethodRefactoring>`;
}

const decodeXml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');

/** The generic refactoring of the answer, in the shape abap-adt-api's parseGeneric returns. */
function parseGeneric(generic: any): any {
    const affectedObjects = xmlArray<any>(generic, 'affectedObjects', 'affectedObject').map(o => {
        const { uri, type, name, parentUri } = xmlNodeAttr(o);
        const textReplaceDeltas = xmlArray<any>(o, 'textReplaceDeltas', 'textReplaceDelta').map(z => ({
            rangeFragment: parseUri(xmlNode(z, 'rangeFragment')).range,
            contentOld: xmlNode(z, 'contentOld'),
            contentNew: xmlNode(z, 'contentNew'),
        }));
        return { uri, type, name, parentUri, userContent: o.userContent, textReplaceDeltas };
    });
    const { ignoreSyntaxErrorsAllowed, ignoreSyntaxErrors, transport, userContent = '', adtObjectUri = '', title } = generic ?? {};
    return { title, ignoreSyntaxErrorsAllowed, ignoreSyntaxErrors, transport, adtObjectUri: parseUri(adtObjectUri), userContent: decodeXml(String(userContent)), affectedObjects };
}
