import { fullParse, xmlArray, xmlNodeAttr } from 'abap-adt-api/build/utilities';

/**
 * Main programs of a program include, read from the include's own metadata
 * (include:contextRef). SAP_BASIS 7.40 has no .../mainprograms resource (404 on
 * P03) but names the main program there, which is also what the activation of
 * an include needs as its context.
 */
export function contextRefsFromIncludeXml(xml: string): Array<Record<string, string>> {
    const raw = fullParse(String(xml ?? ''));
    return xmlArray<any>(raw, 'include:abapInclude', 'include:contextRef').map(xmlNodeAttr).filter((r: any) => r?.['adtcore:uri']);
}

export async function includeMainPrograms(http: { request: (url: string, opts: any) => Promise<{ body?: string }> }, includeUrl: string): Promise<Array<Record<string, string>>> {
    const url = String(includeUrl).replace(/[#?].*$/, '').replace(/\/source\/main\/?$/i, '').replace(/\/$/, '');
    const res = await http.request(url, { headers: { Accept: 'application/vnd.sap.adt.programs.includes.v2+xml, application/vnd.sap.adt.programs.includes+xml;q=0.9, application/xml;q=0.8' } });
    return contextRefsFromIncludeXml(String(res.body ?? ''));
}

/** A program include URL without a ?context= query. */
export function isProgramIncludeWithoutContext(uri: string): boolean {
    return /^\/sap\/bc\/adt\/programs\/includes\/[^/?#]+$/i.test(String(uri || '')) && !/[?&]context=/.test(String(uri || ''));
}
