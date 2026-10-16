import { parseObjectTypes740 } from '../objectTypes740';

// Trimmed answer of P03 (SAP_BASIS 740 SP07): data is the bare type or empty.
const XML = '<?xml version="1.0" encoding="utf-8"?><nameditem:namedItemList xmlns:nameditem="http://www.sap.com/adt/nameditem"><nameditem:totalItemCount>3</nameditem:totalItemCount>' +
  '<nameditem:namedItem><nameditem:name>CLAS</nameditem:name><nameditem:description>Classe (objetos ABAP)</nameditem:description><nameditem:data>CLAS/OC</nameditem:data></nameditem:namedItem>' +
  '<nameditem:namedItem><nameditem:name>PROG</nameditem:name><nameditem:description>Programa</nameditem:description><nameditem:data/></nameditem:namedItem>' +
  '<nameditem:namedItem><nameditem:name>DDLS</nameditem:name><nameditem:description>DDL</nameditem:description><nameditem:data>type:DDLS/DF;usedBy:PROG,CLAS</nameditem:data></nameditem:namedItem>' +
  '</nameditem:namedItemList>';

describe('parseObjectTypes740', () => {
  it('keeps the entries abap-adt-api drops on 7.40 and reads the newer format too', () => {
    expect(parseObjectTypes740(XML)).toEqual([
      { name: 'CLAS', description: 'Classe (objetos ABAP)', type: 'CLAS/OC', usedBy: [] },
      { name: 'PROG', description: 'Programa', type: '', usedBy: [] },
      { name: 'DDLS', description: 'DDL', type: 'DDLS/DF', usedBy: ['PROG', 'CLAS'] },
    ]);
  });
});
