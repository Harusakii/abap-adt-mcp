import { parse, xmlArray } from 'abap-adt-api/build/utilities';

/**
 * The object type catalog in the shape abap-adt-api's objectTypes returns
 * ({ name, description, type, usedBy }). SAP_BASIS 7.40 sends
 * <nameditem:data> as the bare ADT type ("CLAS/OC") or empty, with no
 * usedBy list, and the library keeps only entries that have both.
 */
export function parseObjectTypes740(xml: string): Array<{ name: string; description: string; type: string; usedBy: string[] }> {
    const raw = parse(xml);
    return xmlArray<any>(raw, 'nameditem:namedItemList', 'nameditem:namedItem').map(n => {
        const data = String(n['nameditem:data'] ?? '');
        const fields: Record<string, string> = {};
        if (data.includes(':')) {
            for (const part of data.split(';')) { const [k, v = ''] = part.split(':', 2); fields[k] = v; }
        } else {
            fields.type = data;
        }
        return { name: String(n['nameditem:name'] ?? ''), description: String(n['nameditem:description'] ?? ''), type: fields.type ?? '', usedBy: fields.usedBy ? fields.usedBy.split(',') : [] };
    }).filter(t => t.name);
}
